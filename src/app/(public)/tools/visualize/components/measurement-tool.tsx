"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useMap, useMapEvents, Polyline, CircleMarker } from "react-leaflet"
import type { LatLng } from "leaflet"

interface MeasurementToolProps {
  active: boolean
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters).toLocaleString()} m`
  }
  return `${(meters / 1000).toFixed(2)} km`
}

function MeasurementEvents({
  onPointAdded,
  onFinish,
}: {
  onPointAdded: (latlng: LatLng) => void
  onFinish: () => void
}) {
  useMapEvents({
    click(e) {
      onPointAdded(e.latlng)
    },
    dblclick() {
      onFinish()
    },
  })

  // Listen for Escape key to finish
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onFinish()
      }
    }
    container.addEventListener("keydown", handleKeyDown)
    return () => container.removeEventListener("keydown", handleKeyDown)
  }, [map, onFinish])

  return null
}

export function MeasurementTool({ active }: MeasurementToolProps) {
  const map = useMap()
  const [points, setPoints] = useState<LatLng[]>([])
  const prevActive = useRef(active)

  // Cursor management
  useEffect(() => {
    const container = map.getContainer()
    if (active) {
      container.style.cursor = "crosshair"
    } else {
      container.style.cursor = ""
    }
    return () => {
      container.style.cursor = ""
    }
  }, [active, map])

  // Clear on deactivate
  useEffect(() => {
    if (prevActive.current && !active) {
      setPoints([])
    }
    prevActive.current = active
  }, [active])

  const handlePointAdded = useCallback((latlng: LatLng) => {
    setPoints((prev) => [...prev, latlng])
  }, [])

  const handleFinish = useCallback(() => {
    setPoints([])
  }, [])

  const handleClear = useCallback(() => {
    setPoints([])
  }, [])

  if (!active) return null

  // Calculate total distance
  let totalDistance = 0
  for (let i = 1; i < points.length; i++) {
    totalDistance += points[i].distanceTo(points[i - 1])
  }

  const positions = points.map((p) => [p.lat, p.lng] as [number, number])

  return (
    <>
      <MeasurementEvents
        onPointAdded={handlePointAdded}
        onFinish={handleFinish}
      />

      {/* Dashed polyline between points */}
      {points.length >= 2 && (
        <Polyline
          positions={positions}
          pathOptions={{
            color: "#ef4444",
            weight: 2,
            dashArray: "8 4",
          }}
        />
      )}

      {/* Circle markers at each point */}
      {points.map((point, i) => (
        <CircleMarker
          key={`measure-${i}`}
          center={[point.lat, point.lng]}
          radius={4}
          pathOptions={{
            color: "#ef4444",
            fillColor: "#ffffff",
            fillOpacity: 1,
            weight: 2,
          }}
        />
      ))}

      {/* Distance label near last point */}
      {points.length >= 2 && (
        <div
          className="leaflet-top leaflet-right"
          style={{ pointerEvents: "auto", marginTop: "80px", marginRight: "12px" }}
        >
          <div
            className="leaflet-control"
            style={{
              background: "rgba(255,255,255,0.95)",
              padding: "6px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ color: "#ef4444" }}>
              {formatDistance(totalDistance)}
            </div>
            <div style={{ fontSize: "10px", color: "#888", marginTop: "2px" }}>
              {points.length} points
            </div>
          </div>
        </div>
      )}

      {/* Clear button */}
      {points.length > 0 && (
        <div
          className="leaflet-top leaflet-right"
          style={{ pointerEvents: "auto", marginTop: points.length >= 2 ? "140px" : "80px", marginRight: "12px" }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleClear()
            }}
            className="leaflet-control"
            style={{
              background: "white",
              border: "none",
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              cursor: "pointer",
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
              color: "#666",
            }}
          >
            Clear
          </button>
        </div>
      )}
    </>
  )
}
