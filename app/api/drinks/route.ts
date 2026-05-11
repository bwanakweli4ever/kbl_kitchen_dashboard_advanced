import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export const runtime = "nodejs"

const BACKEND_URL = config.api.baseUrl.replace(/\/$/, "")

const PROXY_TIMEOUT_MS = Math.max(config.api.timeout, 30000)

async function proxyToBackend(
  method: string,
  path: string,
  authorization: string | null,
  body?: unknown,
): Promise<Response> {
  const url = `${BACKEND_URL}${path}`
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (authorization) headers["Authorization"] = authorization

  return fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
  })
}

async function forwardUpstream(upstream: Response): Promise<NextResponse> {
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 })
  }

  const contentType = upstream.headers.get("content-type") || ""
  const isJson = contentType.includes("application/json")

  if (isJson) {
    try {
      const data = await upstream.json()
      return NextResponse.json(data, { status: upstream.status })
    } catch {
      return NextResponse.json({ error: "Invalid JSON response from backend" }, { status: 502 })
    }
  }

  const text = await upstream.text().catch(() => "")
  return NextResponse.json(
    { error: text || `Backend responded with status ${upstream.status}` },
    { status: upstream.status },
  )
}

// GET /api/drinks
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const query = searchParams.toString()
  const path = query ? `/api/drinks?${query}` : "/api/drinks"

  try {
    const upstream = await proxyToBackend("GET", path, request.headers.get("authorization"))
    return await forwardUpstream(upstream)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const isTimeout = err instanceof Error && err.name === "TimeoutError"
    return NextResponse.json({ error: msg }, { status: isTimeout ? 504 : 500 })
  }
}
