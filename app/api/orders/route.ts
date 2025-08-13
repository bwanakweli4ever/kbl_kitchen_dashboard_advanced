import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

// Very generous rate limiting for kitchen display
const requestTracker = new Map<string, { count: number; firstRequest: number }>()
const RATE_LIMIT_WINDOW = 300000 // 5 minutes
const MAX_REQUESTS_PER_WINDOW = 50 // Very generous

// Clean up old entries
setInterval(() => {
  const now = Date.now()
  for (const [key, data] of requestTracker.entries()) {
    if (now - data.firstRequest > RATE_LIMIT_WINDOW) {
      requestTracker.delete(key)
    }
  }
}, RATE_LIMIT_WINDOW)

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization")

    if (!authorization) {
      console.log("❌ No authorization header")
      return NextResponse.json({ orders: [], count: 0 }, { status: 401 })
    }

    const token = authorization.replace("Bearer ", "")

    // Track requests but be very generous
    const clientId = token.substring(0, 10)
    const now = Date.now()
    const clientData = requestTracker.get(clientId)

    if (clientData) {
      if (now - clientData.firstRequest < RATE_LIMIT_WINDOW) {
        if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
          // Silently slow down instead of blocking
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
        clientData.count++
      } else {
        requestTracker.set(clientId, { count: 1, firstRequest: now })
      }
    } else {
      requestTracker.set(clientId, { count: 1, firstRequest: now })
    }

    const url = new URL(request.url)
    const limit = url.searchParams.get("limit") || config.dashboard.maxOrders.toString()
    const offset = url.searchParams.get("offset") || "0"
    const status = url.searchParams.get("status")

    let apiUrl = `${config.api.baseUrl}/orders?limit=${limit}&offset=${offset}`
    if (status) {
      apiUrl += `&status=${status}`
    }

    console.log("🔄 Fetching from:", apiUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.api.timeout)

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    console.log("📡 External API response:", response.status)

    if (response.ok) {
      const responseText = await response.text()
      console.log("📦 Raw response:", responseText.substring(0, 200) + "...")

      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        console.log("⚠️ JSON parse error, returning empty data")
        return NextResponse.json({ orders: [], count: 0, total_count: 0 })
      }

      // Ensure consistent response format
      const responseData = {
        orders: data.orders || data || [],
        count: data.count || (data.orders ? data.orders.length : Array.isArray(data) ? data.length : 0),
        total_count: data.total_count || data.count || 0,
      }

      console.log("✅ Returning", responseData.orders.length, "orders")
      return NextResponse.json(responseData)
    } else {
      console.log("❌ External API error:", response.status)
      // Return empty data instead of errors for kitchen display
      return NextResponse.json({ orders: [], count: 0, total_count: 0 })
    }
  } catch (error) {
    console.error("❌ API route error:", error)
    // Always return empty data instead of errors for kitchen display
    return NextResponse.json({ orders: [], count: 0, total_count: 0 })
  }
}
