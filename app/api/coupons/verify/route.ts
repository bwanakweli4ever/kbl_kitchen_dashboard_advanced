import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export const runtime = "nodejs"

/**
 * POST /api/coupons/verify
 *
 * Kitchen staff can re-verify a coupon claimed in an order against the live
 * Fidloy server. If valid the computed discount is returned so staff can
 * confirm the amount is correct before accepting payment.
 *
 * Body: { code: string, amount: number, phone?: string, email?: string }
 */
export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization")

  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { code?: string; amount?: number; phone?: string; email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { code, amount, phone, email } = body

  if (!code || typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "Coupon code is required" }, { status: 400 })
  }

  if (!amount || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "A positive order amount is required" }, { status: 400 })
  }

  const backendUrl = config.api.baseUrl.replace(/\/$/, "")
  const payload: Record<string, unknown> = {
    code: code.trim().toUpperCase(),
    amount,
  }
  if (phone) payload.phone = phone.trim()
  if (email) payload.email = email.trim()

  try {
    const response = await fetch(`${backendUrl}/api/loyalty/points/coupons/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    })

    let data: Record<string, unknown> = {}
    try {
      data = await response.json()
    } catch {
      data = {}
    }

    if (!response.ok) {
      const detail =
        (data as any)?.detail ||
        (data as any)?.message ||
        `Validation failed (HTTP ${response.status})`
      return NextResponse.json(
        { verified: false, error: String(detail) },
        { status: response.status }
      )
    }

    const couponPayload: Record<string, unknown> =
      data.coupon && typeof data.coupon === "object"
        ? (data.coupon as Record<string, unknown>)
        : data

    const toFloat = (v: unknown): number => {
      if (v === null || v === undefined) return 0
      const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""))
      return Number.isFinite(n) ? n : 0
    }

    const isValid = data.valid === true
    const discountAmount = toFloat(couponPayload.discount_amount)
    const discountPercentage = toFloat(couponPayload.discount_percentage)
    const finalAmount = toFloat(couponPayload.final_amount)

    let effectiveDiscount = 0
    let couponType = "fixed"

    if (discountAmount > 0) {
      effectiveDiscount = discountAmount
      couponType = discountPercentage > 0 ? "percentage" : "fixed"
    } else if (discountPercentage > 0) {
      effectiveDiscount = (amount * discountPercentage) / 100
      couponType = "percentage"
    } else if (finalAmount > 0 && finalAmount < amount) {
      effectiveDiscount = amount - finalAmount
      couponType = "fixed"
    }

    return NextResponse.json({
      verified: isValid && effectiveDiscount > 0,
      valid: isValid,
      code: code.trim().toUpperCase(),
      coupon_type: couponType,
      discount_amount: Math.min(effectiveDiscount, amount),
      discount_percentage: discountPercentage,
      final_amount: isValid ? Math.max(amount - effectiveDiscount, 0) : amount,
      validation_id: data.validation_id ?? null,
      raw: couponPayload,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { verified: false, error: `Server error: ${msg}` },
      { status: 500 }
    )
  }
}
