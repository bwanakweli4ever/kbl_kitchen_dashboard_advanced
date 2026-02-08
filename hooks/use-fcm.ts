"use client";

import { useState, useEffect, useCallback } from "react";
import { getFcmTokenAndRegister } from "@/lib/firebase";
import { getApiUrl } from "@/lib/config";

/**
 * Register FCM token with backend for kitchen web push.
 * Call once when dashboard is active (e.g. in layout or main page).
 */
export function useFcm() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(async () => {
    try {
      const fcmToken = await getFcmTokenAndRegister();
      if (!fcmToken) {
        setError("FCM not supported or permission denied");
        return;
      }
      setToken(fcmToken);
      setError(null);
      await fetch(getApiUrl("api/device-tokens"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fcm_token: fcmToken,
          device_type: "web",
        }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "FCM registration failed");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "denied") return;
    register();
  }, [register]);

  return { token, error, register };
}
