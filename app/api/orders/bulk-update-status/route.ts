import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function PUT(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization")

    if (!authorization) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    // Extract token from "Bearer <token>" format
    const token = authorization.replace("Bearer ", "")

    const { from_status, to_status, notify_customers = false } = await request.json()

    if (!from_status || !to_status) {
      return NextResponse.json(
        { error: "from_status and to_status are required" },
        { status: 400 }
      )
    }

    console.log(`Bulk updating orders from ${from_status} to ${to_status}`)

    const response = await fetch(`${config.api.baseUrl}/orders/bulk-update-status`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_status,
        to_status,
        notify_customers,
      }),
    })

    const responseText = await response.text()
    console.log("Bulk update response:", response.status, responseText)

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
        console.error("Authentication failed for bulk status update:", responseText)
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
          error: "Failed to bulk update order statuses",
          details: responseText,
        },
        { status: response.status },
      )
    }
  } catch (error) {
    console.error("Bulk update error:", error)
    return NextResponse.json({ error: "Failed to bulk update order statuses" }, { status: 500 })
  }
}


