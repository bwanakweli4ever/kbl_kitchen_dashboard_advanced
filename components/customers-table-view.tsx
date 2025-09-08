"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { User, Phone, RefreshCw, Search, Filter, ChevronLeft, ChevronRight, Download } from "lucide-react"
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

interface CustomersTableViewProps {
  token: string | null
}

export function CustomersTableView({ token }: CustomersTableViewProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<string>("last_order_date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [filterBy, setFilterBy] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      if (!token) return

      const response = await fetch("/api/customers?limit=1000", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (response.ok) {
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

  // Export to CSV function
  const exportToCSV = () => {
    const headers = [
      "Customer Name",
      "Phone Number",
      "Total Orders",
      "Total Spent",
      "Last Order Date",
      "Favorite Size",
      "Favorite Ingredients",
    ]

    const csvData = filteredAndSortedCustomers.map((customer) => [
      customer.profile_name,
      customer.wa_id,
      customer.total_orders,
      customer.total_spent || 0,
      formatDate(customer.last_order_date),
      customer.favorite_size || "",
      (customer.favorite_ingredients || []).join("; "),
    ])

    const csvContent = [headers.join(","), ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `customers_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filter and sort customers
  const filteredAndSortedCustomers = useMemo(() => {
    const filtered = customers.filter((customer) => {
      const matchesSearch =
        customer.profile_name?.toLowerCase().includes(searchTerm.toLowerCase()) || customer.wa_id?.includes(searchTerm)

      const matchesFilter = (() => {
        switch (filterBy) {
          case "high_value":
            return (customer.total_spent || 0) > 50000
          case "frequent":
            return customer.total_orders > 5
          case "recent":
            const lastOrderDate = new Date(customer.last_order_date)
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            return lastOrderDate > thirtyDaysAgo
          default:
            return true
        }
      })()

      return matchesSearch && matchesFilter
    })

    // Sort customers
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortBy) {
        case "name":
          aValue = a.profile_name?.toLowerCase() || ""
          bValue = b.profile_name?.toLowerCase() || ""
          break
        case "total_spent":
          aValue = a.total_spent || 0
          bValue = b.total_spent || 0
          break
        case "last_order_date":
          aValue = new Date(a.last_order_date).getTime()
          bValue = new Date(b.last_order_date).getTime()
          break
        case "total_orders":
        default:
          aValue = a.total_orders
          bValue = b.total_orders
          break
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [customers, searchTerm, sortBy, sortOrder, filterBy])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedCustomers.length / itemsPerPage)
  const paginatedCustomers = filteredAndSortedCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  )

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(column)
      setSortOrder("desc")
    }
  }

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
          <p className="text-gray-600">
            {filteredAndSortedCustomers.length} of {customers.length} customers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={fetchCustomers} variant="outline" className="flex items-center gap-2 bg-transparent">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name or phone number..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Select
                value={filterBy}
                onValueChange={(value) => {
                  setFilterBy(value)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="high_value">High Value (50K+)</SelectItem>
                  <SelectItem value="frequent">Frequent (5+ orders)</SelectItem>
                  <SelectItem value="recent">Recent (30 days)</SelectItem>
                </SelectContent>
              </Select>

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
                  <SelectItem value="total_orders-desc">Most Orders</SelectItem>
                  <SelectItem value="total_orders-asc">Least Orders</SelectItem>
                  <SelectItem value="total_spent-desc">Highest Spent</SelectItem>
                  <SelectItem value="total_spent-asc">Lowest Spent</SelectItem>
                  <SelectItem value="last_order_date-desc">Most Recent</SelectItem>
                  <SelectItem value="last_order_date-asc">Oldest</SelectItem>
                  <SelectItem value="name-asc">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">{error}</div>}

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Customer
                    {sortBy === "name" && <span>{sortOrder === "asc" ? "↑" : "↓"}</span>}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("total_orders")}>
                  <div className="flex items-center gap-2">
                    Orders
                    {sortBy === "total_orders" && <span>{sortOrder === "asc" ? "↑" : "↓"}</span>}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("total_spent")}>
                  <div className="flex items-center gap-2">
                    Total Spent
                    {sortBy === "total_spent" && <span>{sortOrder === "asc" ? "↑" : "↓"}</span>}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("last_order_date")}>
                  <div className="flex items-center gap-2">
                    Last Order
                    {sortBy === "last_order_date" && <span>{sortOrder === "asc" ? "↑" : "↓"}</span>}
                  </div>
                </TableHead>
                <TableHead>Preferences</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCustomers.map((customer) => (
                <TableRow key={customer.wa_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{customer.profile_name}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {customer.wa_id}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      {customer.total_orders}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-green-600">{formatCurrency(customer.total_spent)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{formatDate(customer.last_order_date)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {customer.favorite_size && (
                        <Badge variant="secondary" className="text-xs">
                          {customer.favorite_size}
                        </Badge>
                      )}
                      {customer.favorite_ingredients && customer.favorite_ingredients.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {customer.favorite_ingredients.slice(0, 2).map((ingredient, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {ingredient?.replace("-", " ")}
                            </Badge>
                          ))}
                          {customer.favorite_ingredients.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{customer.favorite_ingredients.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ChatWidget customerName={customer.profile_name} phoneNumber={customer.wa_id} token={token} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {paginatedCustomers.length === 0 && !loading && (
            <div className="text-center py-12">
              <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No customers found</h3>
              <p className="text-gray-500">
                {searchTerm || filterBy !== "all"
                  ? "Try adjusting your search or filters"
                  : "Customer data will appear here"}
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
            {Math.min(currentPage * itemsPerPage, filteredAndSortedCustomers.length)} of{" "}
            {filteredAndSortedCustomers.length} customers
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
    </div>
  )
}
