import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export const runtime = "nodejs"

const BACKEND_URL = config.api.baseUrl.replace(/\/$/, "") // e.g. https://backend.kblbites.com

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

// GET /api/combos  or  GET /api/combos/[id] (passed via query param __id)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const id = searchParams.get("__id")
  const path = id ? `/api/combos/${id}` : `/api/combos?${searchParams.toString().replace(/&?__id=[^&]*/g, "")}`

  try {
    const upstream = await proxyToBackend("GET", path, request.headers.get("authorization"))
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization")
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const upstream = await proxyToBackend("POST", "/api/combos", authorization, body)
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const authorization = request.headers.get("authorization")
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = request.nextUrl.searchParams.get("__id")
  if (!id) return NextResponse.json({ error: "Missing combo id" }, { status: 400 })

  try {
    const body = await request.json()
    const upstream = await proxyToBackend("PUT", `/api/combos/${id}`, authorization, body)
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authorization = request.headers.get("authorization")
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = request.nextUrl.searchParams.get("__id")
  if (!id) return NextResponse.json({ error: "Missing combo id" }, { status: 400 })

  try {
    const upstream = await proxyToBackend("DELETE", `/api/combos/${id}`, authorization)
    if (upstream.status === 204) return new NextResponse(null, { status: 204 })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
