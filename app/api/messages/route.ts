import { type NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

const API_BASE_URL = process.env.WHATSAPP_API_URL || config.api.baseUrl
const MESSAGE_CACHE_TTL_MS = 2 * 60 * 1000
const messageResponseCache = new Map<string, { data: any; at: number }>()

function isSupportAlias(value: string | null | undefined) {
  const normalized = (value || "").trim().toLowerCase()
  if (!normalized) return false
  return ["kitchen support", "support", "customer support", "admin", "agent"].includes(normalized)
}

function fallbackCustomerName(waId: string | null | undefined) {
  const digits = (waId || "").replace(/[^\d]/g, "")
  if (!digits) return "Customer"
  return `Customer ${digits.slice(-4)}`
}

function buildMessageCacheKey(limit: string, offset: string, wa_id: string | null, order_id: string | null, message_type: string | null, is_order: string | null) {
  return [limit, offset, wa_id || '', order_id || '', message_type || '', is_order || ''].join('|')
}

export async function GET(request: NextRequest) {
  let cacheKey = ""
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
    const order_id = url.searchParams.get("order_id")
    const message_type = url.searchParams.get("message_type")
    const is_order = url.searchParams.get("is_order")
    const summaryOnly = !wa_id && !order_id && !message_type && !is_order
    cacheKey = buildMessageCacheKey(limit, offset, wa_id, order_id, message_type, is_order)

    const cachedResponse = messageResponseCache.get(cacheKey)
    if (cachedResponse && Date.now() - cachedResponse.at <= MESSAGE_CACHE_TTL_MS) {
      return NextResponse.json(cachedResponse.data)
    }

    let appChatMessages: any[] = []
    const normalizeWaId = (value: string | null | undefined) => (value || "").replace(/[^\d]/g, "")
    const requestedWaIdNormalized = normalizeWaId(wa_id)

    if (wa_id) {
      const chatUrl = new URL(`${API_BASE_URL}/api/chat/messages`)
      chatUrl.searchParams.set("wa_id", wa_id)
      chatUrl.searchParams.set("limit", limit)
      chatUrl.searchParams.set("offset", offset)
      if (order_id) chatUrl.searchParams.set("order_id", order_id)

      const chatController = new AbortController()
      const chatTimeoutId = setTimeout(() => chatController.abort(), config.api.timeout)

      try {
        const chatResponse = await fetch(chatUrl.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: chatController.signal,
        })
        clearTimeout(chatTimeoutId)

        if (chatResponse.ok) {
          const chatData = await chatResponse.json()
          const chatMessages = Array.isArray(chatData) ? chatData : []
            appChatMessages = chatMessages.map((m: any) => ({
              id: m.id,
              wa_id: m.user_id,
              profile_name: isSupportAlias(m.user_name) ? fallbackCustomerName(m.user_id) : (m.user_name || fallbackCustomerName(m.user_id)),
              message_type: m.message_type || "text",
              body: m.message || "",
              is_order: m.order_id != null,
              created_at: m.created_at,
              direction: m.is_from_customer ? "inbound" : "outbound",
              order_id: m.order_id,
            })).filter((m: any) => normalizeWaId(m.wa_id) === requestedWaIdNormalized)
        }
      } catch (e) {
        clearTimeout(chatTimeoutId)
      }
    }

    if (!wa_id) {
      const convoController = new AbortController()
      const convoTimeoutId = setTimeout(() => convoController.abort(), config.api.timeout)
      try {
        const convoResponse = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: convoController.signal,
        })
        clearTimeout(convoTimeoutId)
        if (convoResponse.ok) {
          const conversations = await convoResponse.json()
          if (Array.isArray(conversations)) {
            appChatMessages = conversations.map((c: any, index: number) => ({
              id: c.id ?? index + 1,
              wa_id: c.user_id,
              profile_name: isSupportAlias(c.user_name) ? fallbackCustomerName(c.user_id) : (c.user_name || fallbackCustomerName(c.user_id)),
              message_type: "text",
              body: c.message || "",
              is_order: false,
              created_at: c.created_at || new Date().toISOString(),
              direction: "inbound",
            }))
          }
        }
      } catch (e) {
        clearTimeout(convoTimeoutId)
      }

      if (summaryOnly) {
        const summaryData = {
          messages: appChatMessages,
          count: appChatMessages.length,
          total_count: appChatMessages.length,
          limit: Number(limit),
          offset: Number(offset),
          has_more: false,
          source: "conversation_summary",
        }
        messageResponseCache.set(cacheKey, { data: summaryData, at: Date.now() })
        return NextResponse.json(summaryData)
      }
    }

    let apiUrl = `${API_BASE_URL}/messages/?limit=${limit}&offset=${offset}`
    if (wa_id) apiUrl += `&wa_id=${wa_id}`
    if (order_id) apiUrl += `&order_id=${order_id}`
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
      const legacyMessages = Array.isArray(data.messages) ? data.messages : []
      const strictLegacyMessages = wa_id
        ? legacyMessages.filter((m: any) => normalizeWaId(m?.wa_id) === requestedWaIdNormalized)
        : legacyMessages

      let responseData = data

      if (appChatMessages.length > 0) {
        const merged = [...strictLegacyMessages, ...appChatMessages]
        const seen = new Set<string>()
        const deduped = merged.filter((m: any) => {
          const key = `${m.id}-${m.wa_id}-${m.created_at}-${m.direction}-${m.body}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        deduped.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        responseData = {
          ...data,
          messages: deduped,
          count: deduped.length,
          source: "merged",
        }
      } else if (wa_id) {
        responseData = {
          ...data,
          messages: strictLegacyMessages,
          count: strictLegacyMessages.length,
        }
      }

      messageResponseCache.set(cacheKey, { data: responseData, at: Date.now() })
      return NextResponse.json(responseData)
    } else {
      if (appChatMessages.length > 0) {
        const fallbackData = {
          messages: appChatMessages,
          count: appChatMessages.length,
          total_count: appChatMessages.length,
          limit: Number(limit),
          offset: Number(offset),
          has_more: false,
          source: "app_chat_fallback",
        }
        messageResponseCache.set(cacheKey, { data: fallbackData, at: Date.now() })
        return NextResponse.json(fallbackData)
      }
      const cached = messageResponseCache.get(cacheKey)
      if (cached && Date.now() - cached.at <= MESSAGE_CACHE_TTL_MS) {
        return NextResponse.json(cached.data)
      }
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

    const cached = messageResponseCache.get(cacheKey)
    if (cached && Date.now() - cached.at <= MESSAGE_CACHE_TTL_MS) {
      return NextResponse.json(cached.data)
    }
    
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
    const { phone_number, customer_name, message, order_id } = await request.json()

    if (!phone_number || !message) {
      return NextResponse.json({ error: "Phone number and message are required" }, { status: 400 })
    }

    let appChatSuccess = false
    let appChatData: any = null

    // Keep WhatsApp active while allowing in-app support thread replies.
    {
      const appChatController = new AbortController()
      const appChatTimeoutId = setTimeout(() => appChatController.abort(), config.api.timeout)
      try {
        const appChatResponse = await fetch(`${API_BASE_URL}/api/chat/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: phone_number,
            user_name: customer_name || null,
            message,
            message_type: "text",
            order_id: order_id ?? null,
            is_from_customer: false,
          }),
          signal: appChatController.signal,
        })
        clearTimeout(appChatTimeoutId)

        if (appChatResponse.ok) {
          appChatData = await appChatResponse.json()
          appChatSuccess = true
        }
      } catch (e) {
        clearTimeout(appChatTimeoutId)
      }
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
      return NextResponse.json({
        ...data,
        app_chat: appChatSuccess,
        app_chat_message: appChatData,
      })
    } else {
      if (appChatSuccess) {
        return NextResponse.json({
          success: true,
          source: "app_chat_only",
          message: appChatData,
          warning: "WhatsApp send failed, but in-app chat message was saved",
        })
      }
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
