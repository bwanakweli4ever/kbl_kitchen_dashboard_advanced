"use client"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Settings, Loader2, CheckCircle, AlertCircle, Clock, XCircle, Ban } from "lucide-react"
import { cn } from "@/lib/utils"

interface OrderStatusDialogProps {
  orderId: number
  currentStatus: string
  customerName: string
  phoneNumber: string
  token: string | null
  onStatusUpdated?: () => void
}

const statusOptions = [
  { value: "received", label: "Received", icon: AlertCircle, color: "bg-blue-500", description: "Order just received" },
  { value: "acknowledged", label: "Acknowledged", icon: Clock, color: "bg-yellow-500", description: "Order confirmed" },
  { value: "preparing", label: "Preparing", icon: Clock, color: "bg-orange-500", description: "Kitchen is working on it" },
  { value: "ready", label: "Ready", icon: CheckCircle, color: "bg-green-500", description: "Order is ready for pickup" },
  { value: "out_for_delivery", label: "Out for Delivery", icon: CheckCircle, color: "bg-purple-500", description: "Order is being delivered" },
  { value: "delivered", label: "Delivered", icon: CheckCircle, color: "bg-gray-500", description: "Order completed" },
  { value: "cancelled", label: "Cancelled", icon: XCircle, color: "bg-red-500", description: "Order was cancelled" },
]

const defaultMessages = {
  acknowledged: "Your order has been received and acknowledged. We'll start preparing it shortly!",
  preparing: "Great news! Your order is now being prepared by our kitchen team. 🍳",
  ready: "Your order is ready for pickup/delivery! 🎉",
  out_for_delivery: "Your order is on its way! 🚚 Our delivery team is bringing it to you.",
  delivered: "Thank you for your order! We hope you enjoyed your meal. 😊",
  cancelled: "We're sorry, but your order has been cancelled. Please contact us if you have any questions.",
}

const cancellationReasons = [
  "Out of ingredients",
  "Kitchen capacity reached",
  "Customer request",
  "Payment issue",
  "Delivery area not covered",
  "Other",
]

export function OrderStatusDialog({
  orderId,
  currentStatus,
  customerName,
  phoneNumber,
  token,
  onStatusUpdated,
}: OrderStatusDialogProps) {
  const [open, setOpen] = useState(false)
  const [newStatus, setNewStatus] = useState(currentStatus)
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [customMessage, setCustomMessage] = useState("")
  const [useDefaultMessage, setUseDefaultMessage] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [cancellationReason, setCancellationReason] = useState("")
  const [showCancellationReason, setShowCancellationReason] = useState(false)

  const handleStatusChange = (status: string) => {
    setNewStatus(status)
    setShowCancellationReason(status === "cancelled")
    
    if (useDefaultMessage) {
      setCustomMessage(defaultMessages[status as keyof typeof defaultMessages] || "")
    }
    
    // Clear cancellation reason if not cancelling
    if (status !== "cancelled") {
      setCancellationReason("")
    }
  }

  const handleDefaultMessageToggle = (checked: boolean) => {
    setUseDefaultMessage(checked)
    if (checked) {
      setCustomMessage(defaultMessages[newStatus as keyof typeof defaultMessages] || "")
    } else {
      setCustomMessage("")
    }
  }

  const updateOrderStatus = async () => {
    console.log("Update button clicked!") // Debug log

    if (!token || newStatus === currentStatus || updating) {
      console.log("Update blocked:", { token: !!token, newStatus, currentStatus, updating })
      return
    }

    // Require cancellation reason if cancelling
    if (newStatus === "cancelled" && !cancellationReason.trim()) {
      setError("Please provide a reason for cancellation")
      return
    }

    try {
      setUpdating(true)
      setError(null)
      setSuccess(null)

      const requestBody: any = {
        status: newStatus,
        notify_customer: notifyCustomer,
      }

      if (notifyCustomer && customMessage.trim()) {
        requestBody.custom_message = customMessage.trim()
      }

      if (newStatus === "cancelled" && cancellationReason.trim()) {
        requestBody.cancellation_reason = cancellationReason.trim()
      }

      console.log("Sending request:", requestBody)

      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()
      console.log("Response:", data)

      if (response.ok) {
        setSuccess(
          `Order updated from "${data.old_status}" to "${data.new_status}"${
            data.customer_notified ? " and customer notified" : ""
          }`,
        )
        onStatusUpdated?.()
        setTimeout(() => {
          setOpen(false)
          setSuccess(null)
        }, 2000)
      } else {
        setError(data.error || "Failed to update order status")
      }
    } catch (err) {
      console.error("Update status error:", err)
      setError("Network error - check your connection")
    } finally {
      setUpdating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    console.log("Dialog open change:", newOpen)
    setOpen(newOpen)
    if (!newOpen) {
      setNewStatus(currentStatus)
      setCustomMessage(defaultMessages[currentStatus as keyof typeof defaultMessages] || "")
      setUseDefaultMessage(true)
      setNotifyCustomer(true)
      setError(null)
      setSuccess(null)
      setCancellationReason("")
      setShowCancellationReason(false)
    }
  }

  const currentStatusOption = statusOptions.find((option) => option.value === currentStatus)
  const newStatusOption = statusOptions.find((option) => option.value === newStatus)

  // Check if status change is valid
  const isValidStatusChange = () => {
    if (newStatus === currentStatus) return false
    
    // Prevent going backwards in most cases
    const statusOrder = ["received", "acknowledged", "preparing", "ready", "out_for_delivery", "delivered"]
    const currentIndex = statusOrder.indexOf(currentStatus)
    const newIndex = statusOrder.indexOf(newStatus)
    
    // Allow cancellation from any status
    if (newStatus === "cancelled") return true
    
    // Allow moving forward in the flow
    if (newIndex > currentIndex) return true
    
    // Allow some specific backwards moves
    if (newStatus === "preparing" && currentStatus === "ready") return true
    if (newStatus === "ready" && currentStatus === "out_for_delivery") return true
    
    return false
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-2"
          onClick={() => {
            console.log("Trigger button clicked!")
            setOpen(true)
          }}
        >
          <Settings className="h-3 w-3" />
          Update
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Update Order #{orderId}
          </DialogTitle>
          <div className="text-sm text-gray-600">
            Customer: {customerName} ({phoneNumber})
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Status */}
          <div>
            <label className="text-sm font-medium text-gray-700">Current Status</label>
            <div className="mt-1">
              <Badge className={cn("text-white flex items-center gap-1 w-fit", currentStatusOption?.color)}>
                {currentStatusOption?.icon && <currentStatusOption.icon className="h-3 w-3" />}
                {currentStatusOption?.label}
              </Badge>
            </div>
          </div>

          {/* New Status */}
          <div>
            <label className="text-sm font-medium text-gray-700">New Status</label>
            <Select value={newStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-gray-500">{option.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cancellation Reason */}
          {showCancellationReason && (
            <div>
              <label className="text-sm font-medium text-gray-700">Cancellation Reason *</label>
              <Select value={cancellationReason} onValueChange={setCancellationReason}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a reason for cancellation" />
                </SelectTrigger>
                <SelectContent>
                  {cancellationReasons.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cancellationReason === "Other" && (
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Please specify the cancellation reason..."
                  className="mt-2 min-h-[60px]"
                  maxLength={200}
                />
              )}
            </div>
          )}

          {/* Notify Customer */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="notify" 
              checked={notifyCustomer} 
              onCheckedChange={(checked) => setNotifyCustomer(checked === true)} 
            />
            <label htmlFor="notify" className="text-sm font-medium text-gray-700">
              Send notification to customer
            </label>
          </div>

          {/* Message Options */}
          {notifyCustomer && !showCancellationReason && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="useDefault" 
                  checked={useDefaultMessage} 
                  onCheckedChange={(checked) => handleDefaultMessageToggle(checked === true)} 
                />
                <label htmlFor="useDefault" className="text-sm font-medium text-gray-700">
                  Use default message
                </label>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  {useDefaultMessage ? "Default Message" : "Custom Message"}
                </label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Enter your message to the customer..."
                  className="mt-1 min-h-[80px]"
                  maxLength={500}
                  disabled={useDefaultMessage}
                />
                <div className="text-xs text-gray-500 mt-1">{customMessage.length}/500 characters</div>
              </div>
            </div>
          )}

          {/* Preview */}
          {newStatus !== currentStatus && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-blue-800 mb-1">Preview Changes:</div>
              <div className="text-sm text-blue-700">
                Status: {currentStatusOption?.label} → {newStatusOption?.label}
                {showCancellationReason && cancellationReason && (
                  <div className="mt-1">
                    🚫 Cancellation Reason: {cancellationReason}
                  </div>
                )}
                {notifyCustomer && (
                  <div className="mt-1">
                    ✅ Customer will be notified
                    {customMessage && <div className="mt-1 italic">"{customMessage.slice(0, 50)}..."</div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error/Success Messages */}
          {error && <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">{error}</div>}

          {success && (
            <div className="p-3 bg-green-100 border border-green-300 rounded-lg text-green-700 text-sm">
              ✅ {success}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                console.log("Update button clicked directly!")
                updateOrderStatus()
              }}
              disabled={updating || !newStatus || !isValidStatusChange()}
              className="flex-1 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-500 text-white hover:bg-green-600 h-10 px-4 py-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Update Order
                </>
              )}
            </button>
            <button
              onClick={() => setOpen(false)}
              disabled={updating}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
