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
  ShoppingBag,
  Users,
  MessageSquare,
  Package,
  ChevronLeft,
  ChevronRight,
  Copy,
  ZoomIn,
  Truck,
  Settings
} from "lucide-react";
import { MessagesView } from "../components/messages-view";
import { OrderStatusDialog } from "../components/order-status-dialog";
import { CustomersTableView } from "../components/customers-table-view";
import { DeliveredOrdersCalendarView as CompletedOrdersCalendarView } from "../components/delivered-orders-calendar-view";
import { DeliveredOrdersView } from "../components/delivered-orders-view";
import { OrdersChart } from "../components/orders-chart";
import { ProductsManagement } from "../components/products-management";
import { AppConfigManagement } from "../components/app-config-management";
import { AddonsManagement } from "../components/addons-management";
import { useNotifications } from "../hooks/use-notifications";
import { useRealTimeOrders } from "../hooks/use-real-time-orders";
import { NotificationCenter } from "../components/notification-center";
import { NotificationBadge } from "../components/notification-badge";
import { RealTimeIndicator } from "../components/real-time-indicator";
import { DeliveryMap, parseCoordinates } from "../components/delivery-map";
import { OrderDetailModal } from "../components/order-detail-modal";
import { ChatWidget } from "../components/chat-widget";
import { reverseGeocode } from "@/lib/reverse-geocode";

interface Order {
  id: number;
  wa_id: string;
  profile_name: string;
  size: string;
  quantity: number;
  ingredients: string[];
  spice_level: string;
  sauce: string;
  food_total: number | null;
  delivery_info: string;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_address?: string | null;
  status: string;
  customer_total_orders: number;
  created_at: string;
  updated_at: string;
  items?: string;
  drinks?: string;
  order_source?: string;
  preset_name?: string;
  payment_method?: string;
  payment_status?: string;
  payment_received_at?: string;
  rider_name?: string | null;
  rider_phone?: string | null;
  rider_assigned_at?: string | null;
  delivered_at?: string | null;
  delivery_comment?: string | null;
  pickup_type?: string | null;
  customer_here_at?: string | null;
  scheduled_delivery_at?: string | null;
}

export default function KitchenDashboard() {
  const [apiKey, setApiKey] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const [showMultipleItems, setShowMultipleItems] = useState<Set<number>>(new Set());
  const [updatingOrders, setUpdatingOrders] = useState<Set<number>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [chatWidgetState, setChatWidgetState] = useState<{ open: boolean; waId: string; customerName: string } | null>(null);

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

  // Suppress Fast Refresh console messages in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        const message = args.join(' ');
        if (!message.includes('[Fast Refresh]') && !message.includes('hot-reloader-client.js')) {
          originalConsoleLog.apply(console, args);
        }
      };
    }
  }, []);

  // Register service worker for PWA functionality
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    }
  }, []);

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
  const handleOrderStatusUpdated = useCallback(async (forceRefresh = false) => {
    // Force refresh if requested (e.g., when rider is assigned), otherwise use debouncing
    const now = Date.now()
    const lastFetchTime = lastFetch ? lastFetch.getTime() : 0
    if (forceRefresh || now - lastFetchTime > 5000) {
      await refreshOrders(forceRefresh)
    }
  }, [refreshOrders, lastFetch])
  
  // Sync selectedOrderForModal with orders array when orders update (to preserve rider info)
  useEffect(() => {
    if (selectedOrderForModal && orders.length > 0) {
      const updatedOrder = orders.find(o => o.id === selectedOrderForModal.id)
      if (updatedOrder && (
        updatedOrder.rider_name !== selectedOrderForModal.rider_name ||
        updatedOrder.rider_phone !== selectedOrderForModal.rider_phone ||
        updatedOrder.rider_assigned_at !== selectedOrderForModal.rider_assigned_at
      )) {
        setSelectedOrderForModal(updatedOrder)
      }
    }
  }, [orders, selectedOrderForModal])

  // Check for saved token on mount - extended session
  useEffect(() => {
    const savedToken = localStorage.getItem("kitchen_token");
    const tokenTimestamp = localStorage.getItem("kitchen_token_timestamp");
    
    if (savedToken) {
      // Check if token is less than 24 hours old
      const now = Date.now();
      const tokenAge = tokenTimestamp ? now - parseInt(tokenTimestamp) : 0;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (tokenAge < maxAge) {
        setToken(savedToken);
        setIsAuthenticated(true);
      } else {
        // Token expired, remove it
        localStorage.removeItem("kitchen_token");
        localStorage.removeItem("kitchen_token_timestamp");
      }
    }
    setLoading(false);
  }, []);

  // Define handleLogout early so it can be used in useEffect
  const handleLogout = () => {
    localStorage.removeItem("kitchen_token");
    localStorage.removeItem("kitchen_token_timestamp");
    setToken(null);
    setIsAuthenticated(false);
    setApiKey("");
    setUpdatingOrders(new Set());
    setExpandedOrders(new Set());
    setShowMultipleItems(new Set());
    notificationSystem.markAllAsRead();
  };

  const handleManualRefresh = async () => {
    setRefreshSuccess(false);
    await refreshOrders();
    setRefreshSuccess(true);
    setTimeout(() => setRefreshSuccess(false), 2000);
  };

  // Extended token validation - only validate every 5 minutes and don't logout on errors
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
          
          // Only logout on 401 (unauthorized) - ignore all other errors
          if (response.status === 401) {
            handleLogout();
          }
          // All other errors are silently ignored in production
        } catch (error) {
          // Ignore all network errors in production - keep user logged in
          console.log("Token validation skipped due to network error");
        }
      };
      
      // Validate immediately, then every 5 minutes
      validateToken();
      const interval = setInterval(validateToken, 5 * 60 * 1000); // 5 minutes
      
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
        localStorage.setItem("kitchen_token_timestamp", Date.now().toString());
        
        // Success animation
        setSuccessMessage("🎉 Welcome to KBL Bites Kitchen!");
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
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
      setError("Network error - check your connection and API URL");
    } finally {
      setLoading(false);
    }
  };

  const markPaymentReceived = async (orderId: number) => {
    if (!token) return;
    
    // Prevent multiple clicks
    if (updatingOrders.has(orderId)) return;
    
    try {
      setUpdatingOrders(prev => new Set(prev).add(orderId));
      setError(null);
      setSuccessMessage(null);
      
      console.log(`Marking payment as received for order ${orderId}`);
      const response = await fetch(`/api/orders/${orderId}/payment-received`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      console.log(`Payment API response status: ${response.status}`);
      const data = await response.json();
      console.log(`Payment API response data:`, data);
      
      if (response.ok) {
        setSuccessMessage(`✅ Payment marked as received for Order #${orderId}`);
        setTimeout(() => setSuccessMessage(null), 3000);
        
        // Wait a moment for DB transaction to complete, then force refresh
        setTimeout(async () => {
          // Force refresh bypassing debounce to get immediate update
          console.log(`Forcing refresh after payment update`);
          await refreshOrders(true);
        }, 800);
      } else {
        const errorMsg = data.detail || data.error || data.details || "Failed to mark payment as received";
        console.error(`Payment update failed:`, errorMsg, data);
        setError(errorMsg);
        setTimeout(() => setError(null), 5000);
      }
    } catch (err) {
      console.error("Error marking payment:", err);
      setError("Network error - check your connection");
      setTimeout(() => setError(null), 5000);
    } finally {
      setUpdatingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const updateOrderStatus = async (orderId: number, status: string, riderName?: string, riderPhone?: string, deliveryComment?: string) => {
    if (updatingOrders.has(orderId)) return;
    
    try {
      setUpdatingOrders(prev => new Set(prev).add(orderId));
      
      // If rider is being assigned, use the dedicated rider assignment endpoint
      if (riderName || riderPhone) {
        console.log(`🚴 Assigning rider via dedicated endpoint: ${riderName} (${riderPhone}) to order ${orderId}`);
        
        const riderRequestBody = {
          rider_name: riderName || "",
          rider_phone: riderPhone || "",
          notify_customer: false
        };
        
        const riderResponse = await fetch(`/api/orders/${orderId}/rider`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(riderRequestBody),
        });
        
        const riderResponseData = await riderResponse.json().catch(() => ({}));
        
        console.log(`📡 Rider assignment response:`, riderResponse.status, riderResponse.statusText, riderResponseData);
        
        if (!riderResponse.ok) {
          console.error(`❌ Failed to assign rider to order ${orderId}:`, riderResponse.status, riderResponseData);
          throw new Error(riderResponseData.detail || `Failed to assign rider: ${riderResponse.statusText}`);
        }
        
        console.log(`✅ Rider assigned successfully to order ${orderId}:`, riderResponseData);
        
        // Refresh orders immediately when rider is assigned (force refresh)
        console.log(`🚴 RIDER ASSIGNED - Force refreshing orders after assignment...`);
        console.log(`   - Rider Name: ${riderName}`);
        console.log(`   - Rider Phone: ${riderPhone}`);
        console.log(`   - Order ID: ${orderId}`);
        // Wait a bit for the database to be updated
        await new Promise(resolve => setTimeout(resolve, 500));
        await handleOrderStatusUpdated(true);
        
        // After refresh, verify the rider data is present
        setTimeout(() => {
          const updatedOrder = orders.find(o => o.id === orderId);
          if (updatedOrder) {
            console.log(`🔍 VERIFYING RIDER PERSISTENCE - Order ${orderId}:`);
            console.log(`   - rider_name: ${updatedOrder.rider_name || 'MISSING'}`);
            console.log(`   - rider_phone: ${updatedOrder.rider_phone || 'MISSING'}`);
            console.log(`   - rider_assigned_at: ${updatedOrder.rider_assigned_at || 'MISSING'}`);
            if (updatedOrder.rider_name && updatedOrder.rider_phone) {
              console.log(`✅ RIDER DATA PERSISTED SUCCESSFULLY`);
            } else {
              console.error(`❌ RIDER DATA NOT FOUND AFTER REFRESH!`);
            }
          } else {
            console.error(`❌ Order ${orderId} not found in orders array after refresh`);
          }
        }, 1000);
        
        return; // Exit early since rider assignment is complete
      }
      
      // Otherwise, update order status normally
      const requestBody: any = { status };
      if (deliveryComment) requestBody.delivery_comment = deliveryComment;
      
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      
      // Parse response once
      const responseData = await response.json().catch(() => ({}));
      
      if (response.ok) {
        console.log(`✅ Order ${orderId} status updated successfully:`, responseData);
        const isDelivered = status?.toLowerCase() === "delivered";
        if (isDelivered) {
          removeOrderFromUI(orderId);
          await handleOrderStatusUpdated(true);
        } else {
          await handleOrderStatusUpdated(false);
        }
      } else {
        console.error(`❌ Failed to update order ${orderId}:`, response.status, responseData);
        if (response.status === 401) {
          // Only logout on authentication failure - no error message
          handleLogout();
        } else {
          throw new Error(responseData.detail || `Failed to update order: ${response.statusText}`);
        }
      }
    } catch (err) {
      console.error("❌ Error in updateOrderStatus:", err);
      throw err; // Re-throw to let the modal handle it
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
        body: JSON.stringify({ 
          status: "delivered",
          delivery_comment: deliveryComment || undefined
        }),
      });
      
      if (response.ok) {
        // Silent success - no error messages in production
        removeOrderFromUI(orderId);
        // Refresh orders to immediately remove delivered order (force refresh)
        await handleOrderStatusUpdated(true);
      } else if (response.status === 401) {
        // Only logout on authentication failure - no error message
        handleLogout();
      }
    } catch (err) {
      // Silent error handling - no error messages in production
    } finally {
      setUpdatingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const removeOrderFromUI = (orderId: number) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      newSet.delete(orderId);
      return newSet;
    });
    setShowMultipleItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(orderId);
      return newSet;
    });
    if (selectedOrderForModal?.id === orderId) {
      setIsOrderModalOpen(false);
      setSelectedOrderForModal(null);
    }
  };

  const requestLocation = async (orderId: number, waId: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/request-location`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSuccessMessage(`✅ Location request sent to customer ${waId}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to send location request");
        setTimeout(() => setError(null), 5000);
      }
    } catch (err) {
      setError("Network error - check your connection");
      setTimeout(() => setError(null), 5000);
    }
  };

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
        // Clean the delivery_info string (remove trailing slashes, etc.)
        const cleanInfo = order.delivery_info.trim().replace(/\/+$/, '');
        const parsed = parseCoordinates(cleanInfo);
        latitude = parsed.latitude;
        longitude = parsed.longitude;
      }

      // Initialize address variables - will be set from reverse geocoding or delivery_info
      let streetAddress: string | null = null;
      let areaNeighborhood: string | null = null;
      let cityDistrict: string | null = null;
      
      // Try to get detailed address information using reverse geocoding
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
            }
            
            // Get area/neighborhood
            if (addressDetails.neighborhood || addressDetails.suburb) {
              areaNeighborhood = addressDetails.neighborhood || addressDetails.suburb || '';
            }
            
            // Format city/district
            const cityParts: string[] = [];
            if (addressDetails.city) cityParts.push(addressDetails.city);
            if (addressDetails.district && addressDetails.district !== addressDetails.city) {
              cityParts.push(addressDetails.district);
            }
            if (cityParts.length > 0) {
              cityDistrict = cityParts.join(', ');
            }
          }
        } catch (geocodeError) {
          console.warn('Reverse geocoding failed:', geocodeError);
          // Don't set default values - let it remain null
        }
      }
      
      // If reverse geocoding didn't provide address, try to extract from delivery_info
      if (!streetAddress && order.delivery_info) {
        // Try to extract address from delivery_info text
        const deliveryInfo = order.delivery_info.trim();
        // If delivery_info contains readable text (not just coordinates), use it
        if (deliveryInfo && !deliveryInfo.match(/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/)) {
          // It's not just coordinates, might contain address info
          const lines = deliveryInfo.split('\n').filter(line => line.trim());
          if (lines.length > 0) {
            streetAddress = lines[0].trim();
          }
        }
      }
      
      // Only use fallback if we have absolutely no address information
      if (!streetAddress && !areaNeighborhood && !cityDistrict) {
        // Check if we have coordinates - if yes, show coordinates instead of fake address
        if (latitude !== null && longitude !== null) {
          streetAddress = `Coordinates: ${latitude}, ${longitude}`;
          areaNeighborhood = 'Address details not available';
          cityDistrict = 'Please use coordinates for navigation';
        } else {
          // No coordinates and no address - show a message
          streetAddress = 'Address not provided';
          areaNeighborhood = 'Please contact customer for delivery address';
          cityDistrict = '';
        }
      } else {
        // We have some address info, but fill in missing parts
        if (!streetAddress) streetAddress = 'Address not specified';
        if (!areaNeighborhood) areaNeighborhood = 'Area not specified';
        if (!cityDistrict) cityDistrict = 'City not specified';
      }

      // Format delivery info text with detailed address - always show the format
      let receiverAddressSection = `Receiver Address:
Street Address
${streetAddress}
Area/Neighborhood
${areaNeighborhood}
City/District
${cityDistrict}`;
      
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

      // Copy to clipboard with improved fallback for mobile devices
      let copySuccess = false;
      
      // Method 1: Try modern Clipboard API (works on HTTPS and secure contexts)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(deliveryText);
          copySuccess = true;
        } catch (clipboardError) {
          console.warn('Clipboard API failed, trying fallback:', clipboardError);
        }
      }
      
      // Method 2: Fallback using textarea and execCommand (works on HTTP and mobile)
      if (!copySuccess) {
        try {
          const textArea = document.createElement('textarea');
          textArea.value = deliveryText;
          // Make it visible but off-screen for better mobile compatibility
          textArea.style.position = 'fixed';
          textArea.style.top = '0';
          textArea.style.left = '0';
          textArea.style.width = '2em';
          textArea.style.height = '2em';
          textArea.style.padding = '0';
          textArea.style.border = 'none';
          textArea.style.outline = 'none';
          textArea.style.boxShadow = 'none';
          textArea.style.background = 'transparent';
          textArea.style.opacity = '0';
          textArea.style.zIndex = '-9999';
          textArea.setAttribute('readonly', '');
          textArea.setAttribute('aria-hidden', 'true');
          
          document.body.appendChild(textArea);
          
          // For iOS devices
          if (navigator.userAgent.match(/ipad|iphone/i)) {
            const range = document.createRange();
            range.selectNodeContents(textArea);
            const selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
              selection.addRange(range);
            }
            textArea.setSelectionRange(0, 999999);
          } else {
            textArea.select();
            textArea.setSelectionRange(0, 999999); // For mobile devices
          }
          
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (successful) {
            copySuccess = true;
          } else {
            throw new Error('execCommand copy returned false');
          }
        } catch (execError) {
          console.warn('execCommand fallback failed:', execError);
        }
      }
      
      // Method 3: Show text in a modal/textarea for manual copy
      if (!copySuccess) {
        // Create a modal-like overlay with the text
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '20px';
        
        const modal = document.createElement('div');
        modal.style.backgroundColor = 'white';
        modal.style.borderRadius = '8px';
        modal.style.padding = '20px';
        modal.style.maxWidth = '90%';
        modal.style.maxHeight = '80%';
        modal.style.overflow = 'auto';
        
        const title = document.createElement('h3');
        title.textContent = 'Copy Delivery Address';
        title.style.marginBottom = '15px';
        title.style.fontSize = '18px';
        title.style.fontWeight = 'bold';
        
        const textArea = document.createElement('textarea');
        textArea.value = deliveryText;
        textArea.style.width = '100%';
        textArea.style.minHeight = '200px';
        textArea.style.padding = '10px';
        textArea.style.border = '1px solid #ccc';
        textArea.style.borderRadius = '4px';
        textArea.style.fontSize = '14px';
        textArea.style.fontFamily = 'monospace';
        textArea.readOnly = true;
        textArea.onclick = () => textArea.select();
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginTop = '15px';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'flex-end';
        
        const copyButton = document.createElement('button');
        copyButton.textContent = 'Copy Text';
        copyButton.style.padding = '10px 20px';
        copyButton.style.backgroundColor = '#10b981';
        copyButton.style.color = 'white';
        copyButton.style.border = 'none';
        copyButton.style.borderRadius = '4px';
        copyButton.style.cursor = 'pointer';
        copyButton.onclick = () => {
          textArea.select();
          textArea.setSelectionRange(0, 999999);
          try {
            document.execCommand('copy');
            copyButton.textContent = 'Copied!';
            copyButton.style.backgroundColor = '#059669';
            setTimeout(() => {
              document.body.removeChild(overlay);
              setSuccessMessage(`✅ Delivery info copied to clipboard for Order #${order.id}`);
              setTimeout(() => setSuccessMessage(null), 3000);
            }, 1000);
          } catch (e) {
            alert('Please manually select and copy the text above.');
          }
        };
        
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.padding = '10px 20px';
        closeButton.style.backgroundColor = '#6b7280';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '4px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => {
          document.body.removeChild(overlay);
        };
        
        buttonContainer.appendChild(copyButton);
        buttonContainer.appendChild(closeButton);
        
        modal.appendChild(title);
        modal.appendChild(textArea);
        modal.appendChild(buttonContainer);
        overlay.appendChild(modal);
        overlay.onclick = (e) => {
          if (e.target === overlay) {
            document.body.removeChild(overlay);
          }
        };
        
        document.body.appendChild(overlay);
        textArea.focus();
        textArea.select();
        
        setError("Please use the popup to copy the delivery address");
        setTimeout(() => setError(null), 3000);
        return; // Exit early since we're showing a modal
      }
      
      // Success!
      if (copySuccess) {
        setSuccessMessage(`✅ Delivery info copied to clipboard for Order #${order.id}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error('Error in copyDeliveryInfo:', err);
      setError(`Failed to copy delivery info: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const bulkUpdatePendingOrders = async () => {
    if (!token || bulkUpdating) return;
    
    const confirmUpdate = window.confirm(
      "Are you sure you want to update all 'pending' orders to 'received'? This action cannot be undone."
    );
    
    if (!confirmUpdate) return;
    
    try {
      setBulkUpdating(true);
      setError(null);
      setSuccessMessage(null);
      
      const response = await fetch("/api/orders/bulk-update-status", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_status: "pending",
          to_status: "received",
          notify_customers: false,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage(
          `✅ Successfully updated ${data.updated_count || 0} orders from 'pending' to 'received'`
        );
        setTimeout(() => setSuccessMessage(null), 5000);
        // Refresh orders
        await handleOrderStatusUpdated();
      } else {
        setError(data.error || "Failed to bulk update orders");
      }
    } catch (err) {
      setError("Network error - check your connection");
    } finally {
      setBulkUpdating(false);
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return "0 RWF";
    }
    return `${amount.toLocaleString()} RWF`;
  };

  // Get price from size (fallback when price is missing)
  const getPriceFromSize = (size: string | null | undefined): number => {
    if (!size) return 0;
    const sizeLower = size.toLowerCase();
    if (sizeLower.includes('medium')) return 6500;
    if (sizeLower.includes('large')) return 7500;
    if (sizeLower.includes('wrap')) return 7500;
    if (sizeLower.includes('small')) return 6500;
    return 0;
  };

  // Calculate total from items if food_total is missing
  const calculateOrderTotal = (order: Order): number => {
    // If food_total exists and is valid, use it
    if (order.food_total !== null && order.food_total !== undefined && !isNaN(order.food_total) && order.food_total > 0) {
      return order.food_total;
    }

    // Otherwise, calculate from items
    try {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      if (Array.isArray(items) && items.length > 0) {
        let total = 0;
        for (const item of items) {
          // Use item price, or calculate from size, or use order-level size
          let price = item.price || 0;
          if (price === 0) {
            price = getPriceFromSize(item.size || order.size);
          }
          const quantity = item.quantity || order.quantity || 1;
          total += price * quantity;
        }
        
        // If no items had prices, try using order-level size
        if (total === 0 && order.size) {
          const orderPrice = getPriceFromSize(order.size);
          const orderQuantity = order.quantity || 1;
          total = orderPrice * orderQuantity;
        }
        
        // Also add drinks if any
        if (order.drinks) {
          const drinks = typeof order.drinks === 'string' ? JSON.parse(order.drinks) : order.drinks;
          if (Array.isArray(drinks) && drinks.length > 0) {
            for (const drink of drinks) {
              const drinkPrice = drink.price || 1500;
              const drinkQuantity = drink.quantity || 1;
              total += drinkPrice * drinkQuantity;
            }
          }
        }
        return total > 0 ? total : 0;
      } else if (order.size) {
        // No items array, but we have order-level size
        const orderPrice = getPriceFromSize(order.size);
        const orderQuantity = order.quantity || 1;
        return orderPrice * orderQuantity;
      }
    } catch (error) {
      console.error('Error calculating order total:', error);
    }

    return 0;
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
  const categorizeIngredients = (ingredients: string[] | null | undefined) => {
    const categories = {
      proteins: [] as string[],
      vegetables: [] as string[],
      sauces: [] as string[],
      bread: [] as string[],
      other: [] as string[]
    };

    if (!ingredients || !Array.isArray(ingredients)) {
      return categories;
    }

    ingredients.forEach(ingredient => {
      if (!ingredient || typeof ingredient !== 'string') {
        return;
      }
      
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

  // Helper function to get bread/wrap choice - returns clean size names
  // Valid product names that should be displayed
  const VALID_PRODUCT_NAMES = [
    'Large Sandwich',
    'Medium Sandwich',
    'Small Sandwich',
    'Fresh Wrap',
    'Regular Wrap',
    'Signature Wrap',
    'Shawarma Pro Max',
    'Shawarma'
  ];
  
  const getBreadChoice = (size: string | null | undefined, item?: any) => {
    // CRITICAL: The size field now contains the product display name (e.g., "Fresh Wrap", "Regular Wrap", "Large Sandwich")
    // We should validate and return it as-is, or map legacy sizes to display names
    
    let actualSize = size;
    
    // If size is N/A/null/empty, try to extract from item data
    if (!actualSize || typeof actualSize !== 'string' || actualSize.trim() === '' || actualSize === 'N/A' || actualSize === 'N/a') {
      // Try to extract from item if available
      if (item) {
        // Check if item has a valid size
        if (item.size && item.size !== 'N/A' && item.size.trim() !== '') {
          actualSize = item.size;
        }
      }
      
      // If still no size, return error message
      if (!actualSize || actualSize === 'N/A' || actualSize.trim() === '') {
        return '⚠️ Product Name Missing';
      }
    }
    
    const trimmedSize = actualSize.trim();
    const lower = trimmedSize.toLowerCase();
    
    // Check if it's already a valid product name
    for (const productName of VALID_PRODUCT_NAMES) {
      if (lower === productName.toLowerCase()) {
        return productName; // Return the exact valid product name
      }
    }
    
    // Map legacy size codes to product names
    if (lower === 'wrap' || lower === 'small_wrap' || lower === 'sm_wrap') {
      return 'Fresh Wrap'; // Default wrap is Fresh Wrap
    }
    if (lower === 'medium' || lower === 'med') {
      return 'Medium Sandwich';
    }
    if (lower === 'large' || lower === 'lg') {
      return 'Large Sandwich';
    }
    if (lower === 'shawarma_promax' || lower === 'shawarma_pro_max') {
      return 'Shawarma Pro Max';
    }
    
    // Try partial matching for valid product names
    if (lower.includes('fresh') && lower.includes('wrap')) {
      return 'Fresh Wrap';
    }
    if (lower.includes('regular') && lower.includes('wrap')) {
      return 'Regular Wrap';
    }
    if (lower.includes('signature') && lower.includes('wrap')) {
      return 'Signature Wrap';
    }
    if (lower.includes('large') && lower.includes('sandwich')) {
      return 'Large Sandwich';
    }
    if (lower.includes('medium') && lower.includes('sandwich')) {
      return 'Medium Sandwich';
    }
    if (lower.includes('small') && lower.includes('sandwich')) {
      return 'Small Sandwich';
    }
    if (lower.includes('shawarma') && lower.includes('pro') && lower.includes('max')) {
      return 'Shawarma Pro Max';
    }
    if (lower.includes('shawarma')) {
      return 'Shawarma';
    }
    
    // If none match, return the original value capitalized (might be a valid product name we don't know about)
    return trimmedSize.charAt(0).toUpperCase() + trimmedSize.slice(1);
  };
  
  // Parse coffee/drink order item: "Black Coffee (With Sugar (2 tsp))" or "Milk Coffee (No Sugar)"
  const parseCoffeeItem = (item: any): { isCoffee: boolean; type: string; sugarDisplay: string } => {
    const name = (item?.name || '').trim()
    const size = (item?.size || '').trim()
    const match = name.match(/^(.+?)\s*\((?:With Sugar \((\d+)\s*tsp\)|No Sugar)\)$/)
    if (match) {
      const type = match[1].trim()
      const sugarDisplay = match[2] ? `Sugar: ${match[2]} tsp` : 'Sugar: No'
      return { isCoffee: true, type, sugarDisplay }
    }
    if (size) {
      const tspMatch = size.match(/With Sugar \((\d+)\s*tsp\)/)
      if (tspMatch) {
        const type = name ? name.replace(/\s*\(With Sugar.*$/, '').trim() || 'Coffee' : 'Coffee'
        return { isCoffee: true, type, sugarDisplay: `Sugar: ${tspMatch[1]} tsp` }
      }
      if (size === 'No Sugar') {
        const type = name ? name.replace(/\s*\(No Sugar\).*$/, '').trim() || 'Coffee' : 'Coffee'
        return { isCoffee: true, type, sugarDisplay: 'Sugar: No' }
      }
    }
    return { isCoffee: false, type: '', sugarDisplay: '' }
  }

  // Format the product name for display with emoji
  const getSizeDisplayName = (productName: string) => {
    const lower = productName.toLowerCase();
    if (lower.includes('large') && lower.includes('sandwich')) return 'Large Sandwich 🥪';
    if (lower.includes('medium') && lower.includes('sandwich')) return 'Medium Sandwich 🥪';
    if (lower.includes('small') && lower.includes('sandwich')) return 'Small Sandwich 🥪';
    if (lower.includes('fresh') && lower.includes('wrap')) return 'Fresh Wrap 🌯';
    if (lower.includes('regular') && lower.includes('wrap')) return 'Regular Wrap 🌯';
    if (lower.includes('signature') && lower.includes('wrap')) return 'Signature Wrap 🌯';
    if (lower.includes('shawarma') && lower.includes('pro') && lower.includes('max')) return 'Shawarma Pro Max 🥙';
    if (lower.includes('shawarma')) return 'Shawarma 🥙';
    // If it's already a valid product name, just add emoji
    return productName; // Return as-is (will be formatted by getBreadChoice)
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

  const openOrderModal = (order: Order) => {
    setSelectedOrderForModal(order);
    setIsOrderModalOpen(true);
  };


  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-emerald-50 via-white to-amber-50">
        {/* Subtle background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-amber-200/30 blur-3xl" />
        </div>

        <Card className="relative w-full max-w-md border-0 shadow-xl shadow-emerald-900/10 rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
          <CardHeader className="text-center pb-2 pt-8 sm:pt-10">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center justify-center gap-3">
                <img
                  src="/logo.png"
                  alt="KBL Bites"
                  className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-sm"
                />
                <div className="flex flex-col items-start">
                  <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-700">
                    KBL Bites
                  </CardTitle>
                  <p className="text-amber-600 text-xs sm:text-sm font-medium uppercase tracking-widest">
                    Kitchen
                  </p>
                </div>
              </div>
              <p className="text-gray-500 text-sm max-w-xs">
                Sign in with your API key to manage orders
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pb-8 sm:pb-10 px-6 sm:px-8">
            <div className="space-y-2">
              <label htmlFor="api-key" className="text-sm font-medium text-gray-700">
                API Key
              </label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="h-11 text-base border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl"
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
            <Button
              onClick={handleLogin}
              disabled={loading || !apiKey.trim()}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/30 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign in
                  <span className="opacity-80">→</span>
                </span>
              )}
            </Button>
            {loading && (
              <p className="text-center text-xs text-gray-400">Verifying with server…</p>
            )}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-red-700 text-sm text-center">{error}</p>
              </div>
            )}
            {successMessage && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                <p className="text-emerald-700 text-sm font-medium text-center">{successMessage}</p>
              </div>
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
            <div className="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-3">
              {/* KBL Bites Logo */}
              <div className="flex items-center gap-2 sm:gap-3">
                <img 
                  src="/logo.png" 
                  alt="KBL Bites Logo" 
                  className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 object-contain"
                />
                <div className="flex flex-col">
                  <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-green-600 leading-tight">
                    <span className="text-green-600">KBL</span> <span className="text-green-600">Bites</span>
                    <span className="text-orange-500 text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl ml-1">•</span>
                  </h1>
                  <p className="text-gray-500 text-xs sm:text-sm font-medium uppercase tracking-wider">QUICK • FRESH • SATISFYING</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2 sm:gap-4">
              <p className="text-gray-600 text-xs sm:text-sm md:text-base">{orders.length} active orders</p>
              <div className="flex items-center gap-2">
                <RealTimeIndicator isConnected={true} lastUpdate={lastFetch || new Date()} isPolling={isPolling} />
                <Button
                  onClick={handleManualRefresh}
                  variant="outline"
                  size="sm"
                  className={`flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-7 sm:h-8 transition-all duration-200 ${
                    refreshSuccess 
                      ? 'text-green-600 bg-green-50 border-green-300' 
                      : 'text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200'
                  }`}
                  disabled={isPolling}
                >
                  <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${isPolling ? 'animate-spin' : ''}`} />
                  <span className="hidden xs:inline">
                    {refreshSuccess ? 'Refreshed!' : 'Refresh'}
                  </span>
                </Button>
                {notificationSystem.hasPermission && (
                  <Button
                    onClick={() => notificationSystem.triggerNewOrderNotification(1)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-7 sm:h-8"
                  >
                    <span className="text-sm">🔔</span>
                    <span className="hidden xs:inline">Test</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 md:gap-4 flex-shrink-0">
            {!notificationSystem.hasPermission && (
              <Button
                onClick={notificationSystem.requestNotificationPermission}
                variant="outline"
                size="sm"
                className="flex items-center gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-7 sm:h-8"
              >
                <span className="text-sm">🔔</span>
                <span className="hidden xs:inline">Enable Notifications</span>
              </Button>
            )}
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
          <TabsList className="flex w-full gap-1 sm:gap-2 md:gap-3 min-w-max h-12 sm:h-14">
            <TabsTrigger value="orders" className="flex items-center gap-1 sm:gap-2 relative text-xs sm:text-sm px-3 sm:px-4 py-3 sm:py-4 touch-manipulation flex-shrink-0 h-full">
              <Utensils className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Active Orders</span>
            <NotificationBadge count={notificationSystem.notifications.newOrders} />
          </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-3 sm:py-4 touch-manipulation flex-shrink-0 h-full">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Customers</span>
          </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-1 sm:gap-2 relative text-xs sm:text-sm px-3 sm:px-4 py-3 sm:py-4 touch-manipulation flex-shrink-0 h-full">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Messages</span>
            <NotificationBadge count={notificationSystem.notifications.newMessages} />
          </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-3 sm:py-4 touch-manipulation flex-shrink-0 h-full">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Analytics</span>
          </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-3 sm:py-4 touch-manipulation flex-shrink-0 h-full">
              <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Products</span>
          </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-3 sm:py-4 touch-manipulation flex-shrink-0 h-full">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Completed</span>
          </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-3 sm:py-4 touch-manipulation flex-shrink-0 h-full">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Order History</span>
          </TabsTrigger>
            <TabsTrigger value="addons" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-3 sm:py-4 touch-manipulation flex-shrink-0 h-full">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Addons</span>
          </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-3 sm:py-4 touch-manipulation flex-shrink-0 h-full">
              <Settings className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Config</span>
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
              {/* Bulk Update Button for Pending Orders */}
              {orders.some(order => order.status.toLowerCase() === "pending") && (
                <div className="flex items-center justify-center mb-3 sm:mb-4">
                  <Button
                    onClick={bulkUpdatePendingOrders}
                    disabled={bulkUpdating}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50 flex items-center gap-2 px-4 py-2 text-sm sm:text-base"
                  >
                    {bulkUpdating ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <span>🔄</span>
                        <span>Update All Pending Orders to Received</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {/* Success/Error Messages */}
              {successMessage && (
                <div className="mb-3 sm:mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                  <p className="text-green-700 text-sm font-medium">{successMessage}</p>
                </div>
              )}
              {error && (
                <div className="mb-3 sm:mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}
              
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
                      className="w-full max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-none shadow-xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 relative rounded-xl overflow-hidden touch-manipulation"
                    >
                      {/* Zoom Button - Top Left */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openOrderModal(order);
                        }}
                        className="absolute top-2 left-2 sm:top-3 sm:left-3 h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white flex items-center justify-center transition-all duration-200 touch-manipulation shadow-lg hover:shadow-xl active:scale-95 z-10 cursor-pointer"
                        title="View full order details (Click to zoom)"
                      >
                        <ZoomIn className="h-4 w-4 sm:h-4 sm:w-4" />
                      </button>
                      
                      {/* Close Button - Top Right */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          closeOrder(order.id);
                        }}
                        disabled={updatingOrders.has(order.id)}
                        className="absolute top-2 right-2 sm:top-3 sm:right-3 h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-md hover:bg-red-100 hover:text-red-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 touch-manipulation bg-white shadow-md border-2 border-red-200 z-10"
                        title="Close order"
                      >
                        {updatingOrders.has(order.id) ? (
                          <span className="animate-spin text-red-600 text-sm">⏳</span>
                        ) : (
                          <X className="h-4 w-4 sm:h-5 sm:w-5" />
                        )}
                      </button>

                      <CardHeader className="pb-6 sm:pb-7 md:pb-8 pl-20 sm:pl-24 md:pl-28 pr-20 sm:pr-24 md:pr-28 bg-gradient-to-r from-gray-50 to-white border-b-2 border-gray-200 p-6 sm:p-7 md:p-8">
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
                              {formatCurrency(calculateOrderTotal(order))}
                            </div>
                              <div className="text-xs sm:text-sm text-gray-500">Total</div>
                              {/* Payment Status Badge - Always Show */}
                              <div className="mt-3 flex flex-col items-end gap-2">
                                {(() => {
                                  const paymentStatus = order.payment_status?.toLowerCase() || 'pending';
                                  const hasPaymentReceived = order.payment_received_at !== null && order.payment_received_at !== undefined;
                                  const isPaid = paymentStatus === 'paid' || paymentStatus === 'received' || hasPaymentReceived;
                                  
                                  return isPaid ? (
                                    <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2.5 text-sm font-semibold shadow-lg">
                                      <CheckCircle className="h-4 w-4 mr-1.5" />
                                      Paid
                                    </Badge>
                                  ) : (
                                    <>
                                      <Badge className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-3 py-1.5 text-xs font-semibold">
                                        <span className="mr-1">⏳</span>
                                        Payment Pending
                                      </Badge>
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          markPaymentReceived(order.id);
                                        }}
                                        disabled={updatingOrders.has(order.id)}
                                        className="inline-flex items-center justify-center gap-2 px-5 py-3 text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-95 touch-manipulation min-h-[48px] min-w-[140px]"
                                        title="Mark Payment as Received"
                                      >
                                        {updatingOrders.has(order.id) ? (
                                          <>
                                            <RefreshCw className="h-5 w-5 animate-spin" />
                                            <span>Marking...</span>
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle className="h-5 w-5" />
                                            <span>Mark as Paid</span>
                                          </>
                                        )}
                                      </button>
                                    </>
                                  );
                                })()}
                                {/* Drive & Pick: Pickup type + CUSTOMER HERE */}
                                {(order.pickup_type || order.customer_here_at) && (
                                  <div className="flex flex-wrap justify-end gap-2 mt-1">
                                    {order.pickup_type === 'bring_to_street' && (
                                      <Badge variant="outline" className="border-amber-500 text-amber-700">Bring to Street</Badge>
                                    )}
                                    {order.pickup_type === 'i_will_pick' && (
                                      <Badge variant="outline" className="border-amber-500 text-amber-700">I Will Pick</Badge>
                                    )}
                                    {order.customer_here_at && (
                                      <Badge className="bg-orange-600 text-white font-semibold">CUSTOMER HERE</Badge>
                                    )}
                                  </div>
                                )}
                                {/* Chat with Customer Button - Always Show */}
                                {token && (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setChatWidgetState({ 
                                        open: true, 
                                        waId: order.wa_id, 
                                        customerName: order.profile_name 
                                      });
                                    }}
                                    className="inline-flex items-center justify-center gap-2 px-5 py-3 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 touch-manipulation min-h-[48px] min-w-[140px]"
                                    title="Chat with Customer"
                                  >
                                    <MessageSquare className="h-5 w-5" />
                                    <span>Chat with Customer</span>
                                  </button>
                                )}
                                
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-base sm:text-lg text-gray-600 font-medium">
                            {new Date(order.created_at).toLocaleDateString()} • {new Date(order.created_at).toLocaleTimeString()}
                          </div>
                          {order.scheduled_delivery_at && (
                            <div className="mt-1 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 inline-flex items-center gap-1">
                              📅 Scheduled: {new Date(order.scheduled_delivery_at).toLocaleDateString()} at {new Date(order.scheduled_delivery_at).toLocaleTimeString()}
                            </div>
                          )}
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
                        {/* Rider Information Section - Prominent display on card */}
                        {(order.rider_name || order.rider_phone) && (
                          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 sm:p-5 border-2 border-blue-300 shadow-md">
                            <div className="flex items-center gap-2 mb-3">
                              <Truck className="h-5 w-5 text-blue-600" />
                              <h4 className="font-bold text-blue-900 text-base sm:text-lg">🚚 Delivery Rider Assigned</h4>
                            </div>
                            <div className="space-y-2">
                              {order.rider_name && (
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-blue-600" />
                                  <span className="font-semibold text-gray-900 text-sm sm:text-base">Name: {order.rider_name}</span>
                                </div>
                              )}
                              {order.rider_phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-blue-600" />
                                  <span className="text-gray-700 text-sm sm:text-base">Phone: {order.rider_phone}</span>
                                </div>
                              )}
                              {order.rider_assigned_at && (
                                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 mt-2 pt-2 border-t border-blue-200">
                                  <Clock className="h-3 w-3" />
                                  <span>Assigned: {new Date(order.rider_assigned_at).toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Food Items - Table Format */}
                          <div className="bg-white rounded-xl p-6 sm:p-7 border-2 border-gray-200 shadow-sm">
                          <div className="flex items-center gap-3 mb-4">
                                <span className="text-xl sm:text-2xl">🍽️</span>
                                <h4 className="font-bold text-base sm:text-lg text-gray-800">Food Items</h4>
                            </div>
                            
                          {/* Parse and display all items: split main vs add-ons using raw item (before order fallbacks) to avoid duplicates */}
                                      {(() => {
                                        try {
                              let rawItems: any[] = [];
                              if (order.items) {
                                const parsed = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                                rawItems = Array.isArray(parsed) ? parsed : [];
                              }
                              if (rawItems.length === 0) {
                                const orderIngredients = Array.isArray(order.ingredients) ? order.ingredients : (order.ingredients ? [order.ingredients] : []);
                                rawItems = [{
                                  size: order.size || '',
                                  quantity: order.quantity || 1,
                                  ingredients: orderIngredients,
                                  spice_level: order.spice_level || 'None',
                                  sauce: order.sauce || 'None',
                                  price: 0,
                                  product_id: null,
                                  preset_id: null
                                }];
                              }

                              const isAddonItem = (it: any) => {
                                if (it.type === 'addon') return true;
                                const noIds = it.product_id == null && it.preset_id == null;
                                const hasName = it.name != null && String(it.name).trim() !== '';
                                const noMainShape = !(it.size && String(it.size).trim()) && (!it.ingredients || !Array.isArray(it.ingredients) || it.ingredients.length === 0);
                                return hasName && (noIds || noMainShape);
                              };
                              const rawMain = rawItems.filter((it: any) => !isAddonItem(it));
                              const rawAddons = rawItems.filter((it: any) => isAddonItem(it));

                              const mainItems = rawMain.map((item: any) => ({
                                name: item.name || '',
                                size: item.size || order.size || '',
                                quantity: item.quantity || order.quantity || 1,
                                ingredients: (item.ingredients && Array.isArray(item.ingredients) && item.ingredients.length > 0) ? item.ingredients : (Array.isArray(order.ingredients) && order.ingredients.length > 0 ? order.ingredients : []),
                                spice_level: (item.spice_level && item.spice_level !== 'None' && item.spice_level !== 'none' && item.spice_level !== '') ? item.spice_level : (order.spice_level && order.spice_level !== 'None' && order.spice_level !== 'none' && order.spice_level !== '' ? order.spice_level : 'None'),
                                sauce: (item.sauce && item.sauce !== 'None' && item.sauce !== 'none' && item.sauce !== '') ? item.sauce : (order.sauce && order.sauce !== 'None' && order.sauce !== 'none' && order.sauce !== '' ? order.sauce : 'None'),
                                price: item.price || 0
                              }));

                              const addonByName = new Map<string, { name: string; quantity: number; price: number }>();
                              for (const it of rawAddons) {
                                const name = (it.name || 'Add-on').trim() || 'Add-on';
                                const qty = typeof it.quantity === 'number' ? it.quantity : parseInt(String(it.quantity), 10) || 1;
                                const price = typeof it.price === 'number' ? it.price : parseFloat(String(it.price)) || 0;
                                const existing = addonByName.get(name);
                                if (existing) {
                                  existing.quantity += qty;
                                  existing.price += price * qty;
                                } else {
                                  addonByName.set(name, { name, quantity: qty, price: price * qty });
                                }
                              }
                              const addonOnlyItems = Array.from(addonByName.values());

                              if (mainItems.length === 0 && addonOnlyItems.length === 0) {
                                return <div className="text-center p-4 text-gray-500 italic">No items found</div>;
                              }

                              return (
                                <div className="overflow-x-auto space-y-3">
                                  {addonOnlyItems.length > 0 && (
                                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                      <span className="text-xs font-semibold text-amber-800">Add-ons: </span>
                                      <span className="text-sm text-amber-900">
                                        {addonOnlyItems.map((row: { name: string; quantity: number; price: number }) =>
                                          `${row.name}${row.quantity > 1 ? ` ×${row.quantity}` : ''}${row.price > 0 ? ` (${Number(row.price).toLocaleString()} RWF)` : ''}`
                                        ).join(', ')}
                                      </span>
                                    </div>
                                  )}
                                  {mainItems.length > 0 && (
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr className="bg-gradient-to-r from-green-50 to-blue-50 border-b-2 border-gray-300">
                                        <th className="text-left p-3 text-xs sm:text-sm font-bold text-gray-700">#</th>
                                        <th className="text-left p-3 text-xs sm:text-sm font-bold text-gray-700">Size</th>
                                        <th className="text-left p-3 text-xs sm:text-sm font-bold text-gray-700">Qty</th>
                                        <th className="text-left p-3 text-xs sm:text-sm font-bold text-gray-700">Ingredients</th>
                                        <th className="text-left p-3 text-xs sm:text-sm font-bold text-gray-700">Spice</th>
                                        <th className="text-left p-3 text-xs sm:text-sm font-bold text-gray-700">Sauce</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {mainItems.map((item: any, idx: number) => {
                                        // Get ingredients - ensure it's always an array
                                        const itemIngredients: string[] = Array.isArray(item.ingredients) && item.ingredients.length > 0
                                          ? item.ingredients
                                          : (Array.isArray(order.ingredients) && order.ingredients.length > 0
                                              ? order.ingredients
                                              : []);
                                        
                                        // Get product name - prefer item size, fallback to order size
                                        // CRITICAL: The size field now contains the product display name
                                        let rawSize = item.size || order.size;
                                        // If size is N/A, try multiple fallbacks
                                        if (!rawSize || rawSize === 'N/A' || rawSize.trim() === '') {
                                          // Try to get from item directly
                                          rawSize = item.size;
                                          // If still N/A, try order size
                                          if (!rawSize || rawSize === 'N/A') {
                                            rawSize = order.size;
                                          }
                                        }
                                        // Get the validated product name
                                        let productName = getBreadChoice(rawSize, item);
                                        
                                        // CRITICAL: Never show "Custom Item" - validate against known product names
                                        if (productName === '⚠️ Product Name Missing' || productName === 'Size Missing') {
                                          // Try to infer from other data, but use a valid product name
                                          // Check if we can infer from size patterns
                                          const sizeLower = (rawSize || '').toLowerCase();
                                          if (sizeLower.includes('wrap')) {
                                            productName = 'Fresh Wrap'; // Default wrap
                                          } else if (sizeLower.includes('large')) {
                                            productName = 'Large Sandwich';
                                          } else if (sizeLower.includes('medium')) {
                                            productName = 'Medium Sandwich';
                                          } else if (sizeLower.includes('small')) {
                                            productName = 'Small Sandwich';
                                          } else if (sizeLower.includes('shawarma')) {
                                            productName = 'Shawarma Pro Max';
                                          } else {
                                            // Last resort: show error but don't use "Custom Item"
                                            productName = '⚠️ Product Name Missing';
                                          }
                                        }
                                        
                                        // Format the product name for display with emoji
                                        const displaySize = getSizeDisplayName(productName);
                                        const coffeeParsed = parseCoffeeItem(item);
                                        
                                        // Clean spice - remove any "Drinks:" contamination
                                        let itemSpice = (item.spice_level && item.spice_level !== 'None' && item.spice_level !== 'none' && item.spice_level !== '')
                                          ? item.spice_level
                                          : (order.spice_level && order.spice_level !== 'None' && order.spice_level !== 'none' && order.spice_level !== ''
                                              ? order.spice_level
                                              : 'None');
                                        // Remove "Drinks:" text from spice
                                        itemSpice = itemSpice.split('Drinks:')[0].split('🥤')[0].trim();
                                        
                                        // Clean sauce - remove "Drinks:" and corrupted characters
                                        let itemSauce = (item.sauce && item.sauce !== 'None' && item.sauce !== 'none' && item.sauce !== '')
                                          ? item.sauce
                                          : (order.sauce && order.sauce !== 'None' && order.sauce !== 'none' && order.sauce !== ''
                                              ? order.sauce
                                              : 'None');
                                        // CRITICAL: Remove price information contamination
                                        // Remove patterns like "Regular Wrap x1 - Price 6500 RWF each - Total 6500 RWF"
                                        itemSauce = itemSauce
                                          .replace(/\s*[A-Za-z\s]+Wrap\s*x\d+.*?Price.*?RWF.*?/gi, '')  // Remove wrap price info
                                          .replace(/\s*[A-Za-z\s]+Sandwich\s*x\d+.*?Price.*?RWF.*?/gi, '')  // Remove sandwich price info
                                          .replace(/\s*Price\s*[\d,]+\s*RWF.*?/gi, '')  // Remove "Price X RWF"
                                          .replace(/\s*Total\s*[\d,]+\s*RWF.*?/gi, '')  // Remove "Total X RWF"
                                          .replace(/\s*x\d+.*?/gi, '')  // Remove "x1", "x2", etc.
                                          .replace(/\s*Ingredients.*?$/gi, '')  // Remove "Ingredients" text
                                          .split('Drinks:')[0]  // Remove everything after "Drinks:"
                                          .split('🥤')[0]       // Remove everything after drinks emoji
                                          .split('Food Total:')[0]  // Remove "Food Total:"
                                          .split('Delivery:')[0]    // Remove "Delivery:"
                                          .replace(/\s*(Regular|Fresh|Signature)\s+Wrap\s*/gi, '')  // Remove product names
                                          .replace(/\s*(Large|Medium|Small)\s+Sandwich\s*/gi, '')  // Remove product names
                                          .replace(/\s*Shawarma\s*(Pro\s+Max)?\s*/gi, '')  // Remove product names
                                          .replace(/[^\w\s-]/g, '')  // Remove corrupted emoji characters but keep word chars, spaces, hyphens
                                          .replace(/\s+/g, ' ')      // Normalize whitespace
                                          .trim();
                                        // If sauce is empty after cleaning, set to 'None'
                                        if (!itemSauce || itemSauce === '') {
                                          itemSauce = 'None';
                                        }
                                        
                                                              return (
                                          <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                                            <td className="p-3 text-xs sm:text-sm font-semibold text-gray-600">{idx + 1}</td>
                                            <td className="p-3 text-xs sm:text-sm font-semibold text-gray-800">
                                              {coffeeParsed.isCoffee ? (
                                                <span>
                                                  <span className="block">{coffeeParsed.type}</span>
                                                  <span className="block text-amber-700 text-xs font-medium mt-0.5">{coffeeParsed.sugarDisplay}</span>
                                                </span>
                                              ) : (
                                                displaySize
                                              )}
                                            </td>
                                            <td className="p-3 text-xs sm:text-sm text-gray-700">×{item.quantity || order.quantity || 1}</td>
                                            <td className="p-3 text-xs sm:text-sm">
                                              {itemIngredients.length > 0 ? (
                                                  <div className="flex flex-wrap gap-1">
                                                  {itemIngredients.map((ing: string, ingIdx: number) => (
                                                    <span key={ingIdx} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded capitalize">
                                                      {ing.replace('-', ' ')}
                                                      </span>
                                                    ))}
                                                                      </div>
                                              ) : (
                                                <span className="text-gray-400 text-xs italic">No ingredients listed</span>
                                              )}
                                            </td>
                                            <td className="p-3 text-xs sm:text-sm text-gray-700 capitalize">
                                              {itemSpice}
                                            </td>
                                            <td className="p-3 text-xs sm:text-sm text-gray-700 capitalize">
                                              {itemSauce !== 'None' ? itemSauce.replace('-', ' ') : 'None'}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                  )}
                                                                      </div>
                              );
                            } catch (error) {
                              console.error('Error parsing items:', error);
                              return (
                                <div className="text-center p-4 text-red-600 text-sm">
                                  Error displaying items. Showing legacy format.
                                                                      </div>
                              );
                            }
                                                            })()}
                                                  </div>
                                                  
                        {/* Drinks Section - Always show */}
                                                      {(() => {
                          try {
                            let drinks: any[] = [];
                            if (order.drinks) {
                              if (typeof order.drinks === 'string') {
                                try {
                                  drinks = JSON.parse(order.drinks);
                                } catch (e) {
                                  console.error('Error parsing drinks JSON:', e, order.drinks);
                                  drinks = [];
                                }
                              } else if (Array.isArray(order.drinks)) {
                                drinks = order.drinks;
                              }
                            }
                            
                            // Clean up drink names (remove leading commas, trim whitespace)
                            drinks = drinks.map((drink: any) => ({
                              ...drink,
                              name: drink.name ? drink.name.replace(/^,\s*/, '').trim() : 'Drink'
                            }));
                            
                            console.log('Parsed drinks:', drinks);
                            
                                                        return (
                              <div className="bg-white rounded-xl p-6 sm:p-7 border-2 border-gray-200 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                  <span className="text-xl sm:text-2xl">🥤</span>
                                  <h4 className="font-bold text-base sm:text-lg text-gray-800">Drinks</h4>
                                                                </div>
                                {Array.isArray(drinks) && drinks.length > 0 ? (
                                  <div className="space-y-2">
                                    {drinks.map((drink: any, idx: number) => (
                                      <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-3">
                                          <span className="text-lg">🥤</span>
                                          <div>
                                            <div className="font-semibold text-gray-800">{drink.name || 'Drink'}</div>
                                            <div className="text-xs text-gray-600">Quantity: ×{drink.quantity || 1}</div>
                                                                </div>
                                                              </div>
                                        <div className="text-sm font-semibold text-green-600">
                                          {drink.price ? `${drink.price.toLocaleString()} RWF` : '1,500 RWF'}
                                                                </div>
                                                                </div>
                                                                  ))}
                                                                </div>
                                ) : (
                                  <div className="text-center py-4 text-gray-500 text-sm italic">
                                    None
                                                              </div>
                                                            )}
                                                                </div>
                            );
                                        } catch (error) {
                            console.error('Error displaying drinks:', error, order.drinks);
                            return (
                              <div className="bg-white rounded-xl p-6 sm:p-7 border-2 border-gray-200 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                  <span className="text-xl sm:text-2xl">🥤</span>
                                  <h4 className="font-bold text-base sm:text-lg text-gray-800">Drinks</h4>
                                    </div>
                                <div className="text-center py-4 text-gray-500 text-sm italic">
                                  None
                                  </div>
                                    </div>
                            );
                                        }
                                      })()}

                        {/* Delivery Info with OpenStreetMap */}
                        {(() => {
                          // Check if location is valid - accept coordinates, addresses, or any non-default value
                          const deliveryInfo = order.delivery_info || '';
                          const deliveryInfoLower = deliveryInfo.toLowerCase().trim();
                          
                          const isInvalidLocation = 
                            deliveryInfoLower === '' ||
                            deliveryInfoLower === 'to be arranged with delivery person' ||
                            deliveryInfoLower === 'location shared' ||
                            deliveryInfoLower === 'none';
                          
                          // Prefer backend-parsed coordinates, fallback to frontend parsing
                          let latitude: number | null = null;
                          let longitude: number | null = null;
                          let address: string = deliveryInfo;
                          
                          if (order.delivery_latitude !== null && order.delivery_latitude !== undefined &&
                              order.delivery_longitude !== null && order.delivery_longitude !== undefined) {
                            // Use backend-parsed coordinates
                            latitude = order.delivery_latitude;
                            longitude = order.delivery_longitude;
                            address = order.delivery_address || deliveryInfo;
                          } else {
                            // Fallback to frontend parsing
                            const parsed = parseCoordinates(deliveryInfo);
                            latitude = parsed.latitude;
                            longitude = parsed.longitude;
                            address = parsed.address;
                          }
                          
                          // Check if we have valid coordinates
                          const hasValidCoordinates = latitude !== null && longitude !== null && 
                            !isNaN(latitude) && !isNaN(longitude) &&
                            latitude >= -90 && latitude <= 90 &&
                            longitude >= -180 && longitude <= 180;
                          
                          if (!isInvalidLocation || hasValidCoordinates) {
                            // Format coordinates for external maps
                            let mapsQuery = deliveryInfo;
                            if (hasValidCoordinates) {
                              mapsQuery = `${latitude},${longitude}`;
                            }
                            
                            return (
                              <div className="bg-white border-2 border-blue-200 rounded-lg p-4 sm:p-5 shadow-lg">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-xl">🚚</span>
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="text-lg sm:text-xl font-bold text-blue-900">Delivery Location</h3>
                                    {address && !hasValidCoordinates && (
                                      <div className="text-sm text-blue-700 mt-1 bg-blue-50 p-2 rounded-lg border border-blue-200">
                                        {address}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Delivery Address Information */}
                                {hasValidCoordinates ? (
                                  <div className="mb-4">
                                    <DeliveryMap
                                      id={order.id}
                                      latitude={latitude!}
                                      longitude={longitude!}
                                      address={address}
                                      height="300px"
                                      zoom={15}
                                    />
                                  </div>
                                ) : (
                                  <div className="text-sm text-blue-700 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-200">
                                    {deliveryInfo}
                                  </div>
                                )}
                                
                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    onClick={() => copyDeliveryInfo(order)}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                                  >
                                    <Copy size={16} />
                                    Copy Address
                                  </Button>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {(!order.delivery_info || 
                          order.delivery_info.trim() === '' || 
                          order.delivery_info.toLowerCase() === 'to be arranged with delivery person' ||
                          order.delivery_info.toLowerCase() === 'location shared') && (
                          <div className="bg-white border-2 border-orange-200 rounded-lg p-3 shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                <span className="text-lg">⚠️</span>
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-orange-900">Location Required</h3>
                                <div className="text-sm text-orange-700 mt-2 bg-orange-50 p-2 rounded-lg border border-orange-200">
                                  ⚠️ Please contact customer to get delivery location
                                </div>
                                <Button
                                  onClick={() => requestLocation(order.id, order.wa_id)}
                                  className="mt-3 w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                                >
                                  <span>📍</span>
                                  Request Location from Customer
                                </Button>
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
                                className="w-full inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-xl text-base sm:text-lg font-bold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 active:scale-95 disabled:scale-100 h-12 sm:h-14 px-6 sm:px-8 shadow-lg hover:shadow-xl touch-manipulation"
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
                                className="w-full inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-xl text-base sm:text-lg font-bold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 active:scale-95 disabled:scale-100 h-12 sm:h-14 px-6 sm:px-8 shadow-lg hover:shadow-xl touch-manipulation"
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
                                className="w-full inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-xl text-base sm:text-lg font-bold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 text-white hover:from-emerald-600 hover:via-green-600 hover:to-teal-600 active:scale-95 disabled:scale-100 h-12 sm:h-14 px-6 sm:px-8 shadow-xl hover:shadow-2xl touch-manipulation relative overflow-hidden group"
                              >
                                {/* Animated background effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform -skew-x-12 -translate-x-full group-hover:translate-x-full"></div>
                                
                                {updatingOrders.has(order.id) ? (
                                  <span className="animate-spin text-lg relative z-10">⏳</span>
                                ) : (
                                  <span className="text-xl relative z-10">✅</span>
                                )}
                                <span className="hidden xs:inline relative z-10">{updatingOrders.has(order.id) ? "Updating..." : "Mark as Delivered"}</span>
                                <span className="xs:hidden relative z-10">{updatingOrders.has(order.id) ? "..." : "Delivered"}</span>
                                
                                {/* Success checkmark animation */}
                                {!updatingOrders.has(order.id) && (
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <div className="w-6 h-6 border-2 border-white rounded-full flex items-center justify-center">
                                      <div className="w-2 h-2 bg-white rounded-full"></div>
                                    </div>
                                  </div>
                                )}
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

        {/* Products Management Tab */}
        <TabsContent value="products">
          <ProductsManagement token={token} />
        </TabsContent>

        {/* Addons Tab */}
        <TabsContent value="addons">
          <AddonsManagement token={token} />
        </TabsContent>

        {/* App Config Tab (source availability + site config) */}
        <TabsContent value="config">
          <AppConfigManagement />
        </TabsContent>

        {/* Completed Orders Tab */}
        <TabsContent value="completed">
          <CompletedOrdersCalendarView token={token} />
        </TabsContent>

        {/* Order History Tab */}
        <TabsContent value="history">
          <DeliveredOrdersView token={token} />
        </TabsContent>
        </Tabs>

        {/* Order Detail Modal - Always use latest order data from orders array */}
        <OrderDetailModal
          order={selectedOrderForModal ? (orders.find(o => o.id === selectedOrderForModal.id) || selectedOrderForModal) : null}
          open={isOrderModalOpen}
          onOpenChange={(open) => {
            setIsOrderModalOpen(open)
            // When closing, update selectedOrder with latest data from orders array to preserve rider info
            if (!open && selectedOrderForModal) {
              const updatedOrder = orders.find(o => o.id === selectedOrderForModal.id)
              if (updatedOrder) {
                setSelectedOrderForModal(updatedOrder)
              }
            }
          }}
          formatCurrency={formatCurrency}
          calculateOrderTotal={calculateOrderTotal}
          getBreadChoice={getBreadChoice}
          getSizeDisplayName={getSizeDisplayName}
          getSpiceLevel={getSpiceLevel}
          parseCoffeeItem={parseCoffeeItem}
          onOpenChat={(waId, customerName) => {
            setChatWidgetState({ open: true, waId, customerName });
          }}
          onUpdateOrder={updateOrderStatus}
          onOrderUpdated={handleOrderStatusUpdated}
          token={token}
        />
        
        {/* Floating Chat Widget - rendered at page level */}
        {chatWidgetState && token && (
          <ChatWidget
            customerName={chatWidgetState.customerName}
            phoneNumber={chatWidgetState.waId}
            token={token}
            open={chatWidgetState.open}
            onOpenChange={(open) => {
              if (!open) {
                setChatWidgetState(null);
              } else {
                setChatWidgetState({ ...chatWidgetState, open: true });
              }
            }}
            onNewMessage={(message) => {
              console.log("New message received:", message);
            }}
          />
        )}
      </div>
    );
  }
