import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const authorization = request.headers.get("authorization")

    if (!authorization) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    // Extract token from "Bearer <token>" format
    const token = authorization.replace("Bearer ", "")

    // Await params for Next.js 15 compatibility
    const { orderId } = await params

    console.log(`Marking payment as received for order ${orderId}`)

    // Use the mobile orders endpoint
    const response = await fetch(`${config.api.baseUrl}/api/mobile/orders/${orderId}/payment-received`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    const responseText = await response.text()
    console.log("Payment received response:", response.status, responseText)

    if (response.ok) {
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        data = { success: true, payment_status: "paid" }
      }
      return NextResponse.json(data)
    } else {
      // Handle specific authentication errors
      if (response.status === 403) {
        console.error("Authentication failed for payment update:", responseText)
        return NextResponse.json(
          {
            error: "Authentication failed",
            details: "Token may be expired or invalid. Please login again.",
          },
          { status: 401 }
        )
      }
      
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch (e) {
        errorData = { error: responseText }
      }
      
      return NextResponse.json(
        {
          error: "Failed to mark payment as received",
          details: errorData.detail || errorData.error || responseText,
        },
        { status: response.status },
      )
    }
  } catch (error) {
    console.error("Payment update error:", error)
    return NextResponse.json({ error: "Failed to mark payment as received" }, { status: 500 })
  }
}
