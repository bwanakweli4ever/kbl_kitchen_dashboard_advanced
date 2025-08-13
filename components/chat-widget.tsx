"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MessageSquare, Send, Loader2, User, Phone } from "lucide-react"
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
}

export function ChatWidget({ customerName, phoneNumber, token, trigger }: ChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchMessages = async () => {
    if (!token || !phoneNumber) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/messages?wa_id=${phoneNumber}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (response.ok) {
        const processedMessages = (data.messages || []).map((message: any) => ({
          id: message.id || Math.random(),
          wa_id: message.wa_id || phoneNumber,
          profile_name: message.profile_name || customerName,
          message_type: message.message_type || "text",
          body: message.body || "",
          is_order: message.is_order || false,
          created_at: message.created_at || new Date().toISOString(),
          direction: message.direction || "inbound",
        }))

        // Sort messages by timestamp
        processedMessages.sort(
          (a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )

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
        setTimeout(() => fetchMessages(), 1000)
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

  const handleOpenChange = (newOpen: boolean) => {
    console.log("Chat dialog open change:", newOpen)
    setOpen(newOpen)
    if (newOpen) {
      fetchMessages()
    } else {
      setMessages([])
      setNewMessage("")
      setError(null)
    }
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <button
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
            onClick={() => {
              console.log("Chat trigger clicked!")
              setOpen(true)
            }}
          >
            <MessageSquare className="h-4 w-4" />
            Chat
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md h-[600px] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="font-semibold">{customerName}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {phoneNumber}
                </div>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                        <div className="whitespace-pre-wrap">{message.body}</div>
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

        {/* Message Input - COMPLETELY REDESIGNED */}
        <div className="p-4 border-t bg-white">
          <div className="flex gap-2 items-end">
            {/* Text Input */}
            <div className="flex-1">
              <textarea
                value={newMessage}
                onChange={(e) => {
                  console.log("Input changed:", e.target.value)
                  setNewMessage(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    console.log("🎯 ENTER KEY PRESSED - CALLING SEND MESSAGE")
                    sendMessage()
                  }
                }}
                placeholder="Type a message..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={2}
                maxLength={1000}
                disabled={sending}
              />
              <div className="text-xs text-gray-500 mt-1">{newMessage.length}/1000 characters</div>
            </div>

            {/* Send Button - COMPLETELY NATIVE */}
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
      </DialogContent>
    </Dialog>
  )
}
