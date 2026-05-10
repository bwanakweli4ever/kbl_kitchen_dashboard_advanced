"use client"

import { useState, useCallback, useRef } from "react"

export interface Customer {
  id: number
  wa_id: string
  phone_number: string
  email?: string
  profile_name?: string
  total_orders: number
  created_at?: string
  updated_at?: string
}

interface PaginatedCustomersResponse {
  customers: Customer[]
  count: number
  total_count: number
  limit: number
  offset: number
  has_more: boolean
}

interface UsePaginatedCustomersProps {
  token: string | null
  isActive: boolean
  pageSize?: number
}

export function usePaginatedCustomers({
  token,
  isActive,
  pageSize = 20,
}: UsePaginatedCustomersProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const isFetchingRef = useRef(false)

  const fetchCustomersPage = useCallback(
    async (page: number, reset: boolean = false) => {
      if (!token || !isActive || isFetchingRef.current) {
        return { customers: [], hasMore: false }
      }

      try {
        isFetchingRef.current = true
        setError(null)

        const offset = page * pageSize
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        const response = await (async () => {
          try {
            return await fetch(`/api/customers?limit=${pageSize}&offset=${offset}`, {
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
          setError("Failed to fetch customers")
          return { customers: [], hasMore: false }
        }

        const data: PaginatedCustomersResponse = await response.json()

        if (reset) {
          setCustomers(data.customers)
          setCurrentPage(0)
        } else {
          setCustomers((prev) => [...prev, ...data.customers])
        }

        setTotalCount(data.total_count || 0)
        setHasMore(data.has_more || false)
        setCurrentPage(page)

        return { customers: data.customers, hasMore: data.has_more || false }
      } catch (err) {
        const errName = (err as { name?: string })?.name
        if (errName !== "AbortError") {
          console.error("Failed to fetch customers page:", err)
          setError("Network error while fetching customers")
        }
        return { customers: [], hasMore: false }
      } finally {
        isFetchingRef.current = false
        setLoading(false)
      }
    },
    [token, isActive, pageSize]
  )

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return
    setLoading(true)
    await fetchCustomersPage(currentPage + 1, false)
  }, [hasMore, loading, currentPage, fetchCustomersPage])

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchCustomersPage(0, true)
  }, [fetchCustomersPage])

  return {
    customers,
    loading,
    hasMore,
    totalCount,
    currentPage,
    error,
    loadMore,
    refresh,
  }
}
