/**
 * Firebase Web SDK for FCM (kitchen dashboard push).
 * Uses NEXT_PUBLIC_ env vars so config is available in browser and in service worker fetch.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (getApps().length > 0) return getApp();
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return null;
  return initializeApp(firebaseConfig);
}

let messagingInstance: Messaging | null = null;

export function getMessagingInstance(): Messaging | null {
  if (typeof window === "undefined") return null;
  const app = getFirebaseApp();
  if (!app) return null;
  if (!messagingInstance) messagingInstance = getMessaging(app);
  return messagingInstance;
}

/** VAPID key from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates */
export function getVapidKey(): string | null {
  return process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? null;
}

/**
 * Request notification permission and get FCM token for web.
 * Call in client component (e.g. useEffect). Registers with backend.
 */
export async function getFcmTokenAndRegister(): Promise<string | null> {
  const supported = await isSupported();
  if (!supported) return null;
  const messaging = getMessagingInstance();
  const vapidKey = getVapidKey();
  if (!messaging || !vapidKey) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  const token = await getToken(messaging, { vapidKey });
  return token;
}
