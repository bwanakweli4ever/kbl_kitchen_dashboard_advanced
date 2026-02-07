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
    const addonsOnly = searchParams.get("addons_only") === "true"
    const category = searchParams.get("category")

    let apiUrl = `${config.api.baseUrl}/api/ingredients?`
    if (availableOnly) apiUrl += "available_only=true&"
    if (addonsOnly) apiUrl += "addons_only=true&"
    if (category) apiUrl += `category=${encodeURIComponent(category)}&`

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
    console.error("Ingredients API error:", error)
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

    const response = await fetch(`${config.api.baseUrl}/api/ingredients`, {
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
    console.error("Create ingredient error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

