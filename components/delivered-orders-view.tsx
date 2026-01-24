"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { User, Phone, CheckCircle, RefreshCw, Clock, Search, Package, Copy, Truck, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { reverseGeocode } from "@/lib/reverse-geocode"
import { parseCoordinates } from "./delivery-map"

interface Order {
  id: number
  wa_id: string
  profile_name: string
  size: string
  quantity: number
  ingredients: string[]
  spice_level: string
  sauce: string
  food_total: number | null
  delivery_info: string
  delivery_latitude?: number | null
  delivery_longitude?: number | null
  delivery_address?: string | null
  status: string
  customer_total_orders: number
  created_at: string
  updated_at: string
  items?: string
  drinks?: string
  rider_name?: string | null
  rider_phone?: string | null
  rider_assigned_at?: string | null
  delivered_at?: string | null
  delivery_comment?: string | null
}

interface DeliveredOrdersViewProps {
  token: string | null
}

export function DeliveredOrdersView({ token }: DeliveredOrdersViewProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [riderFilter, setRiderFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const copyDeliveryInfo = async (order: Order) => {
    try {
      // Get current date in DD/MM/YYYY format
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dateStr = `${day}/${month}/${year}`;

      // Format customer phone number
      const customerPhone = order.wa_id.startsWith('+') 
        ? order.wa_id 
        : `+${order.wa_id}`;

      // Get coordinates - prefer order coordinates, fallback to parsing from delivery_info
      let latitude: number | null = order.delivery_latitude ?? null;
      let longitude: number | null = order.delivery_longitude ?? null;
      
      // If no coordinates, try to parse from delivery_info
      if ((latitude === null || longitude === null) && order.delivery_info) {
        const parsed = parseCoordinates(order.delivery_info);
        latitude = parsed.latitude;
        longitude = parsed.longitude;
      }

      // Get detailed address information using reverse geocoding
      let streetAddress = order.delivery_address || order.delivery_info || 'To be arranged';
      let areaNeighborhood = '';
      let cityDistrict = '';
      
      if (latitude !== null && longitude !== null && 
          !isNaN(latitude) && !isNaN(longitude) &&
          latitude >= -90 && latitude <= 90 &&
          longitude >= -180 && longitude <= 180) {
        try {
          const addressDetails = await reverseGeocode(latitude, longitude);
          if (addressDetails) {
            // Format street address
            if (addressDetails.houseNumber && addressDetails.street) {
              streetAddress = `${addressDetails.houseNumber} ${addressDetails.street}`;
            } else if (addressDetails.street) {
              streetAddress = addressDetails.street;
            } else if (order.delivery_address) {
              streetAddress = order.delivery_address;
            }
            
            // Get area/neighborhood
            areaNeighborhood = addressDetails.neighborhood || addressDetails.suburb || '';
            
            // Format city/district
            const cityParts: string[] = [];
            if (addressDetails.city) cityParts.push(addressDetails.city);
            if (addressDetails.district && addressDetails.district !== addressDetails.city) {
              cityParts.push(addressDetails.district);
            }
            cityDistrict = cityParts.join(', ');
          }
        } catch (geocodeError) {
          console.warn('Reverse geocoding failed, using fallback address:', geocodeError);
        }
      }

      // Format delivery info text with detailed address
      let receiverAddressSection = `Receiver Address:
Street Address
${streetAddress}`;
      
      if (areaNeighborhood) {
        receiverAddressSection += `\nArea/Neighborhood
${areaNeighborhood}`;
      }
      
      if (cityDistrict) {
        receiverAddressSection += `\nCity/District
${cityDistrict}`;
      }
      
      if (latitude !== null && longitude !== null) {
        receiverAddressSection += `\nCoordinates
${latitude}, ${longitude}`;
      }

      const deliveryText = `Date: ${dateStr}
KBL Coffee 

First pick up
Sender: KBL Coffee
Phone : 0787255672/+250 795 019 523
Location: 2 KG 182 ST

Receiver: ${order.profile_name || order.wa_id}
Phone: ${customerPhone}
${receiverAddressSection}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(deliveryText);
      
      setSuccessMessage(`✅ Delivery info copied to clipboard for Order #${order.id}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError("Failed to copy delivery info");
      setTimeout(() => setError(null), 5000);
    }
  };

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

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return "0 RWF";
    }
    return `${amount.toLocaleString()} RWF`
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString()
    } catch (error) {
      return "Invalid Date"
    }
  }

  const getDeliveredAt = (order: Order) => order.delivered_at || order.updated_at

  const getDeliveryTimeMinutes = (order: Order) => {
    if (!order.rider_assigned_at || !order.delivered_at) return null
    const assigned = new Date(order.rider_assigned_at).getTime()
    const delivered = new Date(order.delivered_at).getTime()
    if (Number.isNaN(assigned) || Number.isNaN(delivered)) return null
    return Math.max(0, Math.round((delivered - assigned) / (1000 * 60)))
  }

  const formatDeliveryTime = (minutes: number | null) => {
    if (minutes === null) return "N/A"
    const hours = Math.floor(minutes / 60)
    const remaining = minutes % 60
    return hours > 0 ? `${hours}h ${remaining}m` : `${minutes} minutes`
  }

  const getSpiceLevel = (level: string | null | undefined) => {
    const normalized = (level || "None").toString().toLowerCase()
    switch (normalized) {
      case "mild":
        return { color: "bg-green-100 text-green-800", label: "Mild" }
      case "medium":
        return { color: "bg-yellow-100 text-yellow-800", label: "Medium" }
      case "hot":
        return { color: "bg-red-100 text-red-800", label: "Hot" }
      default:
        return { color: "bg-gray-100 text-gray-800", label: level || "None" }
    }
  }

  const normalizeIngredient = (ingredient: string | null | undefined) =>
    (ingredient || "").toString().trim()

  const getOrderSummary = (order: Order) => {
    const size = order.size || "N/A"
    const qty = order.quantity || 0
    return `${size} × ${qty}`
  }

  const filteredOrders = orders.filter((order) => {
    const term = searchTerm.toLowerCase()
    const riderTerm = riderFilter.toLowerCase()
    const deliveredAt = new Date(getDeliveredAt(order))

    const matchesSearch =
      order.profile_name.toLowerCase().includes(term) ||
      order.wa_id.includes(searchTerm) ||
      order.id.toString().includes(searchTerm) ||
      (order.rider_name || "").toLowerCase().includes(term) ||
      (order.rider_phone || "").includes(searchTerm)

    const matchesRider =
      riderTerm.length === 0 ||
      (order.rider_name || "").toLowerCase().includes(riderTerm) ||
      (order.rider_phone || "").includes(riderFilter)

    const fromOk = dateFrom ? deliveredAt >= new Date(`${dateFrom}T00:00:00`) : true
    const toOk = dateTo ? deliveredAt <= new Date(`${dateTo}T23:59:59`) : true

    return matchesSearch && matchesRider && fromOk && toOk
  })

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
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
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

      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by order ID, customer, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Input
          placeholder="Filter by rider name or phone..."
          value={riderFilter}
          onChange={(e) => setRiderFilter(e.target.value)}
        />
        <div className="flex gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {/* Error Message */}
      {error && <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">{error}</div>}

      {/* Orders Table */}
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

      {filteredOrders.length > 0 && (
        <div className="border rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Spice</TableHead>
                <TableHead>Sauce</TableHead>
                <TableHead>Rider</TableHead>
                <TableHead>Delivered At</TableHead>
                <TableHead>Delivery Time</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const spiceLevel = getSpiceLevel(order.spice_level)
                const deliveryTime = formatDeliveryTime(getDeliveryTimeMinutes(order))
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-semibold">#{order.id}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-gray-800">{order.profile_name || "Unknown"}</div>
                      <div className="text-xs text-gray-500">{order.wa_id}</div>
                    </TableCell>
                    <TableCell className="text-sm">{getOrderSummary(order)}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", spiceLevel.color)}>{spiceLevel.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {(order.sauce || "None").toString().replace("-", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-700">
                        {order.rider_name || "N/A"}
                        {order.rider_phone ? ` (${order.rider_phone})` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(getDeliveredAt(order))}</TableCell>
                    <TableCell className="text-sm">{deliveryTime}</TableCell>
                    <TableCell className="font-semibold text-green-700">
                      {formatCurrency(order.food_total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1"
                          onClick={() => {
                            setSelectedOrder(order)
                            setIsDetailOpen(true)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          Details
                        </Button>
                        <Button
                          size="sm"
                          className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                          onClick={() => copyDeliveryInfo(order)}
                        >
                          <Copy size={14} />
                          Copy
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order #{selectedOrder?.id} Details</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Customer</div>
                  <div className="font-semibold text-gray-800">{selectedOrder.profile_name}</div>
                  <div className="text-sm text-gray-600">{selectedOrder.wa_id}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Order</div>
                  <div className="text-sm text-gray-700">
                    {selectedOrder.size} × {selectedOrder.quantity}
                  </div>
                  <div className="text-sm text-gray-700">Total: {formatCurrency(selectedOrder.food_total)}</div>
                </div>
              </div>

              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 font-semibold text-green-800 mb-2">
                  <CheckCircle className="h-4 w-4" />
                  Delivered
                </div>
                <div className="text-sm text-gray-700 space-y-1">
                  <div>Delivered at: {formatDate(getDeliveredAt(selectedOrder))}</div>
                  {selectedOrder.rider_assigned_at && (
                    <div>Rider assigned at: {formatDate(selectedOrder.rider_assigned_at)}</div>
                  )}
                  <div>Delivery time: {formatDeliveryTime(getDeliveryTimeMinutes(selectedOrder))}</div>
                </div>
              </div>

              {(selectedOrder.rider_name || selectedOrder.rider_phone) && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 font-semibold text-blue-800 mb-2">
                    <Truck className="h-4 w-4" />
                    Assigned Rider
                  </div>
                  <div className="text-sm text-gray-700">
                    <div>Name: {selectedOrder.rider_name || "N/A"}</div>
                    <div>Phone: {selectedOrder.rider_phone || "N/A"}</div>
                  </div>
                </div>
              )}

              {selectedOrder.delivery_comment && (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <div className="text-xs text-yellow-700 mb-1">Delivery Comment</div>
                  <div className="text-sm text-gray-700">{selectedOrder.delivery_comment}</div>
                </div>
              )}

              {selectedOrder.delivery_info && (
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">Delivery Info</div>
                  <div className="text-sm text-gray-700">{selectedOrder.delivery_info}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
