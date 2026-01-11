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
    const category = searchParams.get("category")

    // Remove trailing slash from baseUrl and ensure proper URL construction
    const baseUrl = config.api.baseUrl.replace(/\/$/, '')
    let apiUrl = `${baseUrl}/api/products`
    const params = new URLSearchParams()
    if (availableOnly) params.append("available_only", "true")
    if (category) params.append("category", category)
    if (params.toString()) {
      apiUrl += `?${params.toString()}`
    }

    console.log("Fetching products from:", apiUrl)

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    console.log("Products API response status:", response.status)

    if (response.ok) {
      const data = await response.json()
      console.log("Products API returned:", data?.length || 0, "products")
      return NextResponse.json(data)
    } else if (response.status === 404) {
      // 404 means the endpoint doesn't exist - backend needs to be deployed
      console.error("Products API endpoint not found (404). Backend may need to be deployed.")
      return NextResponse.json({ 
        error: "Not Found",
        message: "Products API endpoint not available. The backend server needs to be updated with the latest code that includes the /api/products endpoint.",
        hint: "Please deploy the updated backend code or check if the server is running with the latest version."
      }, { status: 404 })
    } else {
      const errorText = await response.text()
      console.error("Products API error:", response.status, errorText)
      // Return more detailed error information
      try {
        const errorJson = JSON.parse(errorText)
        return NextResponse.json({ 
          error: errorJson.detail || errorJson.error || errorText,
          status: response.status
        }, { status: response.status })
      } catch {
        return NextResponse.json({ 
          error: errorText || "Unknown error",
          status: response.status
        }, { status: response.status })
      }
    }
  } catch (error) {
    console.error("Products API network error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ 
      error: "Network error", 
      details: errorMessage 
    }, { status: 500 })
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

    const baseUrl = config.api.baseUrl.replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/api/products`, {
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
    console.error("Create product error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

