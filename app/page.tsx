"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Clock,
  User,
  Phone,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Utensils,
  Flame,
  Droplets,
  X,
  BarChart3,
  Users,
  MessageSquare,
  Package,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { MessagesView } from "../components/messages-view";
import { OrderStatusDialog } from "../components/order-status-dialog";
import { CustomersTableView } from "../components/customers-table-view";
import { DeliveredOrdersCalendarView as CompletedOrdersCalendarView } from "../components/delivered-orders-calendar-view";
import { OrdersChart } from "../components/orders-chart";
import { useNotifications } from "../hooks/use-notifications";
import { useRealTimeOrders } from "../hooks/use-real-time-orders";
import { NotificationCenter } from "../components/notification-center";
import { NotificationBadge } from "../components/notification-badge";
import { RealTimeIndicator } from "../components/real-time-indicator";

interface Order {
  id: number;
  wa_id: string;
  profile_name: string;
  size: string;
  quantity: number;
  ingredients: string[];
  spice_level: string;
  sauce: string;
  food_total: number;
  delivery_info: string;
  status: string;
  customer_total_orders: number;
  created_at: string;
  updated_at: string;
  items?: string;
  drinks?: string;
  order_source?: string;
}

export default function KitchenDashboard() {
  const [apiKey, setApiKey] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const [showMultipleItems, setShowMultipleItems] = useState<Set<number>>(new Set());
  const [updatingOrders, setUpdatingOrders] = useState<Set<number>>(new Set());
  const [scrollPosition, setScrollPosition] = useState(0);

  const [audio] = useState(() => {
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try {
        const audioElement = new Audio("/sounds/simple-notification.mp3");
        audioElement.preload = "auto";
        audioElement.addEventListener("error", (e) => {
          console.warn("Audio loading error:", e);
        });
        return audioElement;
      } catch (error) {
        console.warn("Failed to create audio element:", error);
      }
    }
    
    return {
      currentTime: 0,
      readyState: 0,
      play: () => Promise.resolve(),
      load: () => {},
      addEventListener: () => {},
      removeEventListener: () => {}
    } as any;
  });

  // Notification system
  const notificationSystem = useNotifications({
    token,
    isActive: isAuthenticated && activeTab === "orders"
  });

  // Real-time orders hook
  const { orders, loading: ordersLoading, lastFetch, isPolling, refreshOrders } = useRealTimeOrders({
    token,
    isActive: true,
    onNewOrder: useCallback((order: Order) => {
      console.log("🎉 New order received:", order.id);
      notificationSystem.triggerNewOrderNotification(1);
    }, [notificationSystem]),
    onOrderUpdate: useCallback(() => {}, [])
  });

  // Refresh orders after status update
  const handleOrderStatusUpdated = useCallback(async () => {
    console.log("🔄 Refreshing orders after status update...")
    await refreshOrders()
  }, [refreshOrders])

  // Check for saved token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("kitchen_token");
    if (savedToken) {
      setToken(savedToken);
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  // Define handleLogout early so it can be used in useEffect
  const handleLogout = () => {
    localStorage.removeItem("kitchen_token");
    setToken(null);
    setIsAuthenticated(false);
    setApiKey("");
    setUpdatingOrders(new Set());
    setExpandedOrders(new Set());
    setShowMultipleItems(new Set());
    notificationSystem.markAllAsRead();
  };

  // Validate token immediately when component mounts and periodically
  useEffect(() => {
    if (token && isAuthenticated) {
      const validateToken = async () => {
        try {
          const response = await fetch("/api/test-connection", {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });
          
          const data = await response.json();
          
          if (response.status === 401) {
            console.log("Token expired or invalid, redirecting to login");
            handleLogout();
          } else if (response.status === 503) {
            // Backend connection error - don't logout, just log
            console.warn("Backend connection error:", data.message);
          } else if (response.status === 408) {
            // Timeout error - don't logout, just log
            console.warn("Backend timeout:", data.message);
          } else if (!response.ok) {
            console.warn("Token validation failed with status:", response.status, data.message);
          } else {
            console.log("Token validation successful:", data.message);
          }
        } catch (error) {
          console.error("Token validation error:", error);
          // Only logout on network errors if it's not a connection issue
          if (error instanceof Error && !error.message.includes('fetch')) {
            handleLogout();
          }
        }
      };
      
      // Initial validation
      validateToken();
      
      // Set up periodic validation every 5 minutes
      const interval = setInterval(validateToken, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [token, isAuthenticated, handleLogout]);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!apiKey.trim()) {
        setError("Please enter an API key");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        if (!data.token) {
          setError("No token received from server");
          return;
        }

        setToken(data.token);
        setIsAuthenticated(true);
        localStorage.setItem("kitchen_token", data.token);
      } else {
        setError(data.error || data.details || "Invalid API key");
      }
    } catch (err) {
      setError("Network error - check your connection and API URL");
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    if (updatingOrders.has(orderId)) return;
    
    try {
      setUpdatingOrders(prev => new Set(prev).add(orderId));
      
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      
      if (response.ok) {
        const successElement = document.createElement('div');
        successElement.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        successElement.textContent = `✅ Order #${orderId} updated to ${status}`;
        document.body.appendChild(successElement);

        // Remove success message after 3 seconds
        setTimeout(() => {
          if (document.body.contains(successElement)) {
            document.body.removeChild(successElement);
          }
        }, 3000);

        // Refresh orders to immediately remove delivered/cancelled orders
        await handleOrderStatusUpdated();
      } else if (response.status === 401) {
        const errorElement = document.createElement('div');
        errorElement.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        errorElement.textContent = `❌ Authentication failed. Please log in again.`;
        document.body.appendChild(errorElement);
        
        setTimeout(() => {
          if (document.body.contains(errorElement)) {
            document.body.removeChild(errorElement);
          }
        }, 3000);
        
        handleLogout();
      }
    } catch (err) {
      const errorElement = document.createElement('div');
      errorElement.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      errorElement.textContent = `❌ Failed to update order #${orderId}`;
      document.body.appendChild(errorElement);
      
      setTimeout(() => {
        if (document.body.contains(errorElement)) {
          document.body.removeChild(errorElement);
        }
      }, 3000);
    } finally {
      setUpdatingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const closeOrder = async (orderId: number) => {
    if (updatingOrders.has(orderId)) return;
    
    try {
      setUpdatingOrders(prev => new Set(prev).add(orderId));
      
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "delivered" }),
      });
      
      if (response.ok) {
        const successElement = document.createElement('div');
        successElement.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        successElement.textContent = `✅ Order #${orderId} marked as delivered`;
        document.body.appendChild(successElement);
        
        setTimeout(() => {
          if (document.body.contains(successElement)) {
            document.body.removeChild(successElement);
          }
        }, 3000);

        // Refresh orders to immediately remove delivered order
        await handleOrderStatusUpdated();
      } else if (response.status === 401) {
        const errorElement = document.createElement('div');
        errorElement.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        errorElement.textContent = `❌ Authentication failed. Please log in again.`;
        document.body.appendChild(errorElement);
        
        setTimeout(() => {
          if (document.body.contains(errorElement)) {
            document.body.removeChild(errorElement);
          }
        }, 3000);
        
        handleLogout();
      }
    } catch (err) {
      const errorElement = document.createElement('div');
      errorElement.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      errorElement.textContent = `❌ Failed to close order #${orderId}`;
      document.body.appendChild(errorElement);
      
      setTimeout(() => {
        if (document.body.contains(errorElement)) {
          document.body.removeChild(errorElement);
        }
      }, 3000);
    } finally {
      setUpdatingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} RWF`;
  };

  const getSpiceLevel = (level: string | null) => {
    if (!level) {
      return { color: "bg-gray-100 text-gray-800", icon: <Droplets className="h-3 w-3" />, label: "Not specified" };
    }
    switch (level.toLowerCase()) {
      case "mild":
        return { color: "bg-green-100 text-green-800", icon: <Droplets className="h-3 w-3" />, label: "Mild" };
      case "medium":
        return { color: "bg-yellow-100 text-yellow-800", icon: <Flame className="h-3 w-3" />, label: "Medium" };
      case "hot":
        return { color: "bg-red-100 text-red-800", icon: <Flame className="h-3 w-3" />, label: "Hot" };
      default:
        return { color: "bg-gray-100 text-gray-800", icon: <Droplets className="h-3 w-3" />, label: level };
    }
  };

  const toggleMultipleItems = (orderId: number) => {
    setShowMultipleItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const scrollLeft = () => {
    setScrollPosition(prev => Math.max(0, prev - 5));
  };

  const scrollRight = () => {
    setScrollPosition(prev => Math.min(orders.length - 5, prev + 5));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-green-600">
              🍳 KBL Bites Kitchen
            </CardTitle>
            <p className="text-gray-600">
              Enter your API key to access orders
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <Button
              onClick={handleLogin}
              disabled={loading || !apiKey}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              {loading ? "Connecting..." : "Connect to Kitchen"}
            </Button>
            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    
    if (newTab === "orders") {
      notificationSystem.markOrdersAsRead();
    } else if (newTab === "messages") {
      notificationSystem.markMessagesAsRead();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 p-4">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-green-600 mb-2">🍳 KBL Bites Kitchen Dashboard</h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <p className="text-gray-600 text-sm md:text-base">{orders.length} active orders</p>
              <RealTimeIndicator isConnected={true} lastUpdate={lastFetch || new Date()} isPolling={isPolling} />
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <NotificationCenter
              newOrders={notificationSystem.notifications.newOrders}
              newMessages={notificationSystem.notifications.newMessages}
              onMarkAllRead={notificationSystem.markAllAsRead}
            />
            
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 text-xs md:text-sm"
            >
              <span className="text-base md:text-lg">🚪</span>
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1 md:gap-2 mb-4 md:mb-6">
          <TabsTrigger value="orders" className="flex items-center gap-1 md:gap-2 relative text-xs md:text-sm">
            <Utensils className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Active Orders</span>
            <NotificationBadge count={notificationSystem.notifications.newOrders} />
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
            <Users className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Customers</span>
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-1 md:gap-2 relative text-xs md:text-sm">
            <MessageSquare className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Messages</span>
            <NotificationBadge count={notificationSystem.notifications.newMessages} />
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
            <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2 text-xs md:text-sm">
            <Package className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Completed</span>
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders">
          {ordersLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-orange-500" />
                <p className="text-gray-600">Loading orders...</p>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🍽️</div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No active orders</h3>
              <p className="text-gray-500">New orders will appear here automatically</p>
            </div>
          ) : (
            <div className="relative">
              {/* Navigation Arrows */}
              <div className="flex items-center justify-between mb-4">
                <Button
                  onClick={scrollLeft}
                  disabled={scrollPosition === 0}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 bg-white/80 backdrop-blur-sm hover:bg-white shadow-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous 5</span>
                </Button>
                
                <div className="text-sm text-gray-600">
                  {scrollPosition + 1}-{Math.min(scrollPosition + 5, orders.length)} of {orders.length} orders
                </div>
                
                <Button
                  onClick={scrollRight}
                  disabled={scrollPosition === orders.length - 5}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 bg-white/80 backdrop-blur-sm hover:bg-white shadow-lg"
                >
                  <span className="hidden sm:inline">Next 5</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Single Row Display - Show 5 Orders */}
              <div className="flex gap-4 md:gap-6 px-2 md:px-1 overflow-x-auto scrollbar-hide">
                {orders.slice(scrollPosition, scrollPosition + 5).map((order, index) => {
                  const spiceLevel = getSpiceLevel(order.spice_level);
                  const animationDelay = index * 0.1; // Stagger the animations

                  return (
                    <Card
                      key={order.id}
                      className="w-full max-w-md flex-shrink-0 shadow-xl hover:shadow-2xl transition-all duration-500 border-2 border-gray-100 hover:border-green-300 bg-gradient-to-br from-white to-gray-50 relative rounded-xl overflow-hidden transform translate-x-0 animate-in slide-in-from-right-8 duration-700 ease-out hover:translate-x-1 hover:scale-105"
                      style={{
                        animationDelay: `${animationDelay}s`,
                        animationFillMode: 'both'
                      }}
                    >
                      {/* Close Button */}
                      <button
                        onClick={() => closeOrder(order.id)}
                        disabled={updatingOrders.has(order.id)}
                        className="absolute top-2 right-2 h-8 w-8 p-0 rounded-md hover:bg-red-100 hover:text-red-600 flex items-center justify-center z-10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        {updatingOrders.has(order.id) ? (
                          <span className="animate-spin text-red-600">⏳</span>
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </button>

                      <CardHeader className="pb-4 pr-12 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-md">
                              <span className="text-lg font-bold text-white">#{order.id}</span>
                            </div>
                            <div>
                              <CardTitle className="text-lg font-bold text-gray-900 mb-1">Order #{order.id}</CardTitle>
                              <div className="text-xs text-gray-600 font-medium">
                                {new Date(order.created_at).toLocaleDateString()} • {new Date(order.created_at).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600">
                              {formatCurrency(order.food_total)}
                            </div>
                            <div className="text-xs text-gray-500">Total Value</div>
                          </div>
                        </div>
                        
                        {/* Customer Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="h-3 w-3 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium text-sm text-gray-900">{order.profile_name || 'Unknown'}</div>
                              <div className="text-xs text-gray-600">Customer</div>
                            </div>
                            <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 border-green-300 text-xs px-2 py-1">
                              {order.customer_total_orders || 0} orders
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                              <Phone className="h-3 w-3 text-purple-600" />
                            </div>
                            <div>
                              <div className="font-medium text-sm text-gray-900">{order.wa_id || 'No ID'}</div>
                              <div className="text-xs text-gray-600">Phone/ID</div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* Food Item Details */}
                        <div className="p-3 space-y-3 bg-gray-50">
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🍽️</span>
                                <h4 className="font-semibold text-sm text-gray-800">Food Items</h4>
                              </div>
                              {(order.items || order.drinks) && (
                                <button
                                  onClick={() => toggleMultipleItems(order.id)}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                >
                                  {showMultipleItems.has(order.id) ? 'Show Less' : 'Show More'}
                                  <span className="text-xs">
                                    {showMultipleItems.has(order.id) ? '▲' : '▼'}
                                  </span>
                                </button>
                              )}
                            </div>
                            
                            {/* Main Food Item */}
                            <div className="grid grid-cols-2 gap-3 mb-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-sm">🍞</span>
                                  <span className="text-sm">{order.size}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-sm">🔢</span>
                                  <span className="text-sm">×{order.quantity}</span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-sm">🔥</span>
                                  <span className="text-sm">{order.spice_level || 'Not specified'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-sm">🥫</span>
                                  <span className="text-sm">{order.sauce || 'No sauce'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Additional Items - Expandable */}
                            {(order.items || order.drinks) && showMultipleItems.has(order.id) && (
                              <div className="border-t border-gray-200 pt-2 space-y-2">
                                {order.items && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-500 text-xs">🍽️</span>
                                      <span className="text-xs font-medium text-gray-700">Additional Orders:</span>
                                    </div>
                                    <div className="pl-4 space-y-2">
                                      {(() => {
                                        try {
                                          const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                                          if (Array.isArray(items)) {
                                            return items.map((item, idx) => (
                                              <div key={idx} className="bg-gray-50 rounded p-2 border border-gray-200">
                                                <div className="flex items-center justify-between mb-1">
                                                  <span className="text-xs font-medium text-gray-800">
                                                    Order {idx + 1}: {item.size || 'Food Item'}
                                                  </span>
                                                  <span className="text-xs text-green-600 font-medium">
                                                    {item.price ? `${item.price.toLocaleString()} RWF` : ''}
                                                  </span>
                                                </div>
                                                <div className="text-xs text-gray-600 mb-1">
                                                  Qty: {item.quantity || 1} • Spice: {item.spice_level || 'No spice'} • Sauce: {item.sauce || 'No sauce'}
                                                </div>
                                                {item.ingredients && item.ingredients.length > 0 && (
                                                  <div className="flex flex-wrap gap-1">
                                                    {item.ingredients.map((ingredient: string, ingIdx: number) => (
                                                      <span
                                                        key={ingIdx}
                                                        className="px-1.5 py-0.5 bg-blue-50 text-xs rounded border border-blue-200 text-blue-700 capitalize"
                                                      >
                                                        {ingredient.replace('-', ' ')}
                                                      </span>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            ));
                                          }
                                          return <span className="text-xs text-gray-600">{order.items}</span>;
                                        } catch (error) {
                                          return <span className="text-xs text-gray-600">{order.items}</span>;
                                        }
                                      })()}
                                    </div>
                                  </div>
                                )}
                                
                                {order.drinks && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-500 text-xs">🥤</span>
                                      <span className="text-xs font-medium text-gray-700">Drinks:</span>
                                    </div>
                                    <div className="pl-4 space-y-2">
                                      {(() => {
                                        try {
                                          const drinks = typeof order.drinks === 'string' ? JSON.parse(order.drinks) : order.drinks;
                                          if (Array.isArray(drinks)) {
                                            return drinks.map((drink, idx) => (
                                              <div key={idx} className="bg-blue-50 rounded p-2 border border-blue-200">
                                                <div className="flex items-center justify-between mb-1">
                                                  <span className="text-xs font-medium text-blue-800">
                                                    {drink.name || drink.size || 'Drink'}
                                                  </span>
                                                  <span className="text-xs text-blue-600 font-medium">
                                                    {drink.price ? `${drink.price.toLocaleString()} RWF` : ''}
                                                  </span>
                                                </div>
                                                <div className="text-xs text-blue-600">
                                                  Qty: {drink.quantity || 1}
                                                </div>
                                              </div>
                                            ));
                                          }
                                          return <span className="text-xs text-gray-600">{order.drinks}</span>;
                                        } catch (error) {
                                          return <span className="text-xs text-gray-600">{order.drinks}</span>;
                                        }
                                      })()}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Delivery Info */}
                        {order.delivery_info && (
                          <div className="bg-white border-2 border-blue-200 rounded-lg p-3 shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-lg">🚚</span>
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-blue-900">Delivery Information</h3>
                                <div className="text-sm text-blue-700 mt-2 bg-blue-50 p-2 rounded-lg border border-blue-200">
                                  {order.delivery_info}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="bg-gradient-to-r from-gray-50 to-white p-3 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-xs">⚡</span>
                            </div>
                            <h4 className="font-semibold text-sm text-gray-900">Order Actions</h4>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <OrderStatusDialog
                              orderId={order.id}
                              currentStatus={order.status}
                              customerName={order.profile_name}
                              phoneNumber={order.wa_id}
                              token={token}
                              onStatusUpdated={handleOrderStatusUpdated}
                            />

                            {order.status.toLowerCase() === "received" && (
                              <button
                                onClick={() => updateOrderStatus(order.id, "preparing")}
                                disabled={updatingOrders.has(order.id)}
                                className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600 active:scale-95 disabled:scale-100 h-10 px-4 shadow-lg hover:shadow-xl"
                              >
                                {updatingOrders.has(order.id) ? (
                                  <span className="animate-spin">⏳</span>
                                ) : (
                                  <span className="text-lg">🔥</span>
                                )}
                                {updatingOrders.has(order.id) ? "Updating..." : "Start Prep"}
                              </button>
                            )}

                            {order.status.toLowerCase() === "preparing" && (
                              <button
                                onClick={() => updateOrderStatus(order.id, "ready")}
                                disabled={updatingOrders.has(order.id)}
                                className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 active:scale-95 disabled:scale-100 h-10 px-4 shadow-lg hover:shadow-xl"
                              >
                                {updatingOrders.has(order.id) ? (
                                  <span className="animate-spin">⏳</span>
                                ) : (
                                  <span className="text-lg">✅</span>
                                )}
                                {updatingOrders.has(order.id) ? "Updating..." : "Mark Ready"}
                              </button>
                            )}

                            {order.status.toLowerCase() === "ready" && (
                              <button
                                onClick={() => updateOrderStatus(order.id, "delivered")}
                                disabled={updatingOrders.has(order.id)}
                                className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 active:scale-95 disabled:scale-100 h-10 px-4 shadow-lg hover:shadow-xl"
                              >
                                {updatingOrders.has(order.id) ? (
                                  <span className="animate-spin">⏳</span>
                                ) : (
                                  <span className="text-lg">🚚</span>
                                )}
                                {updatingOrders.has(order.id) ? "Updating..." : "Mark Delivered"}
                              </button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers">
          <CustomersTableView token={token} />
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <MessagesView token={token} />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <OrdersChart token={token} />
        </TabsContent>

        {/* Completed Orders Tab */}
        <TabsContent value="completed">
          <CompletedOrdersCalendarView token={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
