"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, TrendingUp, DollarSign, Clock, Users } from "lucide-react"

interface DailyStats {
  date: string
  total_orders: number
  total_revenue: number
  avg_order_value: number
  peak_hour: string
}

interface OrdersChartProps {
  token: string | null
}

export function OrdersChart({ token }: OrdersChartProps) {
  const [stats, setStats] = useState<DailyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Mock data for demonstration - replace with real API call
  const mockStats: DailyStats[] = [
    { date: "2025-06-23", total_orders: 45, total_revenue: 292500, avg_order_value: 6500, peak_hour: "12:00" },
    { date: "2025-06-24", total_orders: 52, total_revenue: 338000, avg_order_value: 6500, peak_hour: "13:00" },
    { date: "2025-06-25", total_orders: 38, total_revenue: 247000, avg_order_value: 6500, peak_hour: "12:30" },
    { date: "2025-06-26", total_orders: 61, total_revenue: 396500, avg_order_value: 6500, peak_hour: "12:15" },
    { date: "2025-06-27", total_orders: 47, total_revenue: 305500, avg_order_value: 6500, peak_hour: "13:30" },
    { date: "2025-06-28", total_orders: 55, total_revenue: 357500, avg_order_value: 6500, peak_hour: "12:45" },
    { date: "2025-06-29", total_orders: 33, total_revenue: 214500, avg_order_value: 6500, peak_hour: "11:30" },
  ]

  const fetchStats = async () => {
    try {
      setLoading(true)
      // For now, use mock data. Replace with actual API call:
      // const response = await fetch("/api/stats", {
      //   headers: { Authorization: `Bearer ${token}` }
      // })

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setStats(mockStats)
      setError(null)
    } catch (err) {
      console.error("Fetch stats error:", err)
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [token])

  const formatCurrency = (amount: number) => {
    return `${(amount / 1000).toFixed(0)}K RWF`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const totalOrders = stats.reduce((sum, day) => sum + day.total_orders, 0)
  const totalRevenue = stats.reduce((sum, day) => sum + day.total_revenue, 0)
  const avgOrderValue = totalRevenue / totalOrders || 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-green-500" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-green-600">Daily Analytics</h2>
          <p className="text-gray-600">Last 7 days performance</p>
        </div>
        <Button onClick={fetchStats} variant="outline" className="flex items-center gap-2 bg-transparent">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Error Message */}
      {error && <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">{error}</div>}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Users className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                <p className="text-2xl font-bold text-gray-900">{avgOrderValue.toLocaleString()} RWF</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Peak Hour</p>
                <p className="text-2xl font-bold text-gray-900">{stats[stats.length - 1]?.peak_hour || "N/A"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simple Data Tables instead of Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders Trend Table */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.map((day) => (
                <div key={day.date} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{formatDate(day.date)}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">{day.total_orders} orders</span>
                    <span className="font-bold text-green-600">{formatCurrency(day.total_revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Peak Hours */}
        <Card>
          <CardHeader>
            <CardTitle>Peak Hours This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.map((day) => (
                <div key={day.date} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{formatDate(day.date)}</span>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="font-bold text-green-600">{day.peak_hour}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Summary */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Weekly Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-blue-700 font-medium">Best Day</div>
                <div className="text-lg font-bold text-blue-800">
                  {stats.reduce((max, day) => (day.total_orders > max.total_orders ? day : max), stats[0])?.date
                    ? formatDate(
                        stats.reduce((max, day) => (day.total_orders > max.total_orders ? day : max), stats[0]).date,
                      )
                    : "N/A"}
                </div>
                <div className="text-sm text-blue-600">
                  {stats.reduce((max, day) => (day.total_orders > max.total_orders ? day : max), stats[0])
                    ?.total_orders || 0}{" "}
                  orders
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-green-700 font-medium">Total Revenue</div>
                <div className="text-lg font-bold text-green-800">{formatCurrency(totalRevenue)}</div>
                <div className="text-sm text-green-600">This week</div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-sm text-yellow-700 font-medium">Daily Average</div>
                <div className="text-lg font-bold text-yellow-800">{Math.round(totalOrders / stats.length)} orders</div>
                <div className="text-sm text-yellow-600">Per day</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
