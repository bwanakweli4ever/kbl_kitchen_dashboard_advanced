"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { User, Phone, ShoppingBag, RefreshCw } from "lucide-react"
import { ChatWidget } from "./chat-widget"

interface Customer {
  wa_id: string
  profile_name: string
  total_orders: number
  total_spent?: number | null
  last_order_date: string
  favorite_size?: string
  favorite_ingredients?: string[]
}

interface CustomersViewProps {
  token: string | null
}

export function CustomersView({ token }: CustomersViewProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      if (!token) return

      const response = await fetch("/api/customers", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (response.ok) {
        // Add null checks and default values for customer data
        const processedCustomers = (data.customers || []).map((customer: any) => ({
          wa_id: customer.wa_id || "N/A",
          profile_name: customer.profile_name || "Unknown Customer",
          total_orders: customer.total_orders || 0,
          total_spent: customer.total_spent || 0,
          last_order_date: customer.last_order_date || new Date().toISOString(),
          favorite_size: customer.favorite_size || null,
          favorite_ingredients: customer.favorite_ingredients || [],
        }))

        setCustomers(processedCustomers)
        setError(null)
      } else {
        setError(data.error || "Failed to fetch customers")
      }
    } catch (err) {
      console.error("Fetch customers error:", err)
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [token])

  const formatCurrency = (amount: number | null | undefined) => {
    // Handle null, undefined, or invalid numbers
    if (amount === null || amount === undefined || isNaN(amount)) {
      return "0 RWF"
    }
    return `${amount.toLocaleString()} RWF`
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A"
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch (error) {
      return "Invalid Date"
    }
  }

  const filteredCustomers = customers
    .filter(
      (customer) =>
        customer.profile_name?.toLowerCase().includes(searchTerm.toLowerCase()) || customer.wa_id?.includes(searchTerm),
    )
    .sort((a, b) => {
      // Sort by last_order_date (newest first)
      const dateA = new Date(a.last_order_date).getTime()
      const dateB = new Date(b.last_order_date).getTime()
      return dateB - dateA
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-green-500" />
          <p className="text-gray-600">Loading customers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-green-600">Customer Management</h2>
          <p className="text-gray-600">{customers.length} total customers</p>
        </div>
        <Button onClick={fetchCustomers} variant="outline" className="flex items-center gap-2 bg-transparent">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <Input
          placeholder="Search customers by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Error Message */}
      {error && <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">{error}</div>}

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((customer) => (
          <Card key={customer.wa_id} className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {customer.profile_name}
                </CardTitle>
                <Badge variant="outline" className="flex items-center gap-1">
                  <ShoppingBag className="h-3 w-3" />
                  {customer.total_orders || 0}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-4 w-4" />
                <span>{customer.wa_id}</span>
              </div>

              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-sm text-green-700 font-medium">Total Spent</div>
                <div className="text-lg font-bold text-green-800">{formatCurrency(customer.total_spent)}</div>
              </div>

              <div className="text-sm text-gray-600">
                <span className="font-medium">Last Order:</span> {formatDate(customer.last_order_date)}
              </div>

              {customer.favorite_size && (
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Favorite Size:</span>{" "}
                  <Badge variant="secondary">{customer.favorite_size}</Badge>
                </div>
              )}

              {customer.favorite_ingredients && customer.favorite_ingredients.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Favorite Ingredients:</div>
                  <div className="flex flex-wrap gap-1">
                    {customer.favorite_ingredients.slice(0, 3).map((ingredient, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {ingredient?.replace("-", " ") || "Unknown"}
                      </Badge>
                    ))}
                    {customer.favorite_ingredients.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{customer.favorite_ingredients.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              <ChatWidget customerName={customer.profile_name} phoneNumber={customer.wa_id} token={token} />
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCustomers.length === 0 && !loading && (
        <div className="text-center py-12">
          <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No customers found</h3>
          <p className="text-gray-500">
            {searchTerm ? "Try adjusting your search terms" : "Customer data will appear here"}
          </p>
        </div>
      )}
    </div>
  )
}
