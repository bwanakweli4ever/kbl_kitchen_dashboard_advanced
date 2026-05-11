import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export const runtime = "nodejs"

function fallbackEventStream(eventName: string, message: string) {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify({ message })}\n\n`)
      )
      controller.close()
    },
  })

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization")
    if (!authorization) {
      // Keep SSE clients from surfacing hard network errors when auth is missing.
      return fallbackEventStream("stream_error", "missing_authorization")
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), Math.max(12000, config.api.timeout))

    let upstream: Response
    try {
      upstream = await fetch(`${config.api.baseUrl}/api/stream/events`, {
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!upstream.ok || !upstream.body) {
      return fallbackEventStream("stream_retry", `upstream_unavailable_${upstream.status || 502}`)
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    return fallbackEventStream("stream_retry", "proxy_error")
  }
}
