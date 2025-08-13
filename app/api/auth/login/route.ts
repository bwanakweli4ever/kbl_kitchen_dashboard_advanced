import { type NextRequest, NextResponse } from "next/server"

// const API_BASE_URL = process.env.WHATSAPP_API_URL || "https://backend.kblbites.com"
const API_BASE_URL = process.env.WHATSAPP_API_URL || "http://localhost:8000"


export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 })
    }

    console.log("Attempting login with API URL:", API_BASE_URL)

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    })

    const responseText = await response.text()
    console.log("API Response:", response.status, responseText)

    if (response.ok) {
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        // If response is not JSON, treat it as the token
        data = { token: responseText, access_token: responseText }
      }

      // Ensure we have a token field
      const token = data.token || data.access_token || responseText

      return NextResponse.json({
        token: token,
        success: true,
      })
    } else {
      console.error("API Error:", response.status, responseText)
      return NextResponse.json(
        {
          error: "Invalid API key or authentication failed",
          details: responseText,
        },
        { status: 401 },
      )
    }
  } catch (error) {
    console.error("Authentication error:", error)
    return NextResponse.json(
      {
        error: "Authentication failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
