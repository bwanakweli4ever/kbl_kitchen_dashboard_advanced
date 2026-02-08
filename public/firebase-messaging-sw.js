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
    if (!firebaseConfig?.projectId) return;
    self.firebase.initializeApp(firebaseConfig);
    const messaging = self.firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title ?? payload.data?.title ?? "New order";
      const options = {
        body: payload.notification?.body ?? payload.data?.body ?? "Check the kitchen",
        icon: "/logo.png",
        badge: "/logo.png",
        tag: "kitchen-push",
        requireInteraction: true,
        data: payload.data ?? {},
      };
      return self.registration.showNotification(title, options);
    });
  })
  .catch((e) => console.error("FCM sw config failed", e));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.focus) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
