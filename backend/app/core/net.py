"""
Shared guard for every outbound URL this server fetches on a caller's behalf.

A user-supplied ``base_url`` or a URL pasted into a chat message turns this process
into a proxy: the *server* issues the request, not the browser. Without a check, an
account could aim traffic at cloud metadata (169.254.169.254), the Postgres
container, or any internal service, and read the replies back out of a model answer
or a provider error message. That is server-side request forgery, and because the
response reaches the user it is a *readable* one.

The rules live here, in one place, so the ``base_url`` path and the "fetch whatever
the user linked" path cannot drift apart again:

  1. Scheme must be http/https. Whether plaintext http is acceptable is the caller's
     decision, because only the ``base_url`` path carries a credential.
  2. No credentials embedded in the URL.
  3. The host must not be a loopback / metadata alias by name.
  4. **Every** address the host resolves to must be public. Checking only the first
     would let a name with one public and one private record slip through.

Known limitation: DNS is resolved once, here, at check time. This cannot stop DNS
rebinding, where a name resolves to a public IP now and to a private IP by the time
httpx connects. Closing that window properly requires the check at connect time (a
custom transport that re-validates the peer address after the handshake).
``fetch_public_bytes`` below at least re-validates every redirect hop, which is the
other half of the attack surface.
"""

import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from typing import Mapping, Optional, Tuple, Union

import httpx

IPNetwork = Union[ipaddress.IPv4Network, ipaddress.IPv6Network]

#: Networks a caller-influenced URL may never point at.
BLOCKED_NETWORKS: Tuple[IPNetwork, ...] = tuple(
    ipaddress.ip_network(cidr)
    for cidr in (
        "0.0.0.0/8",        # "this network"
        "10.0.0.0/8",       # private
        "100.64.0.0/10",    # carrier-grade NAT
        "127.0.0.0/8",      # loopback
        "169.254.0.0/16",   # link-local, incl. cloud metadata (169.254.169.254)
        "172.16.0.0/12",    # private
        "192.168.0.0/16",   # private
        "192.0.0.0/24",     # IETF protocol assignments
        "198.18.0.0/15",    # benchmarking
        "224.0.0.0/4",      # multicast
        "240.0.0.0/4",      # reserved
        "::/128",           # unspecified (0:0:0:0:0:0:0:0)
        "::1/128",          # loopback
        "64:ff9b::/96",     # NAT64 — can wrap an IPv4 loopback or metadata address
        "fc00::/7",         # unique local
        "fe80::/10",        # link-local
    )
)

#: Hostnames that point inward but are not IP literals, so they never reach the
#: address check below. Kept as a belt-and-braces layer, not the primary defence.
BLOCKED_HOSTNAMES = frozenset(
    {"localhost", "metadata.google.internal", "metadata"}
)

_REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})


class UnsafeURLError(ValueError):
    """The URL must not be fetched by the server on a caller's behalf."""


class ContentTooLargeError(RuntimeError):
    """The response exceeded the caller's byte budget. Carries the actual size."""


def _normalize_ip(raw: str) -> Union[ipaddress.IPv4Address, ipaddress.IPv6Address]:
    """Parse an address, folding IPv4-mapped IPv6 back down to plain IPv4.

    Without this, ``::ffff:127.0.0.1`` slips past the whole IPv4 blacklist:
    ``IPv6Address in IPv4Network`` is False purely because the versions differ, so
    the containment test can never match.
    """
    ip = ipaddress.ip_address(raw)
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        return ip.ipv4_mapped
    return ip


def _is_blocked(ip: Union[ipaddress.IPv4Address, ipaddress.IPv6Address]) -> bool:
    return any(ip in network for network in BLOCKED_NETWORKS)


async def ensure_public_url(url: str, *, allow_http: bool) -> str:
    """Return ``url`` unchanged when it is safe for the server to fetch.

    Args:
        url: the absolute URL to validate.
        allow_http: ``False`` for anything that carries a credential (a stored
            ``base_url``), ``True`` for content fetches where plaintext only costs
            integrity, not secrecy.

    Raises:
        UnsafeURLError: with a message meant to be shown to the user as-is.
    """
    candidate = (url or "").strip()
    if not candidate:
        raise UnsafeURLError("地址为空")

    parsed = httpx.URL(candidate)
    if parsed.scheme not in ("http", "https"):
        raise UnsafeURLError(
            f"只支持 http/https 地址，收到：{parsed.scheme or '(空)'}"
        )
    if parsed.username or parsed.password:
        raise UnsafeURLError("地址不得内嵌用户名或密码")

    host = parsed.host
    if not host:
        raise UnsafeURLError("地址缺少主机名")

    lowered = host.lower()
    if lowered in BLOCKED_HOSTNAMES:
        raise UnsafeURLError(f"禁止访问指向内网的地址：{host}")

    # A bare IP literal can be judged directly; a hostname needs resolving.
    try:
        addresses = [lowered]
        ipaddress.ip_address(lowered)
    except ValueError:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        try:
            infos = await asyncio.to_thread(
                socket.getaddrinfo,
                host,
                port,
                type=socket.SOCK_STREAM,
            )
        except socket.gaierror as e:
            raise UnsafeURLError(f"主机名无法解析：{host}") from e
        addresses = sorted({info[4][0] for info in infos})

    if not addresses:
        raise UnsafeURLError(f"主机名无法解析：{host}")

    for raw_ip in addresses:
        try:
            ip = _normalize_ip(raw_ip)
        except ValueError as e:
            raise UnsafeURLError(f"主机名解析出非法地址：{raw_ip}") from e
        if _is_blocked(ip):
            raise UnsafeURLError(
                f"禁止访问内网/链路本地地址：{host} → {ip}"
            )

    # Plain http to a remote host would ship the credential in the clear.
    if parsed.scheme == "http" and not allow_http:
        raise UnsafeURLError(
            "远程地址必须使用 https（明文 http 会导致凭证泄露）"
        )

    return candidate


@dataclass(frozen=True)
class FetchedContent:
    """A downloaded body plus just enough metadata to interpret it."""

    data: bytes
    content_type: str
    final_url: str


async def fetch_public_bytes(
    url: str,
    *,
    max_bytes: int,
    timeout: float = 25.0,
    headers: Optional[Mapping[str, str]] = None,
    max_redirects: int = 5,
) -> FetchedContent:
    """Download a URL the caller pointed at, safely.

    Three things this does that a bare ``httpx.get(follow_redirects=True)`` does not:

    1. Re-runs :func:`ensure_public_url` on **every hop**, so a public host cannot
       bounce us to ``169.254.169.254`` after we validated the first address.
    2. Streams and aborts once ``max_bytes`` is exceeded, so an oversized or
       endless response is never fully buffered in memory.
    3. Returns the bytes and content type together, so callers stop reaching for
       ``Response.encoding`` and re-sniffing headers themselves.
    """
    current = url
    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=False,
        headers=dict(headers or {}),
    ) as client:
        for _ in range(max_redirects + 1):
            await ensure_public_url(current, allow_http=True)

            async with client.stream("GET", current) as resp:
                if resp.status_code in _REDIRECT_STATUSES:
                    location = resp.headers.get("location")
                    if not location:
                        raise UnsafeURLError(
                            f"重定向响应缺少 Location 头：{current}"
                        )
                    current = str(httpx.URL(current).join(location))
                    continue

                resp.raise_for_status()

                chunks = bytearray()
                async for chunk in resp.aiter_bytes():
                    chunks.extend(chunk)
                    if len(chunks) > max_bytes:
                        raise ContentTooLargeError(
                            f"响应体超过 {max_bytes} 字节上限（已读取 {len(chunks)} 字节）"
                        )

                return FetchedContent(
                    data=bytes(chunks),
                    content_type=resp.headers.get("content-type", ""),
                    final_url=current,
                )

    raise UnsafeURLError(f"重定向次数超过 {max_redirects} 次：{url}")