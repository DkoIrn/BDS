"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Crosshair, ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { MapLayer, TileLayerKey } from "./lib/types"
import { getLayerColor } from "./lib/layer-colors"
import { saveLayers, loadLayers } from "./lib/session-store"

const LeafletMap = dynamic(() => import("./components/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted/30">
      <p className="text-sm text-muted-foreground">Loading map...</p>
    </div>
  ),
})

export function MapVisualizer() {
  const [layers, setLayers] = useState<MapLayer[]>([])
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null)
  const [baseMap, setBaseMap] = useState<TileLayerKey>("osm")
  const [fitBoundsKey, setFitBoundsKey] = useState(0)
  const initialized = useRef(false)

  // Load layers from sessionStorage on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const stored = loadLayers()
    if (stored && stored.length > 0) {
      setLayers(stored)
      setActiveLayerId(stored[0].id)
      // Trigger fit bounds after loading
      setFitBoundsKey((k) => k + 1)
    }
  }, [])

  // Save layers to sessionStorage on change
  useEffect(() => {
    if (!initialized.current) return
    saveLayers(layers)
  }, [layers])

  const handleFileParsed = useCallback(
    (file: File, geojson: GeoJSON.FeatureCollection) => {
      const newLayer: MapLayer = {
        id: crypto.randomUUID(),
        filename: file.name,
        geojson,
        color: getLayerColor(layers.length),
        visible: true,
        featureCount: geojson.features.length,
      }
      setLayers((prev) => [...prev, newLayer])
      setActiveLayerId(newLayer.id)
      setFitBoundsKey((k) => k + 1)
    },
    [layers.length]
  )

  const handleToggleVisibility = useCallback((layerId: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
    )
  }, [])

  const handleColorChange = useCallback((layerId: string, color: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, color } : l))
    )
  }, [])

  const handleRemoveLayer = useCallback(
    (layerId: string) => {
      setLayers((prev) => prev.filter((l) => l.id !== layerId))
      if (activeLayerId === layerId) {
        setActiveLayerId(null)
      }
    },
    [activeLayerId]
  )

  const handleSelectLayer = useCallback((layerId: string) => {
    setActiveLayerId(layerId)
  }, [])

  const handleBaseMapChange = useCallback((key: TileLayerKey) => {
    setBaseMap(key)
  }, [])

  const handleZoomToFit = useCallback(() => {
    setFitBoundsKey((k) => k + 1)
  }, [])

  return (
    <div className="relative h-screen w-full">
      {/* Map fills entire viewport */}
      <LeafletMap
        layers={layers}
        baseMap={baseMap}
        activeLayerId={activeLayerId}
        fitBoundsKey={fitBoundsKey}
      />

      {/* Back navigation */}
      <Link
        href="/"
        className="absolute left-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium shadow-md hover:bg-gray-50"
      >
        <ArrowLeft className="size-3.5" />
        Home
      </Link>

      {/* Upload panel placeholder -- wired in Task 3 */}
      <div id="upload-panel-slot" className="absolute left-3 top-14 z-[1000]" />

      {/* Layer panel placeholder -- wired in Task 3 */}
      <div id="layer-panel-slot" className="absolute left-3 top-48 z-[1000]" />

      {/* Zoom to fit button */}
      <button
        onClick={handleZoomToFit}
        className="absolute right-3 top-3 z-[1000] flex size-9 items-center justify-center rounded-lg bg-white shadow-md hover:bg-gray-50"
        title="Zoom to fit all layers"
      >
        <Crosshair className="size-4 text-gray-700" />
      </button>

      {/* Export handler props for Task 3 wiring */}
      <input type="hidden" data-layers={layers.length} />
    </div>
  )
}

// Export handlers type for child components
export type MapVisualizerHandlers = {
  onFileParsed: (file: File, geojson: GeoJSON.FeatureCollection) => void
  onToggleVisibility: (layerId: string) => void
  onColorChange: (layerId: string, color: string) => void
  onRemoveLayer: (layerId: string) => void
  onSelectLayer: (layerId: string) => void
  onBaseMapChange: (key: TileLayerKey) => void
}
