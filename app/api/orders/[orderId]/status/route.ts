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

    const { status, notify_customer = true, custom_message } = await request.json()

    const requestBody = {
      status,
      notify_customer,
      ...(custom_message && { custom_message }),
    }

    // Await params for Next.js 15 compatibility
    const { orderId } = await params

    console.log(`Updating order ${orderId} to status: ${status}`)

    const response = await fetch(`${config.api.baseUrl}/orders/${orderId}/status`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()
    console.log("Status update response:", response.status, responseText)

    if (response.ok) {
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        data = { success: true }
      }
      return NextResponse.json(data)
    } else {
      // Handle specific authentication errors
      if (response.status === 403) {
        console.error("Authentication failed for order status update:", responseText)
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
          error: "Failed to update order status",
          details: responseText,
        },
        { status: response.status },
      )
    }
  } catch (error) {
    console.error("Status update error:", error)
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 })
  }
}
