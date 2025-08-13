"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface NotificationBadgeProps {
  count: number
  className?: string
  showZero?: boolean
}

export function NotificationBadge({ count, className, showZero = false }: NotificationBadgeProps) {
  if (count === 0 && !showZero) return null

  return (
    <Badge
      className={cn(
        "absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center text-xs font-bold",
        count > 0 ? "bg-red-500 text-white animate-pulse" : "bg-gray-400 text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </Badge>
  )
}
