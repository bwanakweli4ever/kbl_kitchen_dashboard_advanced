import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

const API_BASE_URL = process.env.WHATSAPP_API_URL || config.api.baseUrl


export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization")

    if (!authorization) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    const token = authorization.replace("Bearer ", "")

    const url = new URL(request.url)
    const limit = url.searchParams.get("limit") || "50"
    const offset = url.searchParams.get("offset") || "0"

    const apiUrl = `${API_BASE_URL}/customers?limit=${limit}&offset=${offset}`

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    const responseText = await response.text()

    if (response.ok) {
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        data = { customers: [], count: 0 }
      }
      return NextResponse.json(data)
    } else {
      return NextResponse.json(
        {
          error: "Failed to fetch customers",
          details: responseText,
        },
        { status: response.status },
      )
    }
  } catch (error) {
    console.error("Customers fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 })
  }
}
