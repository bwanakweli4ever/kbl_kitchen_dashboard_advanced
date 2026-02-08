"use client";

import { useFcm } from "@/hooks/use-fcm";
import { useEffect } from "react";

/**
 * Registers FCM token with backend when dashboard loads.
 * Renders nothing; runs in background for web push (new order alerts).
 */
export function FcmProvider() {
  const { register } = useFcm();

  useEffect(() => {
    if (typeof window === "undefined") return;
    register();
  }, [register]);

  return null;
}
