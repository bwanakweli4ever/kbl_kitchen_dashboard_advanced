/**
 * Firebase Cloud Messaging service worker for background push (kitchen dashboard).
 * Fetches config from /api/config/firebase and shows notification on push.
 */
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());

fetch("/api/config/firebase")
  .then((r) => r.json())
  .then(({ firebaseConfig }) => {
    if (!firebaseConfig?.projectId) {
      console.warn("FCM: Missing firebaseConfig.projectId");
      return;
    }
    try {
      self.firebase.initializeApp(firebaseConfig);
      const messaging = self.firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        try {
          if (!payload) {
            console.warn("FCM: Received null or undefined payload");
            return Promise.resolve();
          }
          
          const title = payload.notification?.title ?? payload.data?.title ?? "New order";
          const body = payload.notification?.body ?? payload.data?.body ?? "Check the kitchen";
          
          const options = {
            body,
            icon: "/logo.png",
            badge: "/logo.png",
            tag: "kitchen-push",
            requireInteraction: true,
            data: payload.data ?? {},
          };
          return self.registration.showNotification(title, options);
        } catch (error) {
          console.error("FCM: Failed to show notification:", error);
          return Promise.resolve();
        }
      });
    } catch (error) {
      console.error("FCM: Failed to initialize Firebase:", error);
    }
  })
  .catch((e) => console.error("FCM config request failed:", e));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.host) && client.focus) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
