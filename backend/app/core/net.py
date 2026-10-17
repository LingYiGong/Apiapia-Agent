"""Outbound URL security validation to guard against SSRF."""

import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from typing import Mapping, Optional, Tuple, Union

import httpx

from app.core.i18n import tr

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
        raise UnsafeURLError(tr("URL_EMPTY"))

    parsed = httpx.URL(candidate)
    if parsed.scheme not in ("http", "https"):
        raise UnsafeURLError(
            tr("URL_SCHEME_UNSUPPORTED", scheme=parsed.scheme or "(空)")
        )
    if parsed.username or parsed.password:
        raise UnsafeURLError(tr("URL_HAS_CREDENTIALS"))

    host = parsed.host
    if not host:
        raise UnsafeURLError(tr("URL_MISSING_HOST"))

    lowered = host.lower()
    if lowered in BLOCKED_HOSTNAMES:
        raise UnsafeURLError(tr("URL_PRIVATE_HOST", host=host))

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
            raise UnsafeURLError(tr("URL_DNS_FAILED", host=host)) from e
        addresses = sorted({info[4][0] for info in infos})

    if not addresses:
        raise UnsafeURLError(tr("URL_DNS_FAILED", host=host))

    for raw_ip in addresses:
        try:
            ip = _normalize_ip(raw_ip)
        except ValueError as e:
            raise UnsafeURLError(tr("URL_DNS_BAD_ADDRESS", ip=raw_ip)) from e
        if _is_blocked(ip):
            raise UnsafeURLError(tr("URL_PRIVATE_RESOLVED", host=host, ip=ip))

    # Plain http to a remote host would ship the credential in the clear.
    if parsed.scheme == "http" and not allow_http:
        raise UnsafeURLError(tr("URL_REQUIRES_HTTPS"))

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
    """Safely download a URL within byte limits, validating each redirect hop."""
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