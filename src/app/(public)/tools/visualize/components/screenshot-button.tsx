"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useMap } from "react-leaflet"
import { Camera, Loader2 } from "lucide-react"
import type { SimpleMapScreenshoter } from "leaflet-simple-map-screenshoter"

export function ScreenshotButton() {
  const map = useMap()
  const screenshoterRef = useRef<SimpleMapScreenshoter | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    async function initScreenshoter() {
      try {
        const { SimpleMapScreenshoter } = await import(
          "leaflet-simple-map-screenshoter"
        )
        if (!mounted) return
        const instance = new SimpleMapScreenshoter({ hidden: true }).addTo(map)
        screenshoterRef.current = instance
      } catch {
        // Plugin may fail in some environments
        console.warn("Screenshot plugin failed to initialize")
      }
    }

    initScreenshoter()

    return () => {
      mounted = false
      if (screenshoterRef.current) {
        try {
          screenshoterRef.current.remove()
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }, [map])

  const handleScreenshot = useCallback(async () => {
    if (!screenshoterRef.current || loading) return

    setLoading(true)
    try {
      const blob = await screenshoterRef.current.takeScreen("blob")
      const url = URL.createObjectURL(blob as Blob)
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const a = document.createElement("a")
      a.href = url
      a.download = `map-screenshot-${timestamp}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Screenshot failed:", err)
    } finally {
      setLoading(false)
    }
  }, [loading])

  return (
    <div
      className="leaflet-top leaflet-right"
      style={{ pointerEvents: "auto", marginTop: "46px", marginRight: "12px" }}
    >
      <button
        onClick={handleScreenshot}
        disabled={loading}
        className="leaflet-control flex size-[30px] items-center justify-center rounded-md bg-white shadow-md hover:bg-gray-50 disabled:opacity-50"
        title="Capture map screenshot"
        style={{ border: "none", cursor: loading ? "wait" : "pointer" }}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin text-gray-600" />
        ) : (
          <Camera className="size-4 text-gray-700" />
        )}
      </button>
    </div>
  )
}
