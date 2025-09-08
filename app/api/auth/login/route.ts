import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

const API_BASE_URL = process.env.WHATSAPP_API_URL || config.api.baseUrl


export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 })
    }

    console.log("🔐 Attempting login with API URL:", API_BASE_URL)
    console.log("🔑 API Key provided:", apiKey ? "Yes" : "No")

    // Add timeout and better error handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.api.timeout)

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    const responseText = await response.text()
    console.log("📡 API Response Status:", response.status)
    console.log("📡 API Response Body:", responseText)

    if (response.ok) {
      let data
      try {
        data = JSON.parse(responseText)
        console.log("✅ Parsed JSON response:", data)
      } catch (e) {
        console.log("⚠️ Response is not JSON, treating as token")
        // If response is not JSON, treat it as the token
        data = { token: responseText, access_token: responseText }
      }

      // Ensure we have a token field
      const token = data.token || data.access_token || responseText
      console.log("🎫 Extracted token:", token ? "Present" : "Missing")

      if (!token) {
        return NextResponse.json(
          {
            error: "No token received from server",
            details: "Server response did not contain a valid token",
          },
          { status: 401 },
        )
      }

      return NextResponse.json({
        token: token,
        success: true,
      })
    } else {
      console.error("❌ API Error:", response.status, responseText)
      return NextResponse.json(
        {
          error: "Invalid API key or authentication failed",
          details: responseText,
          status: response.status,
        },
        { status: 401 },
      )
    }
  } catch (error) {
    console.error("💥 Authentication error:", error)
    
    // Check if it's a connection error
    const isConnectionError = error instanceof Error && (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('fetch failed') ||
      error.name === 'AbortError'
    )

    return NextResponse.json(
      {
        error: isConnectionError ? "Cannot connect to backend server" : "Authentication failed",
        details: error instanceof Error ? error.message : "Unknown error",
        connectionError: isConnectionError,
        backendUrl: API_BASE_URL,
      },
      { status: isConnectionError ? 503 : 500 },
    )
  }
}
