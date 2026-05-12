import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export const runtime = "nodejs"

const FIDLOY_HOST = "https://api.fidloy.com"
const FIDLOY_API_KEY = process.env.LOYALTY_API_KEY || ""

const toFloat = (v: unknown): number => {
  if (v === null || v === undefined) return 0
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

/**
 * Fetch coupon details directly from Fidloy GET /api/loyalty/coupons/{code}
 * Returns the real discount_percentage as defined on the coupon template.
 */
async function fetchCouponDetails(code: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${FIDLOY_HOST}/api/loyalty/coupons/${encodeURIComponent(code)}`, {
      headers: { Accept: "application/json", "X-API-Key": FIDLOY_API_KEY },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

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

  let body: {
    code?: string
    amount?: number
    phone?: string
    email?: string
    transaction_id?: number
    customer_id?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { code, amount, phone, email, transaction_id, customer_id } = body

  if (!code || typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "Coupon code is required" }, { status: 400 })
  }

  if (!amount || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "A positive order amount is required" }, { status: 400 })
  }

  if (
    transaction_id !== undefined &&
    (typeof transaction_id !== "number" || !Number.isFinite(transaction_id) || transaction_id <= 0)
  ) {
    return NextResponse.json({ error: "transaction_id must be a positive number" }, { status: 400 })
  }

  const normalizedCode = code.trim().toUpperCase()
  const backendUrl = config.api.baseUrl.replace(/\/$/, "")
  const payload: Record<string, unknown> = { code: normalizedCode, amount }
  if (phone) payload.phone = (phone as string).trim()
  if (email) payload.email = (email as string).trim()

  // Fetch real coupon details from Fidloy directly (GET) to get true discount_percentage
  const [validateResponse, couponDetails] = await Promise.allSettled([
    fetch(`${backendUrl}/api/loyalty/points/coupons/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    }),
    // Direct Fidloy GET to get the canonical discount_percentage
    fetchCouponDetails(normalizedCode),
  ])

  // Extract coupon details (canonical source for percentage)
  const details: Record<string, unknown> =
    couponDetails.status === "fulfilled" ? couponDetails.value : {}

  // The real percentage from Fidloy's coupon definition
  const realPercentage = toFloat(details.discount_percentage)
  const couponTemplateName = details.template_name as string | undefined
  const isActive = details.is_active !== false
  const isExpired = details.is_expired === true
  const remainingUses = details.remaining_uses as number | undefined

  try {
    if (validateResponse.status === "rejected") {
      // Validate request failed but we have details — compute from GET data
      if (realPercentage > 0 && isActive && !isExpired) {
        const disc = Math.round((amount * realPercentage) / 100)
        return NextResponse.json({
          verified: true,
          valid: true,
          code: normalizedCode,
          coupon_type: "percentage",
          discount_amount: disc,
          discount_percentage: realPercentage,
          final_amount: Math.max(amount - disc, 0),
          template_name: couponTemplateName,
          remaining_uses: remainingUses,
          validation_id: null,
        })
      }
      throw new Error("Coupon validation request failed")
    }

    const response = validateResponse.value
    let data: Record<string, unknown> = {}
    try { data = await response.json() } catch { data = {} }

    if (!response.ok) {
      const detail =
        (data as any)?.detail || (data as any)?.message ||
        `Validation failed (HTTP ${response.status})`
      return NextResponse.json({ verified: false, error: String(detail) }, { status: response.status })
    }

    const couponPayload: Record<string, unknown> =
      data.coupon && typeof data.coupon === "object"
        ? (data.coupon as Record<string, unknown>)
        : data

    const isValid = data.valid === true

    // Use real percentage from Fidloy GET; fall back to validate response
    const discountPercentage = realPercentage > 0 ? realPercentage : toFloat(couponPayload.discount_percentage)
    const discountAmount = toFloat(couponPayload.discount_amount)
    const finalAmount = toFloat(couponPayload.final_amount)

    let effectiveDiscount = 0
    let couponType = "fixed"

    if (discountAmount > 0) {
      effectiveDiscount = discountAmount
      couponType = discountPercentage > 0 ? "percentage" : "fixed"
    } else if (discountPercentage > 0) {
      effectiveDiscount = Math.round((amount * discountPercentage) / 100)
      couponType = "percentage"
    } else if (finalAmount > 0 && finalAmount < amount) {
      effectiveDiscount = amount - finalAmount
      couponType = "fixed"
    }

    const shouldRedeem = Boolean(transaction_id && transaction_id > 0)
    let redeemed = false
    let redeemError: string | undefined
    let redeemResult: Record<string, unknown> = {}

    if (isValid && effectiveDiscount > 0 && shouldRedeem) {
      try {
        const redeemPayload: Record<string, unknown> = {
          code: normalizedCode,
          transaction_id,
          amount,
          validation_id: data.validation_id ?? undefined,
        }
        if (phone) redeemPayload.phone = (phone as string).trim()
        if (email) redeemPayload.email = (email as string).trim()
        if (typeof customer_id === "number" && Number.isFinite(customer_id) && customer_id > 0) {
          redeemPayload.customer_id = customer_id
        }

        const redeemResponse = await fetch(`${backendUrl}/api/loyalty/points/coupons/redeem`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: authorization,
          },
          body: JSON.stringify(redeemPayload),
          signal: AbortSignal.timeout(12000),
        })

        let redeemData: Record<string, unknown> = {}
        try { redeemData = await redeemResponse.json() } catch { redeemData = {} }

        if (!redeemResponse.ok) {
          redeemError =
            (redeemData as any)?.detail ||
            (redeemData as any)?.error ||
            (redeemData as any)?.message ||
            `Redeem failed (HTTP ${redeemResponse.status})`
        } else {
          redeemed = true
          redeemResult = redeemData
        }
      } catch (redeemErr: unknown) {
        redeemError = redeemErr instanceof Error ? redeemErr.message : String(redeemErr)
      }
    }

    return NextResponse.json({
      verified: isValid && effectiveDiscount > 0,
      valid: isValid,
      code: normalizedCode,
      coupon_type: couponType,
      discount_amount: Math.min(effectiveDiscount, amount),
      discount_percentage: discountPercentage,
      final_amount: isValid ? Math.max(amount - effectiveDiscount, 0) : amount,
      template_name: couponTemplateName,
      remaining_uses: remainingUses,
      validation_id: data.validation_id ?? null,
      redeemed,
      redeem_error: redeemError,
      redeem_result: redeemResult,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ verified: false, error: `Server error: ${msg}` }, { status: 500 })
  }
}
