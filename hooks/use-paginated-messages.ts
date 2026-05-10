"use client"

import { useState, useCallback, useRef } from "react"

export interface Message {
  id: number
  wa_id: string
  profile_name: string
  message_sid: string
  message_type: string
  body: string
  is_order?: boolean
  order_id?: number | null
  created_at: string
  total_orders?: number
}

interface PaginatedMessagesResponse {
  messages: Message[]
  count: number
  total_count: number
  limit: number
  offset: number
  has_more: boolean
}

interface UsePaginatedMessagesProps {
  token: string | null
  isActive: boolean
  pageSize?: number
}

export function usePaginatedMessages({
  token,
  isActive,
  pageSize = 20,
}: UsePaginatedMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const isFetchingRef = useRef(false)

  const fetchMessagesPage = useCallback(
    async (page: number, reset: boolean = false) => {
      if (!token || !isActive || isFetchingRef.current) {
        return { messages: [], hasMore: false }
      }

      try {
        isFetchingRef.current = true
        setError(null)

        const offset = page * pageSize
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        const response = await (async () => {
          try {
            return await fetch(`/api/messages?limit=${pageSize}&offset=${offset}`, {
              cache: "no-store",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              signal: controller.signal,
            })
          } finally {
            clearTimeout(timeoutId)
          }
        })()

        if (!response.ok) {
          setError("Failed to fetch messages")
          return { messages: [], hasMore: false }
        }

        const data: PaginatedMessagesResponse = await response.json()

        if (reset) {
          setMessages(data.messages)
          setCurrentPage(0)
        } else {
          setMessages((prev) => [...prev, ...data.messages])
        }

        setTotalCount(data.total_count || 0)
        setHasMore(data.has_more || false)
        setCurrentPage(page)

        return { messages: data.messages, hasMore: data.has_more || false }
      } catch (err) {
        const errName = (err as { name?: string })?.name
        if (errName !== "AbortError") {
          console.error("Failed to fetch messages page:", err)
          setError("Network error while fetching messages")
        }
        return { messages: [], hasMore: false }
      } finally {
        isFetchingRef.current = false
        setLoading(false)
      }
    },
    [token, isActive, pageSize]
  )

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return
    setLoading(true)
    await fetchMessagesPage(currentPage + 1, false)
  }, [hasMore, loading, currentPage, fetchMessagesPage])

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchMessagesPage(0, true)
  }, [fetchMessagesPage])

  return {
    messages,
    loading,
    hasMore,
    totalCount,
    currentPage,
    error,
    loadMore,
    refresh,
  }
}
