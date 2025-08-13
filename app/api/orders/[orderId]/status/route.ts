import { type NextRequest, NextResponse } from "next/server"

const API_BASE_URL = process.env.WHATSAPP_API_URL || "http://backend.kblbites.com"

export async function PUT(request: NextRequest, { params }: { params: { orderId: string } }) {
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

    const orderId = params.orderId

    console.log(`Updating order ${orderId} to status: ${status}`)

    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
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
