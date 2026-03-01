"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MessageSquare, Send, Loader2, User, Phone, X, ChevronDown, ChevronUp, Bell, Minimize, Maximize } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: number
  wa_id: string
  profile_name: string
  message_type: string
  body: string
  is_order: boolean
  created_at: string
  direction: "inbound" | "outbound"
}

interface ChatWidgetProps {
  customerName: string
  phoneNumber: string
  token: string | null
  trigger?: React.ReactNode
  orderId?: number
  onNewMessage?: (message: Message) => void
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const SUPPORT_KEYWORDS = [
  "support",
  "help",
  "agent",
  "assist",
  "issue",
  "problem",
  "complaint",
  "urgent",
]

const normalizeWaId = (value?: string | null) => (value || "").replace(/[^\d]/g, "")

export function ChatWidget({ customerName, phoneNumber, token, trigger, orderId, onNewMessage, defaultOpen = false, open: controlledOpen, onOpenChange }: ChatWidgetProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = (newOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(newOpen)
    }
    if (onOpenChange) {
      onOpenChange(newOpen)
    }
  }
  const [isMinimized, setIsMinimized] = useState(false)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const [lastInboundMessageKey, setLastInboundMessageKey] = useState<string | null>(null)
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState<Message | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fetchRequestIdRef = useRef(0)
  const currentPhoneRef = useRef(phoneNumber)
  const lastInboundMessageKeyRef = useRef<string | null>(null)
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null)

  const playNotificationSound = async () => {
    try {
      if (!notificationAudioRef.current) {
        notificationAudioRef.current = new Audio("/sounds/simple-notification.mp3")
        notificationAudioRef.current.preload = "auto"
      }

      const audio = notificationAudioRef.current
      audio.pause()
      audio.currentTime = 0
      audio.volume = 1
      await audio.play()
    } catch (error) {
      try {
        const fallbackAudio = new Audio("/sounds/here.wav")
        fallbackAudio.preload = "auto"
        fallbackAudio.volume = 1
        await fallbackAudio.play()
      } catch (fallbackError) {
        console.warn("[ChatWidget] Notification sound playback failed", fallbackError)
      }
    }
  }

  const handleMessageInputChange = (value: string) => {
    setNewMessage(value)

    if (!inputRef.current) return
    inputRef.current.style.height = "auto"
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 140)}px`
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchMessages = async () => {
    if (!token || !phoneNumber) return

    const requestId = ++fetchRequestIdRef.current
    const expectedWaId = normalizeWaId(phoneNumber)

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({ wa_id: phoneNumber })

      const response = await fetch(`/api/messages?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (response.ok) {
        const processedMessages = (data.messages || []).map((message: any, index: number) => ({
          id: message.id || Date.parse(message.created_at || "") || index + 1,
          wa_id: message.wa_id || phoneNumber,
          profile_name: message.profile_name || customerName,
          message_type: message.message_type || "text",
          // Use raw_message for order messages if available, otherwise use body
          body: (message.is_order && message.raw_message) ? message.raw_message : (message.body || ""),
          is_order: message.is_order || false,
          created_at: message.created_at || new Date().toISOString(),
          direction: message.direction || "inbound",
        })).filter((message: Message) => normalizeWaId(message.wa_id) === expectedWaId)

        if (requestId !== fetchRequestIdRef.current || currentPhoneRef.current !== phoneNumber) {
          return
        }

        // Sort messages by timestamp
        processedMessages.sort(
          (a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )

        // Check for new inbound messages using stable key
        const inboundMessages = processedMessages.filter((message: Message) => {
          const direction = (message.direction || "").toLowerCase()
          const messageType = (message.message_type || "").toLowerCase()
          const isOutboundLike = direction === "outbound" || messageType === "sent" || messageType === "outbound"
          const isInboundLike = direction === "inbound" || messageType === "inbound" || messageType === "received"
          const isInbound = !isOutboundLike && isInboundLike

          if (isInbound) {
            console.log("[ChatWidget] Inbound message detected:", message)
          }

          return isInbound
        })
        console.log("[ChatWidget] Filtered inboundMessages:", inboundMessages);
        const latestInboundMessage = inboundMessages.length > 0 ? inboundMessages[inboundMessages.length - 1] : null

        const previousInboundKey = lastInboundMessageKeyRef.current

        if (previousInboundKey !== null && latestInboundMessage) {
          const latestInboundKey = `${latestInboundMessage.id}-${latestInboundMessage.wa_id}-${latestInboundMessage.created_at}-${latestInboundMessage.body}`;
          console.log("[ChatWidget] Latest inbound key:", latestInboundKey, "Last seen:", previousInboundKey);
          if (latestInboundKey !== previousInboundKey) {
            console.log("[ChatWidget] Triggering notification popup for new inbound message.", latestInboundMessage);
            setHasNewMessages(true);
            setNotificationMessage(latestInboundMessage);
            setShowNotification(true);
            void playNotificationSound()
            if (onNewMessage) {
              onNewMessage(latestInboundMessage);
            }
            lastInboundMessageKeyRef.current = latestInboundKey
            setLastInboundMessageKey(latestInboundKey);
            const messageBody = (latestInboundMessage.body || "").toLowerCase()
            const shouldAutoOpenSupport = SUPPORT_KEYWORDS.some((keyword) => messageBody.includes(keyword))
            if (shouldAutoOpenSupport) {
              setOpen(true)
              setIsMinimized(false)
              setShowNotification(false)
            }
            // Auto-hide notification after 5 seconds
            setTimeout(() => {
              setShowNotification(false);
            }, 5000);
          }
        } else if (latestInboundMessage) {
          // First load - establish baseline inbound key without triggering popup
          const latestInboundKey = `${latestInboundMessage.id}-${latestInboundMessage.wa_id}-${latestInboundMessage.created_at}-${latestInboundMessage.body}`
          lastInboundMessageKeyRef.current = latestInboundKey
          setLastInboundMessageKey(latestInboundKey)
        }

        setMessages(processedMessages)
      } else {
        setError(data.error || "Failed to fetch messages")
      }
    } catch (err) {
      console.error("Fetch messages error:", err)
      setError("Network error - check your connection")
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    console.log("🚀 SEND MESSAGE FUNCTION CALLED!")
    console.log("Message:", newMessage)
    console.log("Token exists:", !!token)
    console.log("Sending state:", sending)

    if (!newMessage.trim()) {
      console.log("❌ No message to send")
      return
    }

    if (!token) {
      console.log("❌ No token available")
      return
    }

    if (sending) {
      console.log("❌ Already sending")
      return
    }

    // Open widget if closed when sending a message
    if (!open) {
      setOpen(true)
    }

    try {
      console.log("✅ Starting send process...")
      setSending(true)
      setError(null)

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          message: newMessage.trim(),
          order_id: null,
        }),
      })

      const data = await response.json()
      console.log("📡 API Response:", data)

      if (response.ok) {
        console.log("✅ Message sent successfully!")
        setNewMessage("")
        // Add the sent message to the local state immediately
        const sentMessage: Message = {
          id: Date.now(),
          wa_id: phoneNumber,
          profile_name: customerName,
          message_type: "text",
          body: newMessage.trim(),
          is_order: false,
          created_at: new Date().toISOString(),
          direction: "outbound",
        }
        setMessages((prev) => [...prev, sentMessage])

        // Refresh messages to get the latest from server
        await fetchMessages()
      } else {
        console.log("❌ API Error:", data)
        setError(data.error || "Failed to send message")
      }
    } catch (err) {
      console.error("❌ Send message error:", err)
      setError("Network error - check your connection")
    } finally {
      setSending(false)
      console.log("🏁 Send process completed")
    }
  }

  // Auto-refresh messages every 5 seconds (even when closed) to detect incoming messages
  useEffect(() => {
    if (!token || !phoneNumber) return

    currentPhoneRef.current = phoneNumber
    setMessages([])
    setNewMessage("")
    setError(null)
    setHasNewMessages(false)
    setNotificationMessage(null)
    setShowNotification(false)
    lastInboundMessageKeyRef.current = null
    setLastInboundMessageKey(null)

    fetchMessages() // Initial fetch
    const interval = setInterval(() => {
      fetchMessages()
    }, 5000) // Refresh every 5 seconds

    return () => clearInterval(interval)
  }, [token, phoneNumber, orderId])

  const handleOpenChange = (newOpen: boolean) => {
    console.log("Chat widget open change:", newOpen)
    setOpen(newOpen)
    if (newOpen) {
      setIsMinimized(false)
      setHasNewMessages(false)
      fetchMessages()
    } else {
      setMessages([])
      setNewMessage("")
      setError(null)
      setHasNewMessages(false)
    }
  }

  const handleMinimize = () => {
    setIsMinimized(!isMinimized)
    if (!isMinimized) {
      setHasNewMessages(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setIsMinimized(false)
    setHasNewMessages(false)
  }

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } catch (error) {
      return "Invalid Time"
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      if (date.toDateString() === today.toDateString()) {
        return "Today"
      } else if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday"
      } else {
        return date.toLocaleDateString()
      }
    } catch (error) {
      return "Invalid Date"
    }
  }

  // If trigger is provided, use it as a button to open the floating widget
  if (trigger && !open && !showNotification) {
    return (
      <div onClick={() => handleOpenChange(true)} className="cursor-pointer">
        {trigger}
      </div>
    )
  }

  // Show floating widget container if open OR if there's a notification
  // If open is controlled from outside, always show when open is true
  if (!open && !showNotification) {
    return null
  }
  
  // Ensure we have required props
  if (!phoneNumber || !token) {
    return null
  }

  return (
    <div className="fixed bottom-2 left-2 right-2 z-50 flex flex-col gap-2 sm:bottom-4 sm:left-auto sm:right-4">
      {/* New Message Notification Popup */}
      {showNotification && notificationMessage && !open && (
        <div className="bg-white rounded-xl shadow-2xl border-2 border-green-400 p-4 w-full sm:w-80 max-w-md animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-green-600 animate-pulse" />
              <div className="font-semibold text-sm">New Message</div>
            </div>
            <button
              onClick={() => setShowNotification(false)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
          </div>
          <div className="text-sm text-gray-700 mb-2">
            <div className="font-medium">{customerName}</div>
            <div className="text-xs text-gray-500 truncate">{notificationMessage.body.substring(0, 100)}...</div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setShowNotification(false)
                handleOpenChange(true)
              }}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs h-8"
            >
              Open Chat
            </Button>
            <Button
              onClick={() => setShowNotification(false)}
              variant="outline"
              className="text-xs h-8"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
      
      {/* Floating Chat Widget */}
      {open && (
        <div
          className={cn(
            "bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col transition-all duration-300 overflow-hidden",
            isMinimized
              ? "w-full sm:w-80 h-16"
              : "w-full sm:w-96 h-[calc(100dvh-1rem)] sm:h-[600px] max-h-[calc(100dvh-1rem)]"
          )}
        >
        {/* Header */}
        <div className="p-3 sm:p-4 pb-2 border-b bg-gradient-to-r from-green-50 to-emerald-50 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-green-600" />
            </div>
            {!isMinimized && (
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">{customerName}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span className="truncate">{phoneNumber}</span>
                </div>
              </div>
            )}
            {isMinimized && (
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{customerName}</div>
                {hasNewMessages && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <Bell className="h-3 w-3 animate-pulse" />
                    <span>New message</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasNewMessages && !isMinimized && (
              <Badge variant="destructive" className="text-xs h-5 px-2 animate-pulse">
                New
              </Badge>
            )}
            <button
              onClick={handleMinimize}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title={isMinimized ? "Expand" : "Minimize"}
            >
              {isMinimized ? (
                <Maximize className="h-4 w-4 text-gray-600" />
              ) : (
                <Minimize className="h-4 w-4 text-gray-600" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="Close"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Messages Area - Only show when not minimized */}
        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-gradient-to-b from-white to-gray-50/60">
              {loading && messages.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-green-500" />
                    <p className="text-sm text-gray-600">Loading messages...</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">No messages yet</p>
                    <p className="text-xs text-gray-500">Start a conversation!</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message, index) => {
                    const showDate =
                      index === 0 || formatDate(message.created_at) !== formatDate(messages[index - 1].created_at)

                    return (
                      <div key={message.id}>
                        {showDate && (
                          <div className="flex justify-center my-4">
                            <Badge variant="outline" className="text-xs">
                              {formatDate(message.created_at)}
                            </Badge>
                          </div>
                        )}

                        <div className={cn("flex", message.direction === "outbound" ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                              message.direction === "outbound" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-900",
                            )}
                          >
                            {/* Display message - show raw message text AND location if present */}
                            {(() => {
                              let hasLocation = false;
                              let locationData: any = null;
                              
                              // Check if message contains location data
                              try {
                                const parsed = JSON.parse(message.body);
                                if (parsed && (parsed.latitude || parsed.longitude || parsed.address)) {
                                  hasLocation = true;
                                  locationData = parsed;
                                }
                              } catch (e) {
                                // Not JSON, check if it's a location string pattern
                                const locationPattern = /(?:location|address|coordinates?)[\s:]*([^\n]+)/i;
                                const match = message.body.match(locationPattern);
                                if (match) {
                                  hasLocation = true;
                                  locationData = { address: match[1] };
                                }
                              }
                              
                              return (
                                <div className="space-y-2">
                                  {/* Always show raw message text */}
                                  <div className="whitespace-pre-wrap text-sm">
                                    {message.body}
                                  </div>
                                  
                                  {/* If location data exists, also show formatted location */}
                                  {hasLocation && locationData && (
                                    <div className="mt-2 pt-2 border-t border-white/20">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">📍</span>
                                        <span className="font-semibold text-xs">Location Details</span>
                                      </div>
                                      {locationData.address && (
                                        <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded text-xs mb-1">
                                          <div className="font-medium mb-1">Address:</div>
                                          <div className="text-gray-700 dark:text-gray-300">{locationData.address}</div>
                                        </div>
                                      )}
                                      {(locationData.latitude || locationData.longitude) && (
                                        <div className="text-xs opacity-80 mb-1">
                                          Coordinates: {locationData.latitude ? `${locationData.latitude}` : 'N/A'}, {locationData.longitude ? `${locationData.longitude}` : 'N/A'}
                                        </div>
                                      )}
                                      {locationData.name && (
                                        <div className="text-xs opacity-80 mb-1">
                                          Location Name: {locationData.name}
                                        </div>
                                      )}
                                      {locationData.latitude && locationData.longitude && (
                                        <a
                                          href={`https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs underline hover:opacity-80 inline-block"
                                        >
                                          View on Google Maps →
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            <div className="flex items-center gap-2 mt-1">
                              <div
                                className={cn(
                                  "text-xs",
                                  message.direction === "outbound" ? "text-green-100" : "text-gray-500",
                                )}
                              >
                                {formatTime(message.created_at)}
                              </div>
                              {message.is_order && (
                                <Badge variant="secondary" className="text-xs h-4 px-1">
                                  🍽️
                                </Badge>
                              )}
                              {message.message_type === 'location' && (
                                <Badge variant="secondary" className="text-xs h-4 px-1">
                                  📍
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Error Message */}
            {error && <div className="mx-4 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">{error}</div>}

            {/* Message Input */}
            <div className="p-3 sm:p-4 border-t bg-white/95 backdrop-blur sticky bottom-0" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
              <div className="flex gap-2 items-end">
                {/* Text Input */}
                <div className="flex-1">
                  <textarea
                    ref={inputRef}
                    value={newMessage}
                    onChange={(e) => {
                      console.log("Input changed:", e.target.value)
                      handleMessageInputChange(e.target.value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        console.log("🎯 ENTER KEY PRESSED - CALLING SEND MESSAGE")
                        sendMessage()
                      }
                    }}
                    placeholder="Type a message..."
                    className="w-full p-3 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base leading-5"
                    rows={1}
                    maxLength={1000}
                    disabled={sending}
                    style={{ minHeight: 44 }}
                  />
                  <div className="text-xs text-gray-500 mt-1">{newMessage.length}/1000 characters</div>
                </div>

                {/* Send Button */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => {
                      console.log("🎯 SEND BUTTON CLICKED!")
                      sendMessage()
                    }}
                    disabled={!newMessage.trim() || sending}
                    className="w-12 h-12 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    style={{
                      pointerEvents: sending || !newMessage.trim() ? "none" : "auto",
                    }}
                  >
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                  <span className="text-xs text-gray-500 mt-1">{sending ? "Sending..." : "Send"}</span>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Minimized view - click to expand */}
        {isMinimized && (
          <div
            onClick={handleMinimize}
            className="flex-1 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {hasNewMessages ? (
                  <span className="text-green-600 font-semibold">New message received</span>
                ) : (
                  <span>Click to expand chat</span>
                )}
              </div>
              {hasNewMessages && (
                <Badge variant="destructive" className="h-5 w-5 rounded-full p-0 flex items-center justify-center animate-pulse">
                  !
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
