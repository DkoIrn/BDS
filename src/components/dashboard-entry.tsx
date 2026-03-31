"use client"

import { useEffect, useState } from "react"

/**
 * Wraps dashboard content and plays entry animation
 * if the user just came from the splash screen.
 */
export function DashboardEntry({ children }: { children: React.ReactNode }) {
  const [animate, setAnimate] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const fromSplash = sessionStorage.getItem("df-splash")
    if (fromSplash) {
      sessionStorage.removeItem("df-splash")
      setAnimate(true)
    }
    setReady(true)
  }, [])

  if (!ready) {
    return <div className="opacity-0">{children}</div>
  }

  if (!animate) {
    return <>{children}</>
  }

  return <div className="dashboard-enter">{children}</div>
}
