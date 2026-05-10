import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const authorization = request.headers.get("authorization")
  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orderId } = await params
  if (!orderId || isNaN(Number(orderId))) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })
  }

  const backendUrl = config.api.baseUrl.replace(/\/$/, "")
  try {
    const response = await fetch(`${backendUrl}/api/orders/${orderId}`, {
      headers: {
        Authorization: authorization,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    })

    let data: Record<string, unknown> = {}
    try {
      data = await response.json()
    } catch {
      data = {}
    }

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    const rawMessage = typeof data.raw_message === "string" ? data.raw_message : ""
    const extractMeta = (key: string): string | null => {
      const eqMatch = rawMessage.match(new RegExp(`${key}\\s*=\\s*([^|\\s]+)`, "i"))
      if (eqMatch) return eqMatch[1].trim()

      const colonMatch = rawMessage.match(new RegExp(`${key}\\s*:\\s*([^\\n\\r]+)`, "i"))
      if (colonMatch) return colonMatch[1].trim()

      return null
    }
    const couponCode = extractMeta("coupon_code")
    const rawDiscount = extractMeta("coupon_discount_amount") || extractMeta("coupon_discount")
    const discountMatch = rawDiscount?.match(/-?[\d,]+(?:\.\d+)?/)
    const couponDiscount = discountMatch ? Math.abs(parseFloat(discountMatch[0].replace(/,/g, ""))) : null
    const couponRedeemStatus = extractMeta("coupon_redeem_status")

    return NextResponse.json({
      ...data,
      coupon_code: couponCode,
      coupon_discount_amount: Number.isFinite(couponDiscount) ? couponDiscount : null,
      coupon_redeem_status: couponRedeemStatus,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 })
  }
}
