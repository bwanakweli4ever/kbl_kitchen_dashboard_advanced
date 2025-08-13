"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageSquare, RefreshCw, User, Clock, Send, MessageCircle, Download } from "lucide-react"
import { ChatWidget } from "./chat-widget"

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

interface MessagesViewProps {
  token: string | null
}

export function MessagesView({ token }: MessagesViewProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")

  const fetchMessages = async () => {
    try {
      setLoading(true)
      if (!token) {
        setError("No authentication token available")
        return
      }

      let apiUrl = "/api/messages"
      const params = new URLSearchParams()

      if (searchTerm) params.append("wa_id", searchTerm)
      if (filterType !== "all") params.append("message_type", filterType)

      if (params.toString()) {
        apiUrl += `?${params.toString()}`
      }

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (response.ok) {
        const processedMessages = (data.messages || []).map((message: any) => ({
          id: message.id || Math.random(),
          wa_id: message.wa_id || "Unknown",
          profile_name: message.profile_name || "Unknown Customer",
          message_type: message.message_type || "text",
          body: message.body || "",
          is_order: message.is_order || false,
          created_at: message.created_at || new Date().toISOString(),
          direction: message.direction || "inbound",
        }))

        setMessages(processedMessages)
        setError(null)
      } else if (response.status === 401) {
        setError("Authentication failed. Please log in again.")
        // Clear the token from localStorage to force re-authentication
        localStorage.removeItem("kitchen_token");
        // Reload the page to redirect to login
        window.location.reload();
      } else {
        setError(data.error || "Failed to fetch messages")
      }
    } catch (err) {
      console.error("Fetch messages error:", err)
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError("Network error - check your connection")
      } else {
        setError("An unexpected error occurred")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchMessages()
    }
  }, [token, searchTerm, filterType])

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString()
    } catch (error) {
      return "Invalid Date"
    }
  }

  const getMessageTypeColor = (type: string, isOrder: boolean) => {
    if (isOrder) return "bg-green-100 text-green-800"
    switch (type.toLowerCase()) {
      case "text":
        return "bg-blue-100 text-blue-800"
      case "image":
        return "bg-purple-100 text-purple-800"
      case "document":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getDirectionIcon = (direction: string) => {
    return direction === "outbound" ? <Send className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />
  }

  const exportToCSV = () => {
    const headers = [
      "Customer Name",
      "Phone Number",
      "Message Type",
      "Direction",
      "Message Content",
      "Is Order",
      "Date",
      "Time",
    ]

    const csvData = messages.map((message) => [
      message.profile_name,
      message.wa_id,
      message.message_type,
      message.direction,
      message.body.replace(/"/g, '""'), // Escape quotes in message content
      message.is_order ? "Yes" : "No",
      new Date(message.created_at).toLocaleDateString(),
      new Date(message.created_at).toLocaleTimeString(),
    ])

    const csvContent = [headers.join(","), ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `messages_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Group messages by customer
  const groupedMessages = messages.reduce(
    (groups, message) => {
      const key = message.wa_id
      if (!groups[key]) {
        groups[key] = {
          customer: {
            wa_id: message.wa_id,
            profile_name: message.profile_name,
          },
          messages: [],
          lastMessage: message,
        }
      }
      groups[key].messages.push(message)

      // Update last message if this one is newer
      if (new Date(message.created_at) > new Date(groups[key].lastMessage.created_at)) {
        groups[key].lastMessage = message
      }

      return groups
    },
    {} as Record<string, { customer: any; messages: Message[]; lastMessage: Message }>,
  )

  // Convert to array and sort by last message time
  const conversationList = Object.values(groupedMessages).sort(
    (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime(),
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-green-500" />
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-green-600">Message Center</h2>
          <p className="text-gray-600">{conversationList.length} conversations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={fetchMessages} variant="outline" className="flex items-center gap-2 bg-transparent">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search by phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <Button variant={filterType === "all" ? "default" : "outline"} onClick={() => setFilterType("all")} size="sm">
            All
          </Button>
          <Button
            variant={filterType === "text" ? "default" : "outline"}
            onClick={() => setFilterType("text")}
            size="sm"
          >
            Text
          </Button>
          <Button
            variant={filterType === "image" ? "default" : "outline"}
            onClick={() => setFilterType("image")}
            size="sm"
          >
            Images
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">{error}</div>}

      {/* Conversations List */}
      {conversationList.length === 0 && !loading && !error && (
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No conversations found</h3>
          <p className="text-gray-500">Messages will appear here when available from the API</p>
        </div>
      )}

      <div className="space-y-4">
        {conversationList.map((conversation) => (
          <Card key={conversation.customer.wa_id} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium">{conversation.customer.profile_name}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {conversation.customer.wa_id}
                      </Badge>
                      <span>•</span>
                      <span>{conversation.messages.length} messages</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={getMessageTypeColor(
                      conversation.lastMessage.message_type,
                      conversation.lastMessage.is_order,
                    )}
                  >
                    {getDirectionIcon(conversation.lastMessage.direction)}
                    {conversation.lastMessage.is_order ? "Order" : conversation.lastMessage.message_type}
                  </Badge>
                  <ChatWidget
                    customerName={conversation.customer.profile_name}
                    phoneNumber={conversation.customer.wa_id}
                    token={token}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Last message:</div>
                <p className="text-sm text-gray-800 line-clamp-2">{conversation.lastMessage.body}</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                <span>{formatDate(conversation.lastMessage.created_at)}</span>
                {conversation.lastMessage.is_order && (
                  <Badge variant="secondary" className="text-xs">
                    🍽️ Order Message
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
