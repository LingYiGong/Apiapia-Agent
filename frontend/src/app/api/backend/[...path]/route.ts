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

  try {
    const res = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? req.body : undefined,
      // @ts-ignore - duplex is needed in Node.js fetch with body stream
      duplex: "half",
    });

    const responseHeaders = new Headers(res.headers);
    // Explicitly disable buffering for streaming responses
    responseHeaders.set("X-Accel-Buffering", "no");
    responseHeaders.set("Cache-Control", "no-cache, no-transform");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
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
