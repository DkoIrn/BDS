"use client"

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react"
import { useMap } from "react-leaflet"
import type { SimpleMapScreenshoter } from "leaflet-simple-map-screenshoter"

export interface ScreenshotHandle {
  takeScreenshot: () => Promise<void>
  loading: boolean
}

export const ScreenshotButton = forwardRef<ScreenshotHandle>(
  function ScreenshotButton(_, ref) {
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

    useImperativeHandle(ref, () => ({
      takeScreenshot: handleScreenshot,
      loading,
    }), [handleScreenshot, loading])

    return null
  }
)
