"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { User, Phone, CheckCircle, RefreshCw, Utensils, Clock, Search, Package } from "lucide-react"
import { cn } from "@/lib/utils"

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
  customer_total_orders: number
  created_at: string
  updated_at: string
}

interface DeliveredOrdersViewProps {
  token: string | null
}

export function DeliveredOrdersView({ token }: DeliveredOrdersViewProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const fetchDeliveredOrders = async () => {
    try {
      setLoading(true)
      if (!token) {
        setError("No authentication token available")
        return
      }

      // Fetch all orders and filter for delivered ones
      const response = await fetch("/api/orders?limit=100", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (response.ok) {
        // Filter for delivered orders only
        const deliveredOrders = (data.orders || []).filter((order: Order) => order.status.toLowerCase() === "delivered")

        // Sort by updated_at (most recent first)
        deliveredOrders.sort(
          (a: Order, b: Order) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )

        setOrders(deliveredOrders)
        setError(null)
      } else {
        setError(data.error || "Failed to fetch delivered orders")
      }
    } catch (err) {
      console.error("Fetch delivered orders error:", err)
      setError("Network error - check your connection")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchDeliveredOrders()
    }
  }, [token])

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} RWF`
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString()
    } catch (error) {
      return "Invalid Date"
    }
  }

  const getSpiceLevel = (level: string) => {
    switch (level.toLowerCase()) {
      case "mild":
        return { color: "bg-green-100 text-green-800", label: "Mild" }
      case "medium":
        return { color: "bg-yellow-100 text-yellow-800", label: "Medium" }
      case "hot":
        return { color: "bg-red-100 text-red-800", label: "Hot" }
      default:
        return { color: "bg-gray-100 text-gray-800", label: level }
    }
  }

  const categorizeIngredients = (ingredients: string[]) => {
    const proteins = ingredients.filter((ingredient) =>
      ["chicken", "beef", "turkey", "bacon", "fish", "tuna", "salmon"].includes(ingredient.toLowerCase()),
    )

    const vegetables = ingredients.filter((ingredient) =>
      [
        "tomatoes",
        "cucumber",
        "red-pepper",
        "green-pepper",
        "yellow-pepper",
        "white-onion",
        "red-onion",
        "lettuce",
        "spinach",
        "avocado",
      ].includes(ingredient.toLowerCase()),
    )

    const others = ingredients.filter(
      (ingredient) => !proteins.includes(ingredient) && !vegetables.includes(ingredient),
    )

    return { proteins, vegetables, others }
  }

  const filteredOrders = orders.filter(
    (order) =>
      order.profile_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.wa_id.includes(searchTerm) ||
      order.id.toString().includes(searchTerm),
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-green-500" />
          <p className="text-gray-600">Loading delivered orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-green-600">📦 Delivered Orders</h2>
          <p className="text-gray-600">{orders.length} completed deliveries</p>
        </div>
        <Button onClick={fetchDeliveredOrders} variant="outline" className="flex items-center gap-2 bg-transparent">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by order ID, customer name, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">{error}</div>}

      {/* Orders Grid */}
      {filteredOrders.length === 0 && !loading && !error && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            {searchTerm ? "No matching delivered orders" : "No delivered orders yet"}
          </h3>
          <p className="text-gray-500">
            {searchTerm ? "Try adjusting your search terms" : "Delivered orders will appear here"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOrders.map((order) => {
          const spiceLevel = getSpiceLevel(order.spice_level)
          const { proteins, vegetables, others } = categorizeIngredients(order.ingredients)

          return (
            <Card
              key={order.id}
              className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-l-green-500 bg-white"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-gray-800">Order #{order.id}</CardTitle>
                  <Badge className="bg-green-500 text-white flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    Delivered
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{order.profile_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {order.customer_total_orders} orders
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{order.wa_id}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Delivered: {formatDate(order.updated_at)}</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Order Summary */}
                <div className="bg-green-50 p-3 rounded-lg border-l-2 border-green-300">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-green-800">
                        {order.size} Sandwich × {order.quantity}
                      </span>
                    </div>
                    <span className="font-bold text-green-600">{formatCurrency(order.food_total)}</span>
                  </div>
                </div>

                {/* Ingredients Summary */}
                <div>
                  <h4 className="font-semibold text-green-700 mb-2 flex items-center gap-1">
                    🥬 Ingredients ({order.ingredients.length})
                  </h4>

                  <div className="space-y-2">
                    {/* Proteins */}
                    {proteins.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-red-700 mb-1">🍖 PROTEINS</div>
                        <div className="flex flex-wrap gap-1">
                          {proteins.map((protein, idx) => (
                            <Badge key={idx} className="bg-red-100 text-red-800 text-xs">
                              {protein.replace("-", " ")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Vegetables */}
                    {vegetables.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-green-700 mb-1">🥗 VEGETABLES</div>
                        <div className="flex flex-wrap gap-1">
                          {vegetables.slice(0, 4).map((vegetable, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {vegetable.replace("-", " ")}
                            </Badge>
                          ))}
                          {vegetables.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{vegetables.length - 4} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Others */}
                    {others.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-blue-700 mb-1">🧀 OTHERS</div>
                        <div className="flex flex-wrap gap-1">
                          {others.slice(0, 3).map((other, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {other.replace("-", " ")}
                            </Badge>
                          ))}
                          {others.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{others.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sauce & Spice Level */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-purple-700 mb-1 text-sm">🍯 Sauce</h4>
                    <Badge variant="outline" className="text-xs">
                      {order.sauce.replace("-", " ")}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-700 mb-1 text-sm">🌶️ Spice</h4>
                    <Badge className={cn("text-xs", spiceLevel.color)}>{spiceLevel.label}</Badge>
                  </div>
                </div>

                {/* Delivery Info */}
                {order.delivery_info && (
                  <div>
                    <h4 className="font-semibold text-blue-700 mb-1 text-sm">🚚 Delivery</h4>
                    <div className="bg-blue-50 p-2 rounded text-xs border border-blue-200 text-blue-800">
                      {order.delivery_info}
                    </div>
                  </div>
                )}

                {/* Order Timeline */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h4 className="font-semibold text-gray-700 mb-2 text-sm">📅 Order Timeline</h4>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div>Ordered: {formatDate(order.created_at)}</div>
                    <div>Delivered: {formatDate(order.updated_at)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
