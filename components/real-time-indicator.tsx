"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Wifi, Clock, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface RealTimeIndicatorProps {
  isConnected: boolean
  lastUpdate: Date
  isPolling?: boolean
  error?: string | null
}

export function RealTimeIndicator({ isConnected, lastUpdate, isPolling = false }: RealTimeIndicatorProps) {
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>("")

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      const diffInSeconds = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000)

      if (diffInSeconds < 60) {
        setTimeSinceUpdate(`${diffInSeconds}s ago`)
      } else {
        const minutes = Math.floor(diffInSeconds / 60)
        setTimeSinceUpdate(`${minutes}m ago`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [lastUpdate])

  // Simple, clean status for kitchen display
  const getStatusInfo = () => {
    if (isPolling) {
      return {
        icon: <CheckCircle className="h-3 w-3" />,
        label: "Live",
        color: "bg-green-500 animate-pulse",
      }
    }
    return {
      icon: <Wifi className="h-3 w-3" />,
      label: "Connected",
      color: "bg-blue-500",
    }
  }

  const status = getStatusInfo()

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={cn("flex items-center gap-1 text-white", status.color)}>
        {status.icon}
        {status.label}
      </Badge>

      <Badge variant="outline" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {timeSinceUpdate}
      </Badge>
    </div>
  )
}
