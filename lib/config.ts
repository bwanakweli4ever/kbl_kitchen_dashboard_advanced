// Centralized configuration for the application
export const config = {
  // API Configuration
  api: {
    // Use localhost:8000 for development
  //baseUrl: "http://localhost:8001",
     //For production, use: b
  baseUrl: process.env.WHATSAPP_API_URL || "https://backend.kblbites.com",
    timeout: 15000, // 15 seconds
    retryAttempts: 3,
  },
  
  // Authentication
  auth: {
    tokenKey: "kitchen_token",
    tokenExpiryKey: "kitchen_token_expiry",
    refreshThreshold: 5 * 60 * 1000, // 5 minutes before expiry
  },
  
  // Dashboard Settings
  dashboard: {
    pollInterval: 60000, // 1 minute - balanced for responsiveness and server load
    maxOrders: 50,
    autoRefresh: true,
  },
  
  // Notification Settings
  notifications: {
    soundEnabled: true,
    defaultVolume: 70,
    autoDismiss: 5000, // 5 seconds
  },
} as const

// Helper function to get full API URL
export function getApiUrl(endpoint: string): string {
  const baseUrl = config.api.baseUrl.replace(/\/$/, '') // Remove trailing slash
  const cleanEndpoint = endpoint.replace(/^\//, '') // Remove leading slash
  return `${baseUrl}/${cleanEndpoint}`
}

// Helper function to check if token is expired
export function isTokenExpired(): boolean {
  if (typeof window === 'undefined') return false
  
  const expiry = localStorage.getItem(config.auth.tokenExpiryKey)
  if (!expiry) return true
  
  return Date.now() > parseInt(expiry)
}

// Helper function to get stored token
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  
  if (isTokenExpired()) {
    // Clear expired token
    localStorage.removeItem(config.auth.tokenKey)
    localStorage.removeItem(config.auth.tokenExpiryKey)
    return null
  }
  
  return localStorage.getItem(config.auth.tokenKey)
}

// Helper function to store token with expiry
export function storeToken(token: string, expiresIn: number = 86400): void {
  if (typeof window === 'undefined') return
  
  const expiry = Date.now() + (expiresIn * 1000)
  localStorage.setItem(config.auth.tokenKey, token)
  localStorage.setItem(config.auth.tokenExpiryKey, expiry.toString())
}


