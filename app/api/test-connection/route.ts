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
    
    // Make an authenticated request to test the token
    const response = await fetch(`${config.api.baseUrl}/orders?limit=1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

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
  } catch (error) {
    console.error("❌ Test connection error:", error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      backendUrl: config.api.baseUrl,
      message: "Failed to connect to backend"
    }, { status: 500 })
  }
}
