import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

const API_BASE_URL = process.env.WHATSAPP_API_URL || config.api.baseUrl


export async function POST(request: NextRequest) {
  // Ensure API_BASE_URL doesn't have trailing slash
  const baseUrl = API_BASE_URL.replace(/\/$/, '')
  const loginUrl = `${baseUrl}/auth/login`
  
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 })
    }
    
    console.log("🔐 Login attempt:", {
      url: loginUrl,
      apiKeyLength: apiKey.length,
      apiKeyPrefix: apiKey.substring(0, 4) + "..."
    })

    // Add timeout and better error handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.api.timeout)

    const response = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "x-api-key": apiKey.trim(),
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    const responseText = await response.text()

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
      console.error("❌ API Error:", {
        status: response.status,
        statusText: response.statusText,
        url: loginUrl,
        responseText: responseText.substring(0, 200)
      })
      
      // Handle 404 specifically
      if (response.status === 404) {
        return NextResponse.json(
          {
            error: "API endpoint not found",
            details: `The login endpoint was not found at ${loginUrl}. Please check your API URL configuration.`,
            status: response.status,
            url: loginUrl,
            backendUrl: API_BASE_URL,
          },
          { status: 404 },
        )
      }
      
      return NextResponse.json(
        {
          error: response.status === 401 ? "Invalid API key" : "Authentication failed",
          details: responseText,
          status: response.status,
          url: loginUrl,
        },
        { status: response.status },
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
        attemptedUrl: loginUrl || `${API_BASE_URL}/auth/login`,
      },
      { status: isConnectionError ? 503 : 500 },
    )
  }
}
