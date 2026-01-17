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
  payment_method?: string
  payment_status?: string
  payment_received_at?: string
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
          prevOrder.order_source !== newOrder.order_source ||
          prevOrder.payment_status !== newOrder.payment_status ||
          prevOrder.payment_method !== newOrder.payment_method
        )
      })
      
      return hasChanges ? newOrders : prevOrders
    })
  }, [])

  // Simple fetch function with smooth updates
  const fetchOrders = useCallback(async () => {
    if (!token || !isActive) {
      return
    }

    try {
      // Show loading for all fetches
      setLoading(true)

      const response = await fetch(`/api/orders?limit=${config.dashboard.maxOrders}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()

        // Handle the correct API response format
        let ordersArray = []
        if (data.orders && Array.isArray(data.orders)) {
          ordersArray = data.orders
        } else if (Array.isArray(data)) {
          ordersArray = data
        } else {
          setOrdersOptimized([])
          return
        }

        if (ordersArray.length > 0) {
          // Filter for active orders and sort by completeness and creation time
          const activeOrders = ordersArray
            .filter((order: Order) => {
              const isActive = order.status && 
                !['delivered', 'cancelled'].includes(order.status.toLowerCase())
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
        } else {
          setOrdersOptimized([])
        }
      } else {
        console.error("Failed to fetch orders:", response.status, response.statusText)
        setOrdersOptimized([])
      }
    } catch (err) {
      console.error("Fetch error:", err)
      // Don't clear orders on error, just keep existing ones
    } finally {
      // Always set loading to false after fetch
      setLoading(false)
    }
  }, [token, isActive, onNewOrder, onOrderUpdate, setOrdersOptimized])

  // Refs for stable polling state
  const lastPollTimeRef = useRef(0)
  const pollingActiveRef = useRef(false)
  const consecutiveErrorsRef = useRef(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const POLL_DEBOUNCE = 10000 // Minimum 10 seconds between polls
  const MAX_POLL_INTERVAL = 60000 // Maximum 1 minute between polls
  
  // Stable polling function using refs
  const pollOrders = useCallback(async () => {
    if (!isActive || !token || pollingActiveRef.current) {
      return
    }

    const now = Date.now()
    
    // Skip if too soon since last poll
    if (now - lastPollTimeRef.current < POLL_DEBOUNCE) {
      return
    }
    
    try {
      pollingActiveRef.current = true
      setIsPolling(true)
      await fetchOrders()
      lastPollTimeRef.current = now
      consecutiveErrorsRef.current = 0 // Reset error count on success
    } catch (error) {
      console.error("Polling error:", error)
      consecutiveErrorsRef.current += 1
    } finally {
      setIsPolling(false)
      pollingActiveRef.current = false
    }
  }, [isActive, token, fetchOrders])
  
  useEffect(() => {
    if (!isActive || !token) {
      pollingActiveRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Initial fetch
    pollOrders()

    // Dynamic polling interval based on errors
    const getPollInterval = () => {
      if (consecutiveErrorsRef.current > 3) {
        return MAX_POLL_INTERVAL // Slow down on repeated errors
      }
      return config.dashboard.pollInterval
    }

    // Set up polling interval
    intervalRef.current = setInterval(pollOrders, getPollInterval())

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      pollingActiveRef.current = false
    }
  }, [isActive, token, pollOrders])

  // Manual refresh with debouncing
  const refreshOrders = useCallback(async () => {
    if (!token || pollingActiveRef.current) return
    
    const now = Date.now()
    if (now - lastPollTimeRef.current < 3000) { // Minimum 3 seconds between manual refreshes
      console.log("Manual refresh skipped - too soon since last fetch")
      return
    }
    
    setLoading(true) // Show loading for manual refresh
    lastPollTimeRef.current = now
    await fetchOrders()
  }, [fetchOrders, token])

  return {
    orders,
    loading,
    lastFetch,
    isPolling,
    refreshOrders,
  }
}
