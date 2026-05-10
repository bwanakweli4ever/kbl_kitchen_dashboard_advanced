import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

const API_BASE_URL = process.env.WHATSAPP_API_URL || config.api.baseUrl
const LOGIN_TIMEOUT_MS = Math.max(config.api.timeout, 25000)

async function postLogin(url: string, apiKey: string, timeoutMs: number) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey.trim(),
        "Content-Type": "application/json",
        accept: "application/json",
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}


export async function POST(request: NextRequest) {
  // Ensure API_BASE_URL doesn't have trailing slash
  const baseUrl = API_BASE_URL.replace(/\/$/, '')
  const loginUrl = `${baseUrl}/auth/login`
  const loginUrlWithSlash = `${baseUrl}/auth/login/`
  
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

    // Try canonical endpoint first, then trailing-slash variant to avoid redirect costs.
    // If first call times out or fails at gateway level, retry once on alternate path.
    let response = await postLogin(loginUrl, apiKey, LOGIN_TIMEOUT_MS)
    if ([307, 308, 502, 503, 504].includes(response.status)) {
      response = await postLogin(loginUrlWithSlash, apiKey, LOGIN_TIMEOUT_MS)
    }
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
    const errorName = error instanceof Error ? error.name : "UnknownError"
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("💥 Authentication error:", { name: errorName, message: errorMessage, url: loginUrl })
    
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
        details: errorMessage,
        connectionError: isConnectionError,
        backendUrl: API_BASE_URL,
        attemptedUrl: loginUrl || `${API_BASE_URL}/auth/login`,
      },
      { status: isConnectionError ? 503 : 500 },
    )
  }
}
