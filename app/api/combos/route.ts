import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export const runtime = "nodejs"

const BACKEND_URL = config.api.baseUrl.replace(/\/$/, "") // e.g. https://backend.kblbites.com
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
      return NextResponse.json(
        { error: "Invalid JSON response from backend" },
        { status: 502 },
      )
    }
  }

  const text = await upstream.text().catch(() => "")
  return NextResponse.json(
    {
      error: text || `Backend responded with status ${upstream.status}`,
      status: upstream.status,
    },
    { status: upstream.status },
  )
}

// GET /api/combos  or  GET /api/combos/[id] (passed via query param __id)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const id = searchParams.get("__id")
  
  let path: string
  if (id) {
    path = `/api/combos/${id}`
  } else {
    // Remove __id parameter before passing to backend
    const params = new URLSearchParams(searchParams)
    params.delete("__id")
    const queryString = params.toString()
    path = queryString ? `/api/combos?${queryString}` : "/api/combos"
  }

  try {
    const upstream = await proxyToBackend("GET", path, request.headers.get("authorization"))
    return await forwardUpstream(upstream)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const isTimeout = err instanceof Error && err.name === "TimeoutError"
    return NextResponse.json({ error: msg }, { status: isTimeout ? 504 : 500 })
  }
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization")
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const upstream = await proxyToBackend("POST", "/api/combos", authorization, body)
    return await forwardUpstream(upstream)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const isTimeout = err instanceof Error && err.name === "TimeoutError"
    return NextResponse.json({ error: msg }, { status: isTimeout ? 504 : 500 })
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
    return await forwardUpstream(upstream)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const isTimeout = err instanceof Error && err.name === "TimeoutError"
    return NextResponse.json({ error: msg }, { status: isTimeout ? 504 : 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authorization = request.headers.get("authorization")
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = request.nextUrl.searchParams.get("__id")
  if (!id) return NextResponse.json({ error: "Missing combo id" }, { status: 400 })

  try {
    const upstream = await proxyToBackend("DELETE", `/api/combos/${id}`, authorization)
    return await forwardUpstream(upstream)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const isTimeout = err instanceof Error && err.name === "TimeoutError"
    return NextResponse.json({ error: msg }, { status: isTimeout ? 504 : 500 })
  }
}
