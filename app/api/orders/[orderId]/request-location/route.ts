import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

const API_BASE_URL = process.env.WHATSAPP_API_URL || config.api.baseUrl

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
    try {
    const authorization = request.headers.get("authorization")

    if (!authorization) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    const token = authorization.replace("Bearer ", "")
    // Await params for Next.js 15 compatibility
    const { orderId } = await params

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    console.log("📍 Requesting location for order:", orderId)

    // First, get the order details to get customer phone number
    const orderResponse = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text()
      console.error("❌ Failed to fetch order:", orderResponse.status, errorText)
      return NextResponse.json(
        { error: "Failed to fetch order details" },
        { status: orderResponse.status }
      )
    }

    const order = await orderResponse.json()
    const phoneNumber = order.wa_id

    if (!phoneNumber) {
      return NextResponse.json({ error: "Customer phone number not found" }, { status: 400 })
    }

    // Get location request message from backend
    // We'll use the messages endpoint to send it
    const locationRequestMessage = `📍 **Location Required for Delivery**

We need your delivery location to process your order.

**✅ How to Share Your Location:**
1. Tap the 📎 attachment icon (paperclip)
2. Select "Location" 
3. Choose "Share Live Location" or "Send Your Current Location"

**✅ Accepted Location Formats:**
• 📍 Share location via WhatsApp (recommended - tap 📎 → Location)
• 📝 Text description with address details:
  - "KG 123 ST, Kigali"
  - "Downtown shopping area, near Kigali City Tower"
  - "Office building at door 12, KG Avenue"
  - "Send to my office downtown"

**❌ Not Accepted:**
• Questions (e.g., "what is this?")
• Greetings (e.g., "hello", "hi")
• Very short text without location details

Please share your location using the 📎 button, or provide a detailed address description. 🚚`

    // Send the message
    const response = await fetch(`${API_BASE_URL}/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        message: locationRequestMessage,
      }),
    })

    const responseText = await response.text()
    console.log("📤 Request location response:", response.status, responseText)

    if (response.ok) {
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        data = { success: true, message: "Location request sent successfully" }
      }
      return NextResponse.json({
        success: true,
        message: "Location request sent to customer",
        order_id: orderId,
        customer_notified: true,
      })
    } else {
      console.error("❌ Request location error:", response.status, responseText)
      return NextResponse.json(
        {
          error: "Failed to send location request",
          details: responseText,
          status: response.status,
        },
        { status: response.status }
      )
    }
  } catch (error) {
    console.error("💥 Request location error:", error)
    return NextResponse.json(
      {
        error: "Failed to send location request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

