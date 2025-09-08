"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface NotificationData {
  newOrders: number
  newMessages: number
  lastOrderCheck: string
  lastMessageCheck: string
}

interface UseNotificationsProps {
  token: string | null
  isActive: boolean
  onNewOrder?: () => void
  onNewMessage?: () => void
}

export function useNotifications({ token, isActive, onNewOrder, onNewMessage }: UseNotificationsProps) {
  const [notifications, setNotifications] = useState<NotificationData>({
    newOrders: 0,
    newMessages: 0,
    lastOrderCheck: new Date().toISOString(),
    lastMessageCheck: new Date().toISOString(),
  })

  const [hasPermission, setHasPermission] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [volume, setVolume] = useState(70)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null)

  // Show browser notification
  const showBrowserNotification = useCallback(
    (title: string, body: string, icon?: string) => {
      if (hasPermission && "Notification" in window) {
        const notification = new Notification(title, {
          body,
          icon: icon || "/logo.png",
          badge: "/logo.png",
          tag: "kitchen-notification",
          requireInteraction: true, // Keep notification until user interacts
          silent: false,
          data: {
            url: window.location.href,
            timestamp: Date.now()
          }
        })

        // Handle notification click
        notification.onclick = () => {
          window.focus()
          notification.close()
        }

        // Auto-close notification after 10 seconds (longer for mobile)
        setTimeout(() => {
          notification.close()
        }, 10000)
      }
    },
    [hasPermission],
  )

  // Request notification permission with better mobile support
  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications")
      return false
    }

    if (Notification.permission === "granted") {
      setHasPermission(true)
      return true
    }

    if (Notification.permission === "denied") {
      console.log("Notification permission denied")
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      const granted = permission === "granted"
      setHasPermission(granted)
      
      if (granted) {
        console.log("✅ Notification permission granted!")
        // Show a test notification
        showBrowserNotification(
          "🔔 Notifications Enabled!",
          "You'll now receive alerts for new orders and messages.",
          "/logo.png"
        )
      } else {
        console.log("❌ Notification permission denied")
      }
      
      return granted
    } catch (error) {
      console.error("Error requesting notification permission:", error)
      return false
    }
  }, [showBrowserNotification])

  // Initialize audio and request notification permission
  useEffect(() => {
    // Create fallback audio using Web Audio API
    const createFallbackAudio = () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
        oscillator.type = 'sine'
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime)
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
        
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.5)
        
        // Store reference for cleanup
        fallbackAudioRef.current = { 
          play: () => {
            const newContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            const newOscillator = newContext.createOscillator()
            const newGainNode = newContext.createGain()
            
            newOscillator.connect(newGainNode)
            newGainNode.connect(newContext.destination)
            
            newOscillator.frequency.setValueAtTime(800, newContext.currentTime)
            newOscillator.type = 'sine'
            
            newOscillator.start(newContext.currentTime)
            newOscillator.stop(newContext.currentTime + 0.5)
          }
        } as HTMLAudioElement
      } catch (error) {
        console.log("⚠️ Could not create fallback audio:", error)
      }
    }

    // Try to create audio element for notifications
    try {
      audioRef.current = new Audio("/sounds/simple-notification.mp3")
      audioRef.current.volume = volume / 100
      
      // Add error handling for audio loading
      audioRef.current.addEventListener('error', () => {
        console.log("⚠️ Primary notification sound failed to load, using fallback")
        createFallbackAudio()
      })
    } catch (error) {
      console.log("⚠️ Could not create primary audio element, using fallback")
      createFallbackAudio()
    }

    // Request notification permission
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        setHasPermission(permission === "granted")
      })
    }

    // Load settings from localStorage
    const savedSettings = localStorage.getItem("notification-settings")
    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      setSoundEnabled(settings.soundEnabled ?? true)
      setVolume(settings.volume ?? 70)
    }
  }, [])

  // Update audio volume when volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
    }
  }, [volume])

  // Save settings to localStorage
  useEffect(() => {
    const settings = { soundEnabled, volume }
    localStorage.setItem("notification-settings", JSON.stringify(settings))
  }, [soundEnabled, volume])

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return

    try {
      // Try primary audio first
      if (audioRef.current && audioRef.current.readyState >= 2) {
        audioRef.current.currentTime = 0
        audioRef.current.volume = volume / 100
        
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          playPromise.catch((e) => {
            console.log("Primary audio failed, trying fallback:", e)
            playFallbackSound()
          })
        }
      } else {
        // Use fallback if primary audio isn't ready
        playFallbackSound()
      }
    } catch (error) {
      console.log("Audio playback error, using fallback:", error)
      playFallbackSound()
    }
  }, [soundEnabled, volume])

  const playFallbackSound = useCallback(() => {
    if (fallbackAudioRef.current) {
      try {
        fallbackAudioRef.current.play()
      } catch (error) {
        console.log("Fallback audio also failed:", error)
      }
    }
  }, [])

  // Update browser tab title with notification count
  const updateTabTitle = useCallback((count: number) => {
    const baseTitle = "🍳 KBL Bites Kitchen"
    if (count > 0) {
      document.title = `(${count}) ${baseTitle} - New Orders!`
    } else {
      document.title = baseTitle
    }
  }, [])

  // Trigger new order notification
  const triggerNewOrderNotification = useCallback(
    (orderCount = 1) => {
      console.log("🔔 Triggering new order notification")

      setNotifications((prev) => {
        const newCount = prev.newOrders + orderCount
        // Only update if count actually changed
        if (prev.newOrders === newCount) {
          return prev
        }
        updateTabTitle(newCount)
        return {
          ...prev,
          newOrders: newCount,
          lastOrderCheck: new Date().toISOString(),
        }
      })

      // Play sound and show notification
      playNotificationSound()
      showBrowserNotification(
        "🍳 New Order Alert!",
        `${orderCount} new order${orderCount > 1 ? "s" : ""} received - Check the kitchen!`,
        "/logo.png",
      )

      // Trigger callback
      onNewOrder?.()
    },
    [playNotificationSound, showBrowserNotification, updateTabTitle, onNewOrder],
  )

  // Trigger new message notification
  const triggerNewMessageNotification = useCallback(
    (messageCount = 1) => {
      console.log("💬 Triggering new message notification")

      setNotifications((prev) => {
        const newCount = prev.newMessages + messageCount
        // Only update if count actually changed
        if (prev.newMessages === newCount) {
          return prev
        }
        return {
          ...prev,
          newMessages: newCount,
          lastMessageCheck: new Date().toISOString(),
        }
      })

      // Play sound and show notification
      playNotificationSound()
      showBrowserNotification(
        "💬 New Message Alert!",
        `${messageCount} new message${messageCount > 1 ? "s" : ""} received`,
        "/logo.png",
      )

      // Trigger callback
      onNewMessage?.()
    },
    [playNotificationSound, showBrowserNotification, onNewMessage],
  )

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => ({
      ...prev,
      newOrders: 0,
      newMessages: 0,
    }))
    updateTabTitle(0)
  }, [updateTabTitle])

  const markOrdersAsRead = useCallback(() => {
    setNotifications((prev) => ({
      ...prev,
      newOrders: 0,
    }))
    updateTabTitle(0)
  }, [updateTabTitle])

  const markMessagesAsRead = useCallback(() => {
    setNotifications((prev) => ({
      ...prev,
      newMessages: 0,
    }))
  }, [])

  return {
    notifications,
    hasPermission,
    soundEnabled,
    setSoundEnabled,
    volume,
    setVolume,
    markAllAsRead,
    markOrdersAsRead,
    markMessagesAsRead,
    playNotificationSound,
    triggerNewOrderNotification,
    triggerNewMessageNotification,
    requestNotificationPermission,
  }
}
