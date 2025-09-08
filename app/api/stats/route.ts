import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

const API_BASE_URL = process.env.WHATSAPP_API_URL || config.api.baseUrl

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization")

    if (!authorization) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    const token = authorization.replace("Bearer ", "")

    const response = await fetch(`${API_BASE_URL}/orders/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    const responseText = await response.text()

    if (response.ok) {
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        data = { total_orders: 0, total_revenue: 0, avg_order_value: 0, active_orders: 0 }
      }
      return NextResponse.json(data)
    } else {
      return NextResponse.json(
        {
          error: "Failed to fetch statistics",
          details: responseText,
        },
        { status: response.status },
      )
    }
  } catch (error) {
    console.error("Stats fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch statistics" }, { status: 500 })
  }
}
