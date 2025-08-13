import { NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function GET() {
  try {
    console.log("🧪 Testing connection to:", config.api.baseUrl)
    
    const response = await fetch(`${config.api.baseUrl}/orders?limit=5`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // No auth for test
    })

    console.log("📡 Test response status:", response.status)
    
    if (response.ok) {
      const data = await response.text()
      console.log("📦 Test response data:", data.substring(0, 200) + "...")
      
      return NextResponse.json({
        success: true,
        status: response.status,
        backendUrl: config.api.baseUrl,
        dataPreview: data.substring(0, 200) + "...",
        message: "Backend is reachable"
      })
    } else {
      return NextResponse.json({
        success: false,
        status: response.status,
        backendUrl: config.api.baseUrl,
        message: `Backend responded with status ${response.status}`
      })
    }
  } catch (error) {
    console.error("❌ Test connection error:", error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      backendUrl: config.api.baseUrl,
      message: "Failed to connect to backend"
    })
  }
}
