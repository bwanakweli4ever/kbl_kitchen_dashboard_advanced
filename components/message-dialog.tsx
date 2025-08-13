"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MessageSquare, Send, Loader2 } from "lucide-react"

interface MessageDialogProps {
  customerName: string
  phoneNumber: string
  token: string | null
  onMessageSent?: () => void
}

export function MessageDialog({ customerName, phoneNumber, token, onMessageSent }: MessageDialogProps) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const sendMessage = async () => {
    if (!message.trim() || !token) return

    try {
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
          message: message.trim(),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setMessage("")
        onMessageSent?.()
        setTimeout(() => {
          setOpen(false)
          setSuccess(false)
        }, 2000)
      } else {
        setError(data.error || "Failed to send message")
      }
    } catch (err) {
      console.error("Send message error:", err)
      setError("Network error - check your connection")
    } finally {
      setSending(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setMessage("")
      setError(null)
      setSuccess(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
          <MessageSquare className="h-4 w-4" />
          Message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send Message to {customerName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Phone Number</label>
            <Input value={phoneNumber} disabled className="mt-1" />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Message</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              className="mt-1 min-h-[100px]"
              maxLength={1000}
            />
            <div className="text-xs text-gray-500 mt-1">{message.length}/1000 characters</div>
          </div>

          {error && <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">{error}</div>}

          {success && (
            <div className="p-3 bg-green-100 border border-green-300 rounded-lg text-green-700 text-sm">
              ✅ Message sent successfully!
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={sendMessage}
              disabled={!message.trim() || sending}
              className="flex-1 bg-green-500 hover:bg-green-600"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
