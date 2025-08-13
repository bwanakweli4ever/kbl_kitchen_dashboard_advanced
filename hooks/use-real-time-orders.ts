"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { config } from "@/lib/config"

interface Order {
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
  status: string
  items: string // JSON string containing array of food items
  drinks: string // JSON string containing array of drink items
  order_source: string
  customer_total_orders: number
  created_at: string
  updated_at: string
}

interface UseRealTimeOrdersProps {
  token: string | null
  isActive: boolean
  onNewOrder?: (order: Order) => void
  onOrderUpdate?: (order: Order) => void
}

export function useRealTimeOrders({
  token,
  isActive,
  onNewOrder,
  onOrderUpdate,
}: {
  token: string | null
  isActive: boolean
  onNewOrder?: (order: Order) => void
  onOrderUpdate?: (order: Order) => void
}) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  // Refs for tracking order changes
  const lastOrderIdsRef = useRef<Set<number>>(new Set())
  const previousOrdersRef = useRef<Order[]>([])

  // Smooth state update - only update if there are actual changes
  const setOrdersOptimized = useCallback((newOrders: Order[]) => {
    setOrders((prevOrders) => {
      // Only update if there are actual changes
      if (prevOrders.length !== newOrders.length) {
        return newOrders
      }
      
      // Deep comparison to check if data actually changed
      const hasChanges = prevOrders.some((prevOrder, index) => {
        const newOrder = newOrders[index]
        if (!newOrder) return true
        
        // Check only critical fields that affect display
        return (
          prevOrder.id !== newOrder.id ||
          prevOrder.status !== newOrder.status ||
          prevOrder.updated_at !== newOrder.updated_at ||
          prevOrder.food_total !== newOrder.food_total ||
          prevOrder.size !== newOrder.size ||
          prevOrder.quantity !== newOrder.quantity ||
          prevOrder.ingredients.length !== newOrder.ingredients.length ||
          prevOrder.items !== newOrder.items ||
          prevOrder.drinks !== newOrder.drinks ||
          prevOrder.order_source !== newOrder.order_source
        )
      })
      
      return hasChanges ? newOrders : prevOrders
    })
  }, [])

  // Simple fetch function with smooth updates
  const fetchOrders = useCallback(async () => {
    if (!token || !isActive) {
      console.log("🚫 Fetch blocked:", { hasToken: !!token, isActive })
      return
    }

    try {
      console.log("🔄 Fetching orders...")
      // Don't show loading for subsequent fetches (smooth updates)
      if (orders.length === 0) {
        setLoading(true)
      }

      const response = await fetch(`/api/orders?limit=${config.dashboard.maxOrders}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      console.log("📡 API response status:", response.status)

      if (response.ok) {
        const data = await response.json()
        console.log("📦 Raw API response:", data)

        // Handle the correct API response format
        let ordersArray = []
        if (data.orders && Array.isArray(data.orders)) {
          ordersArray = data.orders
          console.log("✅ Found orders in data.orders:", ordersArray.length)
        } else if (Array.isArray(data)) {
          ordersArray = data
          console.log("✅ Found orders as direct array:", ordersArray.length)
        } else {
          console.warn("❌ Orders data format not recognized:", data)
          setOrdersOptimized([])
          return
        }

        if (ordersArray.length > 0) {
          console.log("🔍 Processing", ordersArray.length, "orders")
          // Filter for active orders and sort by completeness and creation time
          const activeOrders = ordersArray
            .filter((order: Order) => {
              const isActive = order.status && 
                !['delivered', 'cancelled'].includes(order.status.toLowerCase())
              console.log(`Order ${order.id} status: ${order.status} -> active: ${isActive}`)
              return isActive
            })
            .sort((a: Order, b: Order) => {
              // First, sort by completeness (complete orders first)
              const aHasItems = a.items && a.items !== 'null' && a.items !== 'undefined'
              const bHasItems = b.items && b.items !== 'null' && b.items !== 'undefined'
              
              if (aHasItems && !bHasItems) return -1
              if (!aHasItems && bHasItems) return 1
              
              // Then by creation time (newest first)
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            })

          console.log("🎯 Active orders after filtering:", activeOrders.length)

          // Check for new orders
          const currentOrderIds = new Set<number>(activeOrders.map((order: Order) => order.id))
          const previousOrderIds = lastOrderIdsRef.current

          if (previousOrderIds.size > 0) {
            const newOrderIds = Array.from(currentOrderIds).filter((id: number) => !previousOrderIds.has(id))
            if (newOrderIds.length > 0) {
              const newOrders = activeOrders.filter((order: Order) => newOrderIds.includes(order.id))
              newOrders.forEach((order: Order) => onNewOrder?.(order))
            }

            // Check for status updates (smooth updates without visual changes)
            activeOrders.forEach((order: Order) => {
              const previousOrder = previousOrdersRef.current.find((o) => o.id === order.id)
              if (previousOrder && previousOrder.status !== order.status) {
                onOrderUpdate?.(order)
              }
            })
          }

          lastOrderIdsRef.current = currentOrderIds
          previousOrdersRef.current = activeOrders

          // Use optimized setter to prevent unnecessary re-renders
          setOrdersOptimized(activeOrders)
          setLastFetch(new Date())
          console.log("✅ Orders updated successfully")
        } else {
          console.log("📭 No active orders found")
          setOrdersOptimized([])
        }
      } else {
        console.error("❌ Failed to fetch orders:", response.status, response.statusText)
        setOrdersOptimized([])
      }
    } catch (err) {
      console.error("❌ Fetch error:", err)
      // Don't clear orders on error, just keep existing ones
    } finally {
      // Only set loading to false for initial load
      if (orders.length === 0) {
        setLoading(false)
      }
    }
  }, [token, isActive, onNewOrder, onOrderUpdate, orders.length, setOrdersOptimized])

  // Debounced polling to prevent rapid updates
  const [lastPollTime, setLastPollTime] = useState(0)
  const POLL_DEBOUNCE = 2000 // Minimum 2 seconds between polls
  
  useEffect(() => {
    if (!isActive || !token) return

    const pollOrders = async () => {
      const now = Date.now()
      if (now - lastPollTime < POLL_DEBOUNCE) {
        return // Skip if too soon since last poll
      }
      
      try {
        setIsPolling(true)
        await fetchOrders()
        setLastPollTime(now)
      } catch (error) {
        console.error("Polling error:", error)
      } finally {
        setIsPolling(false)
      }
    }

    // Initial fetch
    pollOrders()

    // Set up polling interval
    const interval = setInterval(pollOrders, config.dashboard.pollInterval)

    return () => clearInterval(interval)
  }, [isActive, token, lastPollTime, fetchOrders])

  // Manual refresh
  const refreshOrders = useCallback(async () => {
    if (!token) return
    await fetchOrders()
  }, [fetchOrders])

  return {
    orders,
    loading,
    lastFetch,
    isPolling,
    refreshOrders,
  }
}
