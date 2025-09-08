"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
      notificationSystem.triggerNewOrderNotification(1);
    }, [notificationSystem]),
    onOrderUpdate: useCallback(() => {}, [])
  });

  // Refresh orders after status update (with debouncing)
  const handleOrderStatusUpdated = useCallback(async () => {
    // Only refresh if it's been more than 5 seconds since last fetch
    const now = Date.now()
    const lastFetchTime = lastFetch ? lastFetch.getTime() : 0
    if (now - lastFetchTime > 5000) {
      await refreshOrders()
    }
  }, [refreshOrders, lastFetch])

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

  // Validate token only on mount and when token changes (no periodic validation)
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
            handleLogout();
          } else if (response.status === 503) {
            // Backend connection error - don't logout, just log
            console.warn("Backend connection error:", data.message);
          } else if (response.status === 408) {
            // Timeout error - don't logout, just log
            console.warn("Backend timeout:", data.message);
          } else if (!response.ok) {
            console.warn("Token validation failed with status:", response.status, data.message);
          }
        } catch (error) {
          console.error("Token validation error:", error);
          // Only logout on network errors if it's not a connection issue
          if (error instanceof Error && !error.message.includes('fetch')) {
            handleLogout();
          }
        }
      };
      
      // Only validate once when token changes
      validateToken();
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

      console.log("🔐 Attempting login with API key:", apiKey.trim() ? "Provided" : "Missing");

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const data = await response.json();
      console.log("📡 Login response:", { status: response.status, data });

      if (response.ok) {
        if (!data.token) {
          setError("No token received from server");
          return;
        }

        console.log("✅ Login successful, storing token");
        setToken(data.token);
        setIsAuthenticated(true);
        localStorage.setItem("kitchen_token", data.token);
      } else {
        console.error("❌ Login failed:", data);
        let errorMessage = data.error || "Invalid API key";
        
        if (data.details) {
          errorMessage += ` - ${data.details}`;
        }
        
        if (data.connectionError) {
          errorMessage = `Cannot connect to backend server (${data.backendUrl}). Please check if the server is running.`;
        }
        
        setError(errorMessage);
      }
    } catch (err) {
      console.error("💥 Login error:", err);
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

        // Refresh orders to immediately remove delivered/cancelled orders (debounced)
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

        // Refresh orders to immediately remove delivered order (debounced)
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

  // Helper function to categorize ingredients
  const categorizeIngredients = (ingredients: string[]) => {
    const categories = {
      proteins: [] as string[],
      vegetables: [] as string[],
      sauces: [] as string[],
      bread: [] as string[],
      other: [] as string[]
    };

    ingredients.forEach(ingredient => {
      const lower = ingredient.toLowerCase();
      
      // Proteins
      if (lower.includes('beef') || lower.includes('chicken') || lower.includes('pork') || 
          lower.includes('fish') || lower.includes('meat') || lower.includes('protein') || 
          lower.includes('cheese') || lower.includes('ham')) {
        categories.proteins.push(ingredient);
      } 
      // Vegetables
      else if (lower.includes('lettuce') || lower.includes('tomato') || lower.includes('onion') || 
               lower.includes('avocado') || lower.includes('cucumber') || lower.includes('carrot') || 
               lower.includes('vegetable') || lower.includes('veggie') || lower.includes('pepper') || 
               lower.includes('olive') || lower.includes('cabbage') || lower.includes('pickle') ||
               lower.includes('red-pepper') || lower.includes('green-pepper') || lower.includes('yellow-pepper') ||
               lower.includes('black-olive') || lower.includes('red-onion') || lower.includes('white-onion') ||
               lower.includes('green-onion') || lower.includes('tomatoes') || lower.includes('lettuce')) {
        categories.vegetables.push(ingredient);
      } 
      // Sauces
      else if (lower.includes('sauce') || lower.includes('mayo') || lower.includes('ketchup') || 
               lower.includes('mustard') || lower.includes('dressing') || lower.includes('kbl-magic')) {
        categories.sauces.push(ingredient);
      } 
      // Bread/Wrap
      else if (lower.includes('bread') || lower.includes('wrap') || lower.includes('bun') || 
               lower.includes('sandwich') || lower.includes('fresh-wrap') || lower.includes('large-sandwich')) {
        categories.bread.push(ingredient);
      } 
      // Other
      else {
        categories.other.push(ingredient);
      }
    });

    return categories;
  };

  // Helper function to get bread/wrap choice
  const getBreadChoice = (size: string) => {
    const lower = size.toLowerCase();
    if (lower.includes('wrap')) return `🌯 ${size}`;
    if (lower.includes('sandwich')) return `🥪 ${size}`;
    if (lower.includes('burger')) return `🍔 ${size}`;
    if (lower.includes('bread')) return `🍞 ${size}`;
    return `🍞 ${size}`;
  };

  const toggleMultipleItems = (orderId: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
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


  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center p-2 sm:p-4">
        <Card className="w-full max-w-sm sm:max-w-md">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl sm:text-2xl font-bold text-green-600">
              🍳 KBL Bites Kitchen
            </CardTitle>
            <p className="text-gray-600 text-sm sm:text-base">
              Enter your API key to access orders
            </p>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <Input
              type="password"
              placeholder="API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="h-10 sm:h-11 text-sm sm:text-base"
            />
            <Button
              onClick={handleLogin}
              disabled={loading || !apiKey}
              className="w-full bg-green-500 hover:bg-green-600 h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
            >
              {loading ? "Connecting..." : "Connect to Kitchen"}
            </Button>
            {error && (
              <p className="text-red-500 text-xs sm:text-sm text-center px-2">{error}</p>
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 p-1 sm:p-2 md:p-4">
      {/* Header */}
      <div className="mb-2 sm:mb-3 md:mb-4 lg:mb-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 xl:gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-green-600 mb-1 sm:mb-2 truncate">🍳 KBL Bites Kitchen Dashboard</h1>
            <div className="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2 sm:gap-4">
              <p className="text-gray-600 text-xs sm:text-sm md:text-base">{orders.length} active orders</p>
              <RealTimeIndicator isConnected={true} lastUpdate={lastFetch || new Date()} isPolling={isPolling} />
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 md:gap-4 flex-shrink-0">
            <NotificationCenter
              newOrders={notificationSystem.notifications.newOrders}
              newMessages={notificationSystem.notifications.newMessages}
              onMarkAllRead={notificationSystem.markAllAsRead}
            />
            
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="flex items-center gap-1 sm:gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
            >
              <span className="text-sm sm:text-base md:text-lg">🚪</span>
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="overflow-x-auto scrollbar-hide mb-2 sm:mb-3 md:mb-4 lg:mb-6">
          <TabsList className="flex w-full gap-1 sm:gap-2 md:gap-3 min-w-max">
            <TabsTrigger value="orders" className="flex items-center gap-1 sm:gap-2 relative text-xs sm:text-sm px-2 sm:px-3 py-2 sm:py-2 touch-manipulation flex-shrink-0">
              <Utensils className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Active Orders</span>
              <NotificationBadge count={notificationSystem.notifications.newOrders} />
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2 sm:py-2 touch-manipulation flex-shrink-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Customers</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-1 sm:gap-2 relative text-xs sm:text-sm px-2 sm:px-3 py-2 sm:py-2 touch-manipulation flex-shrink-0">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Messages</span>
              <NotificationBadge count={notificationSystem.notifications.newMessages} />
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2 sm:py-2 touch-manipulation flex-shrink-0">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2 sm:py-2 touch-manipulation flex-shrink-0">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Completed</span>
            </TabsTrigger>
          </TabsList>
        </div>

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
              {/* Orders Count */}
              <div className="flex items-center justify-center mb-2 sm:mb-3 md:mb-4">
                <div className="text-xs sm:text-sm text-gray-600 text-center px-3 py-2 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm flex items-center gap-2">
                  <span>{orders.length} active orders</span>
                  {isPolling && (
                    <RefreshCw className="h-3 w-3 animate-spin text-green-500" />
                  )}
                </div>
              </div>

              {/* Responsive Grid Display */}
              <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                {orders.map((order, index) => {
                  const spiceLevel = getSpiceLevel(order.spice_level);
                  const animationDelay = index * 0.1; // Stagger the animations

                  return (
                    <Card
                      key={order.id}
                      className="w-full max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-none shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-gray-200 hover:border-green-400 bg-gradient-to-br from-white to-gray-50 relative rounded-xl overflow-hidden transform hover:scale-105 active:scale-95 touch-manipulation"
                      style={{
                        animationDelay: `${animationDelay}s`,
                        animationFillMode: 'both'
                      }}
                    >
                      {/* Close Button */}
                      <button
                        onClick={() => closeOrder(order.id)}
                        disabled={updatingOrders.has(order.id)}
                        className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-md hover:bg-red-100 hover:text-red-600 flex items-center justify-center z-10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 touch-manipulation"
                      >
                        {updatingOrders.has(order.id) ? (
                          <span className="animate-spin text-red-600 text-xs sm:text-sm">⏳</span>
                        ) : (
                          <X className="h-3 w-3 sm:h-4 sm:w-4" />
                        )}
                      </button>

                      <CardHeader className="pb-6 sm:pb-7 md:pb-8 pr-12 sm:pr-14 md:pr-16 bg-gradient-to-r from-gray-50 to-white border-b-2 border-gray-200 p-6 sm:p-7 md:p-8">
                        <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                                <span className="text-base sm:text-lg md:text-xl font-bold text-white">#{order.id}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 truncate">Order #{order.id}</CardTitle>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">
                                {formatCurrency(order.food_total)}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-500">Total</div>
                            </div>
                          </div>
                          
                          <div className="text-base sm:text-lg text-gray-600 font-medium">
                            {new Date(order.created_at).toLocaleDateString()} • {new Date(order.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                        
                        {/* Customer Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                          <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm sm:text-base text-gray-900 break-words">{order.profile_name || 'Unknown'}</div>
                              <div className="text-xs sm:text-sm text-gray-600">Customer</div>
                            </div>
                            <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 border-green-300 text-xs sm:text-sm px-2 py-1 flex-shrink-0">
                              {order.customer_total_orders || 0}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm sm:text-base text-gray-900 break-words">{order.wa_id || 'No ID'}</div>
                              <div className="text-xs sm:text-sm text-gray-600">Phone/ID</div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-6 p-6 sm:p-7 md:p-8">
                        {/* Food Item Details */}
                        <div className="p-6 sm:p-7 space-y-5 bg-gray-50 rounded-xl">
                          <div className="bg-white rounded-xl p-6 sm:p-7 border-2 border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="text-xl sm:text-2xl">🍽️</span>
                                <h4 className="font-bold text-base sm:text-lg text-gray-800">Food Items</h4>
                              </div>
                              {(order.items || order.drinks) && (
                                <button
                                  onClick={(e) => toggleMultipleItems(order.id, e)}
                                  className="text-sm sm:text-base text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-2 touch-manipulation px-3 py-1.5 rounded-lg hover:bg-blue-50"
                                  type="button"
                                >
                                  {showMultipleItems.has(order.id) ? 'Show Less' : 'Show More'}
                                  <span className="text-sm">
                                    {showMultipleItems.has(order.id) ? '▲' : '▼'}
                                  </span>
                                </button>
                              )}
                            </div>
                            
                            {/* Main Food Item */}
                            <div className="space-y-4 mb-3">
                              {/* Bread/Wrap Choice */}
                              <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                                <span className="text-2xl">🍞</span>
                                <div>
                                  <div className="font-semibold text-orange-800">{getBreadChoice(order.size)}</div>
                                  <div className="text-sm text-orange-600">Quantity: ×{order.quantity}</div>
                                </div>
                              </div>

                              {/* Ingredients Categories */}
                              {order.ingredients && order.ingredients.length > 0 && (
                                <div className="space-y-3">
                                  {(() => {
                                    const categories = categorizeIngredients(order.ingredients);
                                    return (
                                      <>
                                        {/* Proteins */}
                                        {categories.proteins.length > 0 && (
                                          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="text-lg">🥩</span>
                                              <span className="font-semibold text-red-800">Proteins</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                              {categories.proteins.map((protein, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded border border-red-300 capitalize">
                                                  {protein.replace('-', ' ')}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Vegetables */}
                                        {categories.vegetables.length > 0 && (
                                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="text-lg">🥬</span>
                                              <span className="font-semibold text-green-800">Vegetables</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                              {categories.vegetables.map((veggie, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-green-100 text-green-700 text-sm rounded border border-green-300 capitalize">
                                                  {veggie.replace('-', ' ')}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Sauces */}
                                        {categories.sauces.length > 0 && (
                                          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="text-lg">🥫</span>
                                              <span className="font-semibold text-yellow-800">Sauces</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                              {categories.sauces.map((sauce, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-yellow-100 text-yellow-700 text-sm rounded border border-yellow-300 capitalize">
                                                  {sauce.replace('-', ' ')}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Other ingredients */}
                                        {categories.other.length > 0 && (
                                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="text-lg">➕</span>
                                              <span className="font-semibold text-gray-800">Other</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                              {categories.other.map((other, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded border border-gray-300 capitalize">
                                                  {other.replace('-', ' ')}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* Spice Level */}
                              <div className="flex items-center gap-3 p-3 bg-orange-100 rounded-lg border border-orange-300">
                                <span className="text-2xl">🔥</span>
                                <div>
                                  <div className="font-semibold text-orange-800">Spice Level</div>
                                  <div className="text-sm text-orange-600">{order.spice_level || 'Not specified'}</div>
                                </div>
                              </div>
                            </div>

                            {/* Additional Items - Expandable */}
                            {(order.items || order.drinks) && showMultipleItems.has(order.id) && (
                              <div className="border-t border-gray-200 pt-4 space-y-3">
                                {order.items && (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-500 text-sm">🍽️</span>
                                      <span className="text-sm font-semibold text-gray-700">Additional Orders:</span>
                                    </div>
                                    <div className="space-y-3">
                                      {(() => {
                                        try {
                                          const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                                          if (Array.isArray(items) && items.length > 0) {
                                            // Check if this is a single order (items array contains only the main order)
                                            const isSingleOrder = items.length === 1 && 
                                                               items[0].size === order.size && 
                                                               items[0].spice_level === order.spice_level && 
                                                               items[0].sauce === order.sauce &&
                                                               JSON.stringify(items[0].ingredients?.sort()) === JSON.stringify(order.ingredients?.sort());

                                            if (isSingleOrder) {
                                              // This is a single order, don't show additional items section
                                              return null;
                                            }

                                            // Count identical items to main order (excluding the main order itself)
                                            const identicalCount = items.filter((item: any) => {
                                              const isIdentical = item.size === order.size && 
                                                                item.spice_level === order.spice_level && 
                                                                item.sauce === order.sauce &&
                                                                JSON.stringify(item.ingredients?.sort()) === JSON.stringify(order.ingredients?.sort());
                                              return isIdentical;
                                            }).length;

                                            // Show summary if there are identical items
                                            if (identicalCount > 0) {
                                              return (
                                                <>
                                                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                                    <div className="flex items-center gap-2 mb-2">
                                                      <span className="text-lg">📋</span>
                                                      <span className="font-semibold text-blue-800">Order Summary</span>
                                                    </div>
                                                    <div className="text-sm text-blue-700">
                                                      Main order + {identicalCount} additional identical item{identicalCount > 1 ? 's' : ''}
                                                    </div>
                                                    <div className="text-xs text-blue-600 mt-1">
                                                      Total quantity: {order.quantity + identicalCount} × {getBreadChoice(order.size)}
                                                    </div>
                                                  </div>
                                                  
                                                  {items.map((item: any, idx: number) => {
                                                    // Check if this item is significantly different from the main order
                                                    const isDifferent = item.size !== order.size || 
                                                                      item.spice_level !== order.spice_level || 
                                                                      item.sauce !== order.sauce ||
                                                                      JSON.stringify(item.ingredients?.sort()) !== JSON.stringify(order.ingredients?.sort());
                                                    
                                                    if (!isDifferent) {
                                                      return null; // Skip duplicate items
                                                    }

                                                    return (
                                                      <div key={idx} className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm">
                                                        <div className="flex items-center justify-between mb-3">
                                                          <div className="flex items-center gap-2">
                                                            <span className="text-lg">🍽️</span>
                                                            <span className="font-semibold text-gray-800">
                                                              Additional Order {idx + 1}: {getBreadChoice(item.size || 'Food Item')}
                                                            </span>
                                                          </div>
                                                          <span className="text-sm text-green-600 font-bold">
                                                            {item.price ? `${item.price.toLocaleString()} RWF` : ''}
                                                          </span>
                                                        </div>
                                                        
                                                        <div className="text-sm text-gray-600 mb-3">
                                                          Qty: {item.quantity || 1} • Spice: {item.spice_level || 'No spice'} • Sauce: {item.sauce || 'No sauce'}
                                                        </div>
                                                        
                                                        {item.ingredients && item.ingredients.length > 0 && (
                                                          <div className="space-y-2">
                                                            {(() => {
                                                              const categories = categorizeIngredients(item.ingredients);
                                                              return (
                                                                <>
                                                                  {/* Proteins */}
                                                                  {categories.proteins.length > 0 && (
                                                                    <div className="p-2 bg-red-50 rounded border border-red-200">
                                                                      <div className="flex items-center gap-1 mb-1">
                                                                        <span className="text-sm">🥩</span>
                                                                        <span className="text-xs font-semibold text-red-700">Proteins</span>
                                                                      </div>
                                                                      <div className="flex flex-wrap gap-1">
                                                                        {categories.proteins.map((protein, ingIdx) => (
                                                                          <span key={ingIdx} className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded border border-red-300 capitalize">
                                                                            {protein.replace('-', ' ')}
                                                                          </span>
                                                                        ))}
                                                                      </div>
                                                                    </div>
                                                                  )}

                                                                  {/* Vegetables */}
                                                                  {categories.vegetables.length > 0 && (
                                                                    <div className="p-2 bg-green-50 rounded border border-green-200">
                                                                      <div className="flex items-center gap-1 mb-1">
                                                                        <span className="text-sm">🥬</span>
                                                                        <span className="text-xs font-semibold text-green-700">Vegetables</span>
                                                                      </div>
                                                                      <div className="flex flex-wrap gap-1">
                                                                        {categories.vegetables.map((veggie, ingIdx) => (
                                                                          <span key={ingIdx} className="px-1.5 py-0.5 bg-green-100 text-green-600 text-xs rounded border border-green-300 capitalize">
                                                                            {veggie.replace('-', ' ')}
                                                                          </span>
                                                                        ))}
                                                                      </div>
                                                                    </div>
                                                                  )}

                                                                  {/* Sauces */}
                                                                  {categories.sauces.length > 0 && (
                                                                    <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                                                                      <div className="flex items-center gap-1 mb-1">
                                                                        <span className="text-sm">🥫</span>
                                                                        <span className="text-xs font-semibold text-yellow-700">Sauces</span>
                                                                      </div>
                                                                      <div className="flex flex-wrap gap-1">
                                                                        {categories.sauces.map((sauce, ingIdx) => (
                                                                          <span key={ingIdx} className="px-1.5 py-0.5 bg-yellow-100 text-yellow-600 text-xs rounded border border-yellow-300 capitalize">
                                                                            {sauce.replace('-', ' ')}
                                                                          </span>
                                                                        ))}
                                                                      </div>
                                                                    </div>
                                                                  )}

                                                                  {/* Other ingredients */}
                                                                  {categories.other.length > 0 && (
                                                                    <div className="p-2 bg-gray-50 rounded border border-gray-200">
                                                                      <div className="flex items-center gap-1 mb-1">
                                                                        <span className="text-sm">➕</span>
                                                                        <span className="text-xs font-semibold text-gray-700">Other</span>
                                                                      </div>
                                                                      <div className="flex flex-wrap gap-1">
                                                                        {categories.other.map((other, ingIdx) => (
                                                                          <span key={ingIdx} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border border-gray-300 capitalize">
                                                                            {other.replace('-', ' ')}
                                                                          </span>
                                                                        ))}
                                                                      </div>
                                                                    </div>
                                                                  )}
                                                                </>
                                                              );
                                                            })()}
                                                          </div>
                                                        )}
                                                      </div>
                                                    );
                                                  }).filter(Boolean)} {/* Remove null values */}
                                                </>
                                              );
                                            } else {
                                              // No identical items, show all items
                                              return items.map((item: any, idx: number) => (
                                                <div key={idx} className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm">
                                                  <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-lg">🍽️</span>
                                                      <span className="font-semibold text-gray-800">
                                                        Additional Order {idx + 1}: {getBreadChoice(item.size || 'Food Item')}
                                                      </span>
                                                    </div>
                                                    <span className="text-sm text-green-600 font-bold">
                                                      {item.price ? `${item.price.toLocaleString()} RWF` : ''}
                                                    </span>
                                                  </div>
                                                  
                                                  <div className="text-sm text-gray-600 mb-3">
                                                    Qty: {item.quantity || 1} • Spice: {item.spice_level || 'No spice'} • Sauce: {item.sauce || 'No sauce'}
                                                  </div>
                                                  
                                                  {item.ingredients && item.ingredients.length > 0 && (
                                                    <div className="space-y-2">
                                                      {(() => {
                                                        const categories = categorizeIngredients(item.ingredients);
                                                        return (
                                                          <>
                                                            {/* Proteins */}
                                                            {categories.proteins.length > 0 && (
                                                              <div className="p-2 bg-red-50 rounded border border-red-200">
                                                                <div className="flex items-center gap-1 mb-1">
                                                                  <span className="text-sm">🥩</span>
                                                                  <span className="text-xs font-semibold text-red-700">Proteins</span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1">
                                                                  {categories.proteins.map((protein, ingIdx) => (
                                                                    <span key={ingIdx} className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded border border-red-300 capitalize">
                                                                      {protein.replace('-', ' ')}
                                                                    </span>
                                                                  ))}
                                                                </div>
                                                              </div>
                                                            )}

                                                            {/* Vegetables */}
                                                            {categories.vegetables.length > 0 && (
                                                              <div className="p-2 bg-green-50 rounded border border-green-200">
                                                                <div className="flex items-center gap-1 mb-1">
                                                                  <span className="text-sm">🥬</span>
                                                                  <span className="text-xs font-semibold text-green-700">Vegetables</span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1">
                                                                  {categories.vegetables.map((veggie, ingIdx) => (
                                                                    <span key={ingIdx} className="px-1.5 py-0.5 bg-green-100 text-green-600 text-xs rounded border border-green-300 capitalize">
                                                                      {veggie.replace('-', ' ')}
                                                                    </span>
                                                                  ))}
                                                                </div>
                                                              </div>
                                                            )}

                                                            {/* Sauces */}
                                                            {categories.sauces.length > 0 && (
                                                              <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                                                                <div className="flex items-center gap-1 mb-1">
                                                                  <span className="text-sm">🥫</span>
                                                                  <span className="text-xs font-semibold text-yellow-700">Sauces</span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1">
                                                                  {categories.sauces.map((sauce, ingIdx) => (
                                                                    <span key={ingIdx} className="px-1.5 py-0.5 bg-yellow-100 text-yellow-600 text-xs rounded border border-yellow-300 capitalize">
                                                                      {sauce.replace('-', ' ')}
                                                                    </span>
                                                                  ))}
                                                                </div>
                                                              </div>
                                                            )}

                                                            {/* Other ingredients */}
                                                            {categories.other.length > 0 && (
                                                              <div className="p-2 bg-gray-50 rounded border border-gray-200">
                                                                <div className="flex items-center gap-1 mb-1">
                                                                  <span className="text-sm">➕</span>
                                                                  <span className="text-xs font-semibold text-gray-700">Other</span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1">
                                                                  {categories.other.map((other, ingIdx) => (
                                                                    <span key={ingIdx} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border border-gray-300 capitalize">
                                                                      {other.replace('-', ' ')}
                                                                    </span>
                                                                  ))}
                                                                </div>
                                                              </div>
                                                            )}
                                                          </>
                                                        );
                                                      })()}
                                                    </div>
                                                  )}
                                                </div>
                                              ));
                                            }
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
                        <div className="bg-gradient-to-r from-gray-50 to-white p-6 sm:p-7 rounded-xl border-2 border-gray-200 shadow-sm">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-sm">⚡</span>
                            </div>
                            <h4 className="font-bold text-base sm:text-lg text-gray-900">Order Actions</h4>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
                                className="w-full inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-xl text-base sm:text-lg font-bold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600 active:scale-95 disabled:scale-100 h-12 sm:h-14 px-6 sm:px-8 shadow-lg hover:shadow-xl touch-manipulation"
                              >
                                {updatingOrders.has(order.id) ? (
                                  <span className="animate-spin text-lg">⏳</span>
                                ) : (
                                  <span className="text-xl">🔥</span>
                                )}
                                <span className="hidden xs:inline">{updatingOrders.has(order.id) ? "Updating..." : "Start Prep"}</span>
                                <span className="xs:hidden">{updatingOrders.has(order.id) ? "..." : "Prep"}</span>
                              </button>
                            )}

                            {order.status.toLowerCase() === "preparing" && (
                              <button
                                onClick={() => updateOrderStatus(order.id, "ready")}
                                disabled={updatingOrders.has(order.id)}
                                className="w-full inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-xl text-base sm:text-lg font-bold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 active:scale-95 disabled:scale-100 h-12 sm:h-14 px-6 sm:px-8 shadow-lg hover:shadow-xl touch-manipulation"
                              >
                                {updatingOrders.has(order.id) ? (
                                  <span className="animate-spin text-lg">⏳</span>
                                ) : (
                                  <span className="text-xl">✅</span>
                                )}
                                <span className="hidden xs:inline">{updatingOrders.has(order.id) ? "Updating..." : "Mark Ready"}</span>
                                <span className="xs:hidden">{updatingOrders.has(order.id) ? "..." : "Ready"}</span>
                              </button>
                            )}

                            {order.status.toLowerCase() === "ready" && (
                              <button
                                onClick={() => updateOrderStatus(order.id, "delivered")}
                                disabled={updatingOrders.has(order.id)}
                                className="w-full inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-xl text-base sm:text-lg font-bold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 active:scale-95 disabled:scale-100 h-12 sm:h-14 px-6 sm:px-8 shadow-lg hover:shadow-xl touch-manipulation"
                              >
                                {updatingOrders.has(order.id) ? (
                                  <span className="animate-spin text-lg">⏳</span>
                                ) : (
                                  <span className="text-xl">🚚</span>
                                )}
                                <span className="hidden xs:inline">{updatingOrders.has(order.id) ? "Updating..." : "Mark Delivered"}</span>
                                <span className="xs:hidden">{updatingOrders.has(order.id) ? "..." : "Deliver"}</span>
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
