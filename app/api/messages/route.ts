import { type NextRequest, NextResponse } from "next/server"

const API_BASE_URL = process.env.WHATSAPP_API_URL || "http://localhost:8000"

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
        data = { messages: [], count: 0 }
      }
      return NextResponse.json(data)
    } else {
      return NextResponse.json(
        {
          error: "Failed to fetch messages",
          details: responseText,
        },
        { status: response.status },
      )
    }
  } catch (error) {
    console.error("Messages fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
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
    })

    const responseText = await response.text()

    if (response.ok) {
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        data = { success: true, message: "Message sent successfully" }
      }
      return NextResponse.json(data)
    } else {
      return NextResponse.json(
        {
          error: "Failed to send message",
          details: responseText,
        },
        { status: response.status },
      )
    }
  } catch (error) {
    console.error("Send message error:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
