"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Phone,
  CheckCircle,
  RefreshCw,
  Search,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Package,
  Download,
} from "lucide-react"
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

interface DeliveredOrdersCalendarViewProps {
  token: string | null
}

export function DeliveredOrdersCalendarView({ token }: DeliveredOrdersCalendarViewProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
  })
  const [viewMode, setViewMode] = useState<"calendar" | "table">("calendar")
  const [sortBy, setSortBy] = useState<string>("updated_at")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  const fetchDeliveredOrders = async () => {
    try {
      setLoading(true)
      if (!token) {
        setError("No authentication token available")
        return
      }

      // Fetch more orders to handle large datasets
      const response = await fetch("/api/orders?limit=1000", {
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

  const formatDateShort = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch (error) {
      return "Invalid Date"
    }
  }

  // Group orders by date for calendar view
  const ordersByDate = useMemo(() => {
    const grouped: Record<string, Order[]> = {}
    orders.forEach((order) => {
      const dateKey = new Date(order.updated_at).toDateString()
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(order)
    })
    return grouped
  }, [orders])

  // Get orders for selected date
  const selectedDateOrders = useMemo(() => {
    const dateKey = selectedDate.toDateString()
    return ordersByDate[dateKey] || []
  }, [ordersByDate, selectedDate])

  // Filter and sort orders for table view
  const filteredAndSortedOrders = useMemo(() => {
    const filtered = orders.filter((order) => {
      const matchesSearch =
        order.profile_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.wa_id.includes(searchTerm) ||
        order.id.toString().includes(searchTerm)

      const orderDate = new Date(order.updated_at)
      const matchesDateRange = orderDate >= dateRange.from && orderDate <= dateRange.to

      return matchesSearch && matchesDateRange
    })

    // Sort orders
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortBy) {
        case "customer_name":
          aValue = a.profile_name.toLowerCase()
          bValue = b.profile_name.toLowerCase()
          break
        case "food_total":
          aValue = a.food_total
          bValue = b.food_total
          break
        case "created_at":
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        case "updated_at":
        default:
          aValue = new Date(a.updated_at).getTime()
          bValue = new Date(b.updated_at).getTime()
          break
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [orders, searchTerm, dateRange, sortBy, sortOrder])

  // Pagination for table view
  const totalPages = Math.ceil(filteredAndSortedOrders.length / itemsPerPage)
  const paginatedOrders = filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Calculate daily stats
  const dailyStats = useMemo(() => {
    const stats: Record<string, { count: number; revenue: number }> = {}
    orders.forEach((order) => {
      const dateKey = new Date(order.updated_at).toDateString()
      if (!stats[dateKey]) {
        stats[dateKey] = { count: 0, revenue: 0 }
      }
      stats[dateKey].count++
      stats[dateKey].revenue += order.food_total
    })
    return stats
  }, [orders])

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

  const exportToCSV = (ordersToExport: Order[], filename: string) => {
    const headers = [
      "Order ID",
      "Customer Name",
      "Phone",
      "Size",
      "Quantity",
      "Amount",
      "Spice Level",
      "Sauce",
      "Ingredients",
      "Delivery Info",
      "Ordered Date",
      "Delivered Date",
    ]

    const csvData = ordersToExport.map((order) => [
      order.id,
      order.profile_name,
      order.wa_id,
      order.size,
      order.quantity,
      order.food_total,
      order.spice_level,
      order.sauce.replace("-", " "),
      order.ingredients.join("; "),
      order.delivery_info || "",
      formatDateShort(order.created_at),
      formatDateShort(order.updated_at),
    ])

    const csvContent = [headers.join(","), ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
        <div className="flex items-center gap-2">
          <Button
            onClick={() => exportToCSV(orders, `all_delivered_orders_${new Date().toISOString().split("T")[0]}.csv`)}
            variant="outline"
            className="flex items-center gap-2 bg-transparent"
          >
            <Download className="h-4 w-4" />
            Export All
          </Button>
          <Button onClick={fetchDeliveredOrders} variant="outline" className="flex items-center gap-2 bg-transparent">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* View Toggle */}
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "calendar" | "table")}>
        <TabsList>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar View
          </TabsTrigger>
          <TabsTrigger value="table" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Table View
          </TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Select Date</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  modifiers={{
                    hasOrders: (date) => {
                      const dateKey = date.toDateString()
                      return !!ordersByDate[dateKey]
                    },
                  }}
                  modifiersStyles={{
                    hasOrders: {
                      backgroundColor: "#dcfce7",
                      color: "#166534",
                      fontWeight: "bold",
                    },
                  }}
                  className="w-full"
                />
                <div className="mt-4 text-sm text-gray-600 p-2 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                    <span>Days with deliveries</span>
                  </div>
                  <div>
                    Selected: <strong>{selectedDate.toLocaleDateString()}</strong>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Selected Date Orders */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Orders for {selectedDate.toLocaleDateString()}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {selectedDateOrders.length} orders
                    </Badge>
                    {selectedDateOrders.length > 0 && (
                      <Button
                        onClick={() =>
                          exportToCSV(selectedDateOrders, `orders_${selectedDate.toISOString().split("T")[0]}.csv`)
                        }
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                        Export
                      </Button>
                    )}
                  </div>
                </div>
                {dailyStats[selectedDate.toDateString()] && (
                  <div className="text-sm text-gray-600">
                    Total Revenue: <strong>{formatCurrency(dailyStats[selectedDate.toDateString()].revenue)}</strong>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {selectedDateOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-500">No deliveries on this date</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {selectedDateOrders.map((order) => {
                      const spiceLevel = getSpiceLevel(order.spice_level)
                      return (
                        <div key={order.id} className="border rounded-lg p-3 bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Order #{order.id}</span>
                              <Badge className="bg-green-500 text-white">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Delivered
                              </Badge>
                            </div>
                            <span className="font-bold text-green-600">{formatCurrency(order.food_total)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">Customer:</span> {order.profile_name}
                            </div>
                            <div>
                              <span className="text-gray-600">Size:</span> {order.size} × {order.quantity}
                            </div>
                            <div>
                              <span className="text-gray-600">Delivered:</span> {formatDate(order.updated_at)}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-600">Spice:</span>
                              <Badge className={cn("text-xs", spiceLevel.color)}>{spiceLevel.label}</Badge>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Table View */}
        <TabsContent value="table" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by order ID, customer name, or phone..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="pl-10"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      exportToCSV(
                        filteredAndSortedOrders,
                        `filtered_delivered_orders_${new Date().toISOString().split("T")[0]}.csv`,
                      )
                    }
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export Filtered
                  </Button>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">From:</span>
                    <Input
                      type="date"
                      value={dateRange.from.toISOString().split("T")[0]}
                      onChange={(e) => {
                        setDateRange((prev) => ({ ...prev, from: new Date(e.target.value) }))
                        setCurrentPage(1)
                      }}
                      className="w-40"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">To:</span>
                    <Input
                      type="date"
                      value={dateRange.to.toISOString().split("T")[0]}
                      onChange={(e) => {
                        setDateRange((prev) => ({ ...prev, to: new Date(e.target.value) }))
                        setCurrentPage(1)
                      }}
                      className="w-40"
                    />
                  </div>

                  <Select
                    value={`${sortBy}-${sortOrder}`}
                    onValueChange={(value) => {
                      const [column, order] = value.split("-")
                      setSortBy(column)
                      setSortOrder(order as "asc" | "desc")
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated_at-desc">Most Recent</SelectItem>
                      <SelectItem value="updated_at-asc">Oldest</SelectItem>
                      <SelectItem value="food_total-desc">Highest Value</SelectItem>
                      <SelectItem value="food_total-asc">Lowest Value</SelectItem>
                      <SelectItem value="customer_name-asc">Customer A-Z</SelectItem>
                      <SelectItem value="customer_name-desc">Customer Z-A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Message */}
          {error && <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">{error}</div>}

          {/* Orders Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Delivered</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order) => {
                    const spiceLevel = getSpiceLevel(order.spice_level)
                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">#{order.id}</span>
                            <Badge className="bg-green-500 text-white">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Delivered
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.profile_name}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {order.wa_id}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {order.size} × {order.quantity}
                            </div>
                            <div className="text-sm text-gray-500">{order.ingredients.length} ingredients</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-green-600">{formatCurrency(order.food_total)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatDate(order.updated_at)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge className={cn("text-xs", spiceLevel.color)}>{spiceLevel.label}</Badge>
                            <div className="text-xs text-gray-500">{order.sauce.replace("-", " ")}</div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {paginatedOrders.length === 0 && !loading && (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">No delivered orders found</h3>
                  <p className="text-gray-500">
                    {searchTerm ? "Try adjusting your search terms" : "Delivered orders will appear here"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredAndSortedOrders.length)} of{" "}
                {filteredAndSortedOrders.length} orders
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
