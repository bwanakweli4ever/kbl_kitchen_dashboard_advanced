import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization")
    if (!authorization) {
      return NextResponse.json({ error: "Missing authorization" }, { status: 401 })
    }

    const upstream = await fetch(`${config.api.baseUrl}/api/stream/events`, {
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "SSE upstream unavailable" }, { status: upstream.status || 502 })
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
    return NextResponse.json({ error: "SSE proxy error" }, { status: 500 })
  }
}
