import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch(`${config.api.baseUrl}/api/device-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      const text = await response.text()
      let data: unknown
      try { data = JSON.parse(text) } catch { data = { message: text } }

      return NextResponse.json(data, { status: response.status })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json({ error: "Request timeout" }, { status: 408 })
      }
      throw fetchError
    }
  } catch (error) {
    console.error("device-tokens proxy error:", error)
    return NextResponse.json({ error: "Proxy error" }, { status: 502 })
  }
}
