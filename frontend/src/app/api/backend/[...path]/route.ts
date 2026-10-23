import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function proxyRequest(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const resolvedParams = await Promise.resolve(params);
  const pathParts = resolvedParams?.path || [];
  const path = Array.isArray(pathParts) ? pathParts.join("/") : pathParts;

  const backendBase = (process.env.INTERNAL_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");
  const { search } = new URL(req.url);
  const targetUrl = `${backendBase}/${path}${search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  const abortController = new AbortController();
  const onClientAbort = () => {
    try {
      abortController.abort();
    } catch (_) {}
  };
  if (req.signal.aborted) {
    onClientAbort();
  } else {
    req.signal.addEventListener("abort", onClientAbort, { once: true });
  }

  try {
    const res = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? req.body : undefined,
      signal: abortController.signal,
      // @ts-ignore - duplex is needed in Node.js fetch with body stream
      duplex: "half",
    });

    const responseHeaders = new Headers(res.headers);
    // Explicitly disable buffering for streaming responses
    responseHeaders.set("X-Accel-Buffering", "no");
    responseHeaders.set("Cache-Control", "no-cache, no-transform");

    const upstreamBody = res.body;
    if (!upstreamBody) {
      req.signal.removeEventListener("abort", onClientAbort);
      return new Response(null, {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
      });
    }

    const reader = upstreamBody.getReader();
    const abortUpstream = () => {
      try {
        abortController.abort();
      } catch (_) {}
      try {
        void reader.cancel();
      } catch (_) {}
    };
    req.signal.removeEventListener("abort", onClientAbort);
    if (req.signal.aborted) {
      abortUpstream();
    } else {
      req.signal.addEventListener("abort", abortUpstream, { once: true });
    }

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            req.signal.removeEventListener("abort", abortUpstream);
            controller.close();
            return;
          }
          if (value) {
            controller.enqueue(value);
          }
        } catch (err) {
          req.signal.removeEventListener("abort", abortUpstream);
          if (req.signal.aborted || abortController.signal.aborted) {
            try {
              controller.close();
            } catch (_) {}
            return;
          }
          controller.error(err);
        }
      },
      cancel() {
        req.signal.removeEventListener("abort", abortUpstream);
        abortUpstream();
      },
    });

    return new Response(stream, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    req.signal.removeEventListener("abort", onClientAbort);
    if (error?.name === "AbortError" || req.signal.aborted || abortController.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    console.error("Backend proxy error:", targetUrl, error);
    return new Response(
      JSON.stringify({ detail: `Proxy failure to backend: ${error?.message || error}` }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
export const OPTIONS = proxyRequest;
