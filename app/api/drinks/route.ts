import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export const runtime = "nodejs"

const BACKEND_URL = config.api.baseUrl.replace(/\/$/, "")

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
    signal: AbortSignal.timeout(15000),
  })
}

// GET /api/drinks
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const path = `/api/drinks?${searchParams.toString()}`

  try {
    const upstream = await proxyToBackend("GET", path, request.headers.get("authorization"))
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
