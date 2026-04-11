"use client"

import { useEffect, useRef } from "react"
import { useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet.heat"

interface HeatmapLayerProps {
  points: Array<[number, number, number]>
  visible: boolean
}

export function HeatmapLayer({ points, visible }: HeatmapLayerProps) {
  const map = useMap()
  const layerRef = useRef<L.HeatLayer | null>(null)

  useEffect(() => {
    if (visible && points.length > 0) {
      const heat = L.heatLayer(points, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: {
          0.2: "#22c55e",
          0.5: "#f59e0b",
          0.8: "#ef4444",
          1.0: "#991b1b",
        },
      })
      heat.addTo(map)
      layerRef.current = heat
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [map, points, visible])

  return null
}
