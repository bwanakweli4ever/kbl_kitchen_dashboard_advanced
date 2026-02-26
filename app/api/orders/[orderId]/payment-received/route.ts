import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

function parseUpstreamBody(bodyText: string): Record<string, unknown> {
  if (!bodyText) return {}

  try {
    const parsed = JSON.parse(bodyText)
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : { value: parsed }
  } catch {
    return {
      raw: bodyText.slice(0, 500),
      isHtml: bodyText.trim().startsWith("<!DOCTYPE") || bodyText.trim().startsWith("<html"),
    }
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> | { orderId: string } },
) {
  try {
    const authorization = request.headers.get("authorization")

    if (!authorization) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    // Extract token from "Bearer <token>" format
    const token = authorization.replace("Bearer ", "")

    const { orderId } = await params

    if (!orderId || Number.isNaN(Number(orderId))) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })
    }

    console.log(`Marking payment as received for order ${orderId}`)

    // Kitchen dashboard is admin-facing; use admin orders endpoint first.
    const primaryUrl = `${config.api.baseUrl}/orders/${orderId}/payment-received`
    const fallbackUrl = `${config.api.baseUrl}/api/mobile/orders/${orderId}/payment-received`

    let response = await fetch(primaryUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    // Backward compatibility: some deployments only expose mobile orders payment endpoint.
    if (response.status === 404 || response.status === 405) {
      response = await fetch(fallbackUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
    }

    const responseText = await response.text()
    const responseBody = parseUpstreamBody(responseText)
    console.log("Payment received response:", response.status, responseBody)

    if (response.ok) {
      const data = Object.keys(responseBody).length ? responseBody : { success: true, payment_status: "paid" }
      return NextResponse.json(data)
    } else {
      // Handle specific authentication errors
      if (response.status === 403) {
        console.error("Authentication failed for payment update:", responseBody)
        return NextResponse.json(
          {
            error: "Authentication failed",
            details: "Token may be expired or invalid. Please login again.",
          },
          { status: 401 }
        )
      }
      
      const errorData = responseBody
      const upstreamDetail =
        typeof errorData.detail === "string"
          ? errorData.detail
          : typeof errorData.error === "string"
            ? errorData.error
            : typeof errorData.raw === "string"
              ? errorData.raw
              : "Upstream service returned a non-JSON error"
      
      return NextResponse.json(
        {
          error: "Failed to mark payment as received",
          details: upstreamDetail,
          upstream_status: response.status,
        },
        { status: response.status },
      )
    }
  } catch (error) {
    console.error("Payment update error:", error)
    return NextResponse.json(
      {
        error: "Failed to mark payment as received",
        details: error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 },
    )
  }
}
