import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Next.js Route Handler compliant with Vercel AI SDK Data Stream Protocol.
 * Bridges frontend useChat / AI components with the FastAPI backend (/api/chat).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = req.headers.get("authorization") || "";

    const backendBase = (process.env.INTERNAL_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");
    const targetUrl = `${backendBase}/chat`;

    // Map Vercel AI SDK standard message history to backend format if needed
    let messageText = body.message || "";
    if (!messageText && Array.isArray(body.messages) && body.messages.length > 0) {
      const lastMsg = body.messages[body.messages.length - 1];
      if (lastMsg.role === "user") {
        messageText = lastMsg.content;
      }
    }

    const payload = {
      message: messageText,
      conversation_id: body.conversation_id || null,
      model: body.model || null,
      temperature: body.temperature ?? null,
      memory_enabled: body.memory_enabled ?? true,
      web_search_mode: body.web_search_mode || "auto",
      attachments: body.attachments || [],
    };

    const upstreamResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify(payload),
    });

    if (!upstreamResponse.ok) {
      const errText = await upstreamResponse.text();
      return new Response(errText || "Upstream failure", { status: upstreamResponse.status });
    }

    const upstreamBody = upstreamResponse.body;
    if (!upstreamBody) {
      return new Response("No response body", { status: 500 });
    }

    // Set up transform stream to pipe FastAPI SSE events to client with Vercel stream headers
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstreamBody.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const textChunk = decoder.decode(value, { stream: true });
            controller.enqueue(encoder.encode(textChunk));
          }
          controller.close();
        } catch (streamErr) {
          controller.error(streamErr);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "x-vercel-ai-data-stream": "v1",
      },
    });
  } catch (err: any) {
    console.error("Vercel AI SDK chat route error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
