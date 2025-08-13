"use client"

import { useState } from "react"
import { Bell, Settings, Volume2, VolumeX, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useNotifications } from "../hooks/use-notifications"

interface NotificationCenterProps {
  newOrders: number
  newMessages: number
  onMarkAllRead: () => void
}

export function NotificationCenter({ newOrders, newMessages, onMarkAllRead }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { soundEnabled, setSoundEnabled, volume, setVolume, playNotificationSound } = useNotifications({ token: null, isActive: false })

  const totalNotifications = newOrders + newMessages

  const toggleSettings = () => {
    setShowSettings(!showSettings)
  }

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0])
  }

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled)
  }

  const testSound = () => {
    playNotificationSound()
  }

  return (
    <div className="relative">
      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-10 w-10 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white/90 shadow-lg"
      >
        <Bell className="h-5 w-5 text-gray-700" />
        {totalNotifications > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center p-0">
            {totalNotifications > 99 ? "99+" : totalNotifications}
          </Badge>
        )}
      </Button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSettings}
                  className="h-8 w-8 p-0"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Sound Settings</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Sound Notifications</span>
                  <Switch checked={soundEnabled} onCheckedChange={toggleSound} />
                </div>
                
                {soundEnabled && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <VolumeX className="h-4 w-4 text-gray-500" />
                      <Slider
                        value={[volume]}
                        onValueChange={handleVolumeChange}
                        max={100}
                        step={5}
                        className="flex-1"
                      />
                      <Volume2 className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="text-xs text-gray-500 text-center">{volume}%</div>
                    
                    {/* Test Sound Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testSound}
                      className="w-full text-xs"
                    >
                      Test Sound
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-64 overflow-y-auto">
            {totalNotifications === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No new notifications</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {newOrders > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">
                        {newOrders} new order{newOrders > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-blue-700">Check the orders tab</p>
                    </div>
                  </div>
                )}

                {newMessages > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900">
                        {newMessages} new message{newMessages > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-green-700">Check the messages tab</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {totalNotifications > 0 && (
            <div className="p-4 border-t border-gray-200">
              <Button
                onClick={onMarkAllRead}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white"
              >
                Mark All as Read
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
