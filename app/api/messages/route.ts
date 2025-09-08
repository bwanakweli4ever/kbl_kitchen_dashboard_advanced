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
    const wa_id = url.searchParams.get("wa_id")
    const message_type = url.searchParams.get("message_type")
    const is_order = url.searchParams.get("is_order")

    let apiUrl = `${API_BASE_URL}/messages/?limit=${limit}&offset=${offset}`
    if (wa_id) apiUrl += `&wa_id=${wa_id}`
    if (message_type) apiUrl += `&message_type=${message_type}`
    if (is_order) apiUrl += `&is_order=${is_order}`

    console.log("📨 Fetching messages from:", apiUrl)

    // Add timeout and better error handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.api.timeout)

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    const responseText = await response.text()
    console.log("📨 Messages API Response:", response.status, responseText.substring(0, 200) + "...")

    if (response.ok) {
      let data
      try {
        data = JSON.parse(responseText)
        console.log("✅ Messages fetched successfully:", data.messages?.length || 0, "messages")
      } catch (e) {
        console.log("⚠️ Messages response is not JSON, using empty array")
        data = { messages: [], count: 0 }
      }
      return NextResponse.json(data)
    } else {
      console.error("❌ Messages API Error:", response.status, responseText)
      return NextResponse.json(
        {
          error: "Failed to fetch messages",
          details: responseText,
          status: response.status,
        },
        { status: response.status },
      )
    }
  } catch (error) {
    console.error("💥 Messages fetch error:", error)
    
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
        error: isConnectionError ? "Cannot connect to backend server" : "Failed to fetch messages",
        details: error instanceof Error ? error.message : "Unknown error",
        connectionError: isConnectionError,
        backendUrl: API_BASE_URL,
      },
      { status: isConnectionError ? 503 : 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization")

    if (!authorization) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    const token = authorization.replace("Bearer ", "")
    const { phone_number, message } = await request.json()

    if (!phone_number || !message) {
      return NextResponse.json({ error: "Phone number and message are required" }, { status: 400 })
    }

    console.log("📤 Sending message to:", phone_number, "Message:", message.substring(0, 50) + "...")

    // Add timeout and better error handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.api.timeout)

    const response = await fetch(`${API_BASE_URL}/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_number,
        message,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    const responseText = await response.text()
    console.log("📤 Send message response:", response.status, responseText)

    if (response.ok) {
      let data
      try {
        data = JSON.parse(responseText)
        console.log("✅ Message sent successfully")
      } catch (e) {
        data = { success: true, message: "Message sent successfully" }
      }
      return NextResponse.json(data)
    } else {
      console.error("❌ Send message error:", response.status, responseText)
      return NextResponse.json(
        {
          error: "Failed to send message",
          details: responseText,
          status: response.status,
        },
        { status: response.status },
      )
    }
  } catch (error) {
    console.error("💥 Send message error:", error)
    
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
        error: isConnectionError ? "Cannot connect to backend server" : "Failed to send message",
        details: error instanceof Error ? error.message : "Unknown error",
        connectionError: isConnectionError,
        backendUrl: API_BASE_URL,
      },
      { status: isConnectionError ? 503 : 500 }
    )
  }
}
