import { NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization")
    if (!authorization) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authorization.replace("Bearer ", "")
    const { searchParams } = new URL(request.url)
    const availableOnly = searchParams.get("available_only") === "true"
    const productId = searchParams.get("product_id")
    const includeIngredients = searchParams.get("include_ingredients") !== "false"

    let apiUrl = `${config.api.baseUrl}/api/presets?`
    if (availableOnly) apiUrl += "available_only=true&"
    if (productId) apiUrl += `product_id=${productId}&`
    if (includeIngredients) apiUrl += "include_ingredients=true&"

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (response.ok) {
      const data = await response.json()
      return NextResponse.json(data)
    } else {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }
  } catch (error) {
    console.error("Presets API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization")
    if (!authorization) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authorization.replace("Bearer ", "")
    const body = await request.json()

    const response = await fetch(`${config.api.baseUrl}/api/presets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (response.ok) {
      const data = await response.json()
      return NextResponse.json(data)
    } else {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }
  } catch (error) {
    console.error("Create preset error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

