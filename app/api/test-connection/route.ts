import { NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization")
    
    if (!authorization) {
      console.log("❌ No authorization header in test-connection")
      return NextResponse.json({ 
        success: false, 
        error: "No authorization header" 
      }, { status: 401 })
    }

    const token = authorization.replace("Bearer ", "")
    
    if (!token) {
      console.log("❌ No token in authorization header")
      return NextResponse.json({ 
        success: false, 
        error: "Invalid token format" 
      }, { status: 401 })
    }

    console.log("🧪 Testing token validation with:", config.api.baseUrl)
    
    // Add timeout and better error handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.api.timeout)
    
    try {
      // Make an authenticated request to test the token
      const response = await fetch(`${config.api.baseUrl}/orders?limit=1`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      console.log("📡 Token validation response status:", response.status)
      
      if (response.ok) {
        return NextResponse.json({
          success: true,
          status: response.status,
          backendUrl: config.api.baseUrl,
          message: "Token is valid and backend is reachable"
        })
      } else if (response.status === 401 || response.status === 403) {
        console.log("❌ Token validation failed:", response.status)
        return NextResponse.json({
          success: false,
          status: response.status,
          backendUrl: config.api.baseUrl,
          message: "Token is invalid or expired"
        }, { status: 401 })
      } else {
        return NextResponse.json({
          success: false,
          status: response.status,
          backendUrl: config.api.baseUrl,
          message: `Backend responded with status ${response.status}`
        }, { status: response.status })
      }
    } catch (fetchError) {
      clearTimeout(timeoutId)
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error("❌ Request timeout:", config.api.timeout + "ms")
        return NextResponse.json({
          success: false,
          error: "Request timeout",
          backendUrl: config.api.baseUrl,
          message: `Backend did not respond within ${config.api.timeout}ms`
        }, { status: 408 })
      }
      
      throw fetchError // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error("❌ Test connection error:", error)
    
    // Check if it's a connection error
    const isConnectionError = error instanceof Error && (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('fetch failed')
    )
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      backendUrl: config.api.baseUrl,
      message: isConnectionError 
        ? "Cannot connect to backend server. Please ensure the backend is running on " + config.api.baseUrl
        : "Failed to connect to backend",
      connectionError: isConnectionError
    }, { status: 503 }) // Service Unavailable for connection issues
  }
}
