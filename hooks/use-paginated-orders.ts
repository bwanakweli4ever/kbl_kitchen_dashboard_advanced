"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { config } from "@/lib/config"

export interface Order {
  id: number
  wa_id: string
  profile_name: string
  size: string
  quantity: number
  ingredients: string[]
  spice_level: string
  sauce: string
  food_total: number
  delivery_info: string
  delivery_latitude?: number | null
  delivery_longitude?: number | null
  delivery_address?: string | null
  status: string
  items: string
  drinks: string
  order_source: string
  preset_name?: string | null
  customer_total_orders: number
  created_at: string
  updated_at: string
  payment_method?: string
  payment_status?: string
  payment_received_at?: string
  rider_name?: string | null
  rider_phone?: string | null
  rider_assigned_at?: string | null
  delivered_at?: string | null
  delivery_comment?: string | null
  pickup_type?: string | null
  customer_here_at?: string | null
  scheduled_delivery_at?: string | null
  coupon_code?: string | null
  coupon_discount_amount?: number | null
  coupon_redeem_status?: string | null
  customer_phone_number?: string | null
  customer_email?: string | null
}

interface PaginatedResponse {
  orders: Order[]
  count: number
  total_count: number
  limit: number
  offset: number
  has_more: boolean
}

interface UsePaginatedOrdersProps {
  token: string | null
  isActive: boolean
  pageSize?: number
  onNewOrder?: (order: Order) => void
}

export function usePaginatedOrders({
  token,
  isActive,
  pageSize = 20,
  onNewOrder,
}: UsePaginatedOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  const lastFetchRef = useRef<Date | null>(null)
  const lastOrderIdsRef = useRef<Set<number>>(new Set())
  const previousOrdersRef = useRef<Order[]>([])
  const isFetchingRef = useRef(false)

  const fetchOrdersPage = useCallback(
    async (page: number, reset: boolean = false) => {
      if (!token || !isActive || isFetchingRef.current) {
        return { orders: [], hasMore: false }
      }

      try {
        isFetchingRef.current = true
        setError(null)

        const offset = page * pageSize
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 25000)

        const response = await (async () => {
          try {
            return await fetch(`/api/orders?limit=${pageSize}&offset=${offset}`, {
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
          setError("Failed to fetch orders")
          return { orders: [], hasMore: false }
        }

        const data: PaginatedResponse = await response.json()
        lastFetchRef.current = new Date()

        // Filter for active orders
        const activeOrders = data.orders.filter((order: Order) => {
          const isActive =
            order.status && !["delivered", "cancelled"].includes(order.status.toLowerCase())
          return isActive
        })

        // Check for new orders and trigger notifications
        if (page === 0) {
          const currentOrderIds = new Set<number>(activeOrders.map((o) => o.id))
          const previousOrderIds = lastOrderIdsRef.current

          if (previousOrderIds.size > 0) {
            const newOrderIds = Array.from(currentOrderIds).filter((id) => !previousOrderIds.has(id))
            if (newOrderIds.length > 0) {
              const newOrders = activeOrders.filter((o) => newOrderIds.includes(o.id))
              newOrders.forEach((order) => onNewOrder?.(order))
            }
          }

          lastOrderIdsRef.current = currentOrderIds
          previousOrdersRef.current = activeOrders
        }

        if (reset) {
          setOrders(activeOrders)
          setCurrentPage(0)
        } else {
          setOrders((prev) => [...prev, ...activeOrders])
        }

        setTotalCount(data.total_count || 0)
        setHasMore(data.has_more || false)
        setCurrentPage(page)

        return { orders: activeOrders, hasMore: data.has_more || false }
      } catch (err) {
        const errName = (err as { name?: string })?.name
        if (errName !== "AbortError") {
          console.error("Failed to fetch orders page:", err)
          setError("Network error while fetching orders")
        }
        return { orders: [], hasMore: false }
      } finally {
        isFetchingRef.current = false
        setLoading(false)
      }
    },
    [token, isActive, pageSize, onNewOrder]
  )

  // Initial fetch on mount
  useEffect(() => {
    if (isActive && token) {
      setLoading(true)
      void fetchOrdersPage(0, true)
    }
  }, [isActive, token, fetchOrdersPage])

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return
    setLoading(true)
    await fetchOrdersPage(currentPage + 1, false)
  }, [hasMore, loading, currentPage, fetchOrdersPage])

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchOrdersPage(0, true)
  }, [fetchOrdersPage])

  return {
    orders,
    loading,
    hasMore,
    totalCount,
    currentPage,
    error,
    loadMore,
    refresh,
    lastFetch: lastFetchRef.current,
  }
}
