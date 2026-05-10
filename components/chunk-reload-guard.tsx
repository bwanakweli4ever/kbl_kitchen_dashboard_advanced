"use client"

import { useEffect } from "react"

const CHUNK_RELOAD_KEY = "kbl:chunk-reload-at"
const RELOAD_COOLDOWN_MS = 30_000

function isChunkLoadFailure(value: unknown): boolean {
  const message = String(value || "").toLowerCase()
  return (
    message.includes("chunkloaderror") ||
    message.includes("loading chunk") ||
    message.includes("css chunk") ||
    message.includes("_next/static/chunks") ||
    message.includes("timeout")
  )
}

function reloadOnceForChunkFailure() {
  try {
    const now = Date.now()
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || "0")
    if (now - last < RELOAD_COOLDOWN_MS) return
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now))
    window.location.reload()
  } catch {
    window.location.reload()
  }
}

export function ChunkReloadGuard() {
  useEffect(() => {
    const onError = (event: Event | ErrorEvent) => {
      const target = (event as Event).target as Element | null
      const source = target?.getAttribute("src") || target?.getAttribute("href") || ""

      if (source.includes("/_next/static/")) {
        reloadOnceForChunkFailure()
        return
      }

      const errorEvent = event as ErrorEvent
      if (isChunkLoadFailure(errorEvent?.message || "")) {
        reloadOnceForChunkFailure()
      }
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const reasonText =
        (reason && (reason.message || reason.name || reason.toString?.())) || String(reason || "")

      if (isChunkLoadFailure(reasonText)) {
        reloadOnceForChunkFailure()
      }
    }

    window.addEventListener("error", onError, true)
    window.addEventListener("unhandledrejection", onUnhandledRejection)

    return () => {
      window.removeEventListener("error", onError, true)
      window.removeEventListener("unhandledrejection", onUnhandledRejection)
    }
  }, [])

  return null
}
