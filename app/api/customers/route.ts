import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

const API_BASE_URL = process.env.WHATSAPP_API_URL || config.api.baseUrl
const CUSTOMER_CACHE_TTL_MS = 2 * 60 * 1000
const customerResponseCache = new Map<string, { data: any; at: number }>()


export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization")

    if (!authorization) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    const token = authorization.replace("Bearer ", "")

    const url = new URL(request.url)
    const limit = url.searchParams.get("limit") || "50"
    const offset = url.searchParams.get("offset") || "0"

    const cacheKey = `${limit}|${offset}`
    const cached = customerResponseCache.get(cacheKey)
    if (cached && Date.now() - cached.at <= CUSTOMER_CACHE_TTL_MS) {
      return NextResponse.json(cached.data)
    }

    const apiUrl = `${API_BASE_URL}/customers/?limit=${limit}&offset=${offset}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), Math.max(12000, config.api.timeout))

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const responseText = await response.text()

    if (response.ok) {
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        data = { customers: [], count: 0 }
      }
      customerResponseCache.set(cacheKey, { data, at: Date.now() })
      return NextResponse.json(data)
    } else {
      if (cached) {
        return NextResponse.json(cached.data)
      }
      return NextResponse.json(
        {
          error: "Failed to fetch customers",
          details: responseText,
        },
        { status: response.status },
      )
    }
  } catch (error) {
    console.error("Customers fetch error:", error)
    const url = new URL(request.url)
    const limit = url.searchParams.get("limit") || "50"
    const offset = url.searchParams.get("offset") || "0"
    const cacheKey = `${limit}|${offset}`
    const cached = customerResponseCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached.data)
    }
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 })
  }
}
