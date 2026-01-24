import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const authorization = request.headers.get("authorization")

    if (!authorization) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    // Extract token from "Bearer <token>" format
    const token = authorization.replace("Bearer ", "")

    const { rider_name, rider_phone, notify_customer = false } = await request.json()

    const requestBody = {
      rider_name,
      rider_phone,
      notify_customer,
    }

    // Await params for Next.js 15 compatibility
    const { orderId } = await params

    console.log(`Assigning rider to order ${orderId}:`, requestBody)

    const response = await fetch(`${config.api.baseUrl}/orders/${orderId}/rider`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()
    console.log("Rider assignment response:", response.status, responseText)

    if (response.ok) {
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        data = { success: true }
      }
      return NextResponse.json(data)
    }

    if (response.status === 403) {
      console.error("Authentication failed for rider assignment:", responseText)
      return NextResponse.json(
        {
          error: "Authentication failed",
          details: "Token may be expired or invalid. Please login again.",
        },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        error: "Failed to assign rider",
        details: responseText,
      },
      { status: response.status }
    )
  } catch (error) {
    console.error("Rider assignment error:", error)
    return NextResponse.json({ error: "Failed to assign rider" }, { status: 500 })
  }
}
