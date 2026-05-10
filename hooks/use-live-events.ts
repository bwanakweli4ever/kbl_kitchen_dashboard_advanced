"use client"

import { useEffect, useRef, useState } from "react"

type LiveEventsOptions = {
  token: string | null
  isActive: boolean
  onOrderChanged?: () => void
  onMessageChanged?: () => void
}

function parseSseChunk(
  chunk: string,
  onOrderChanged?: () => void,
  onMessageChanged?: () => void,
): void {
  const blocks = chunk.split("\n\n")
  for (const block of blocks) {
    if (!block.trim()) continue
    let eventName = ""

    for (const rawLine of block.split("\n")) {
      const line = rawLine.trim()
      if (!line) continue
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim()
      }
    }

    if (eventName === "order_changed") {
      onOrderChanged?.()
    } else if (eventName === "message_changed") {
      onMessageChanged?.()
    }
  }
}

export function useLiveEvents({ token, isActive, onOrderChanged, onMessageChanged }: LiveEventsOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stoppedRef = useRef(false)

  useEffect(() => {
    stoppedRef.current = false
    let abortController: AbortController | null = null
    let reconnectDelayMs = 2000

    const clearReconnect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const scheduleReconnect = () => {
      clearReconnect()
      reconnectTimerRef.current = setTimeout(() => {
        if (!stoppedRef.current) {
          void connect()
        }
      }, reconnectDelayMs)
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, 15000)
    }

    const connect = async () => {
      if (!token || !isActive || stoppedRef.current) return

      abortController = new AbortController()

      try {
        const response = await fetch("/api/events", {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: abortController.signal,
        })

        if (!response.ok || !response.body) {
          setIsConnected(false)
          scheduleReconnect()
          return
        }

        setIsConnected(true)
        reconnectDelayMs = 2000

        const reader = response.body.getReader()
        const decoder = new TextDecoder("utf-8")
        let buffer = ""

        while (!stoppedRef.current) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const parts = buffer.split("\n\n")
          buffer = parts.pop() || ""

          for (const part of parts) {
            parseSseChunk(part + "\n\n", onOrderChanged, onMessageChanged)
          }
        }

        setIsConnected(false)
        if (!stoppedRef.current) {
          scheduleReconnect()
        }
      } catch {
        setIsConnected(false)
        if (!stoppedRef.current) {
          scheduleReconnect()
        }
      }
    }

    if (token && isActive) {
      void connect()
    }

    return () => {
      stoppedRef.current = true
      setIsConnected(false)
      clearReconnect()
      if (abortController) {
        abortController.abort()
      }
    }
  }, [token, isActive, onOrderChanged, onMessageChanged])

  return { isConnected }
}
