"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Crosshair, ArrowLeft, Ruler, Table2, Camera, Loader2, Navigation } from "lucide-react"
import Link from "next/link"
import type { MapLayer, TileLayerKey } from "./lib/types"
import { getLayerColor } from "./lib/layer-colors"
import { saveLayers, loadLayers, saveViewState, loadViewState } from "./lib/session-store"
import { UploadPanel } from "./components/upload-panel"
import { LayerPanel } from "./components/layer-panel"
import { DataTablePanel } from "./components/data-table-panel"
import type { ScreenshotHandle } from "./components/screenshot-button"

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
  const [showDataTable, setShowDataTable] = useState(false)
  const [measurementActive, setMeasurementActive] = useState(false)
  const [zoomToFeatureIndex, setZoomToFeatureIndex] = useState<number | null>(null)
  const [initialCenter, setInitialCenter] = useState<[number, number] | undefined>(undefined)
  const [initialZoom, setInitialZoom] = useState<number | undefined>(undefined)
  const [screenshotLoading, setScreenshotLoading] = useState(false)
  const [showGoTo, setShowGoTo] = useState(false)
  const [goToLat, setGoToLat] = useState("")
  const [goToLng, setGoToLng] = useState("")
  const [goToCoord, setGoToCoord] = useState<[number, number] | null>(null)
  const screenshotRef = useRef<ScreenshotHandle | null>(null)
  const initialized = useRef(false)

  // Load layers and view state from sessionStorage on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const stored = loadLayers()
    if (stored && stored.length > 0) {
      // Ensure opacity exists on restored layers
      const withOpacity = stored.map((l) => ({ ...l, opacity: l.opacity ?? 1 }))
      setLayers(withOpacity)
      setActiveLayerId(withOpacity[0].id)
    }
    const view = loadViewState()
    if (view) {
      setBaseMap(view.baseMap)
      setInitialCenter(view.center)
      setInitialZoom(view.zoom)
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
        opacity: 1,
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

  const handleOpacityChange = useCallback((layerId: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
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

  const lastViewRef = useRef<{ center: [number, number]; zoom: number }>({
    center: [51.505, -0.09],
    zoom: 3,
  })

  const handleViewChange = useCallback(
    (center: [number, number], zoom: number) => {
      lastViewRef.current = { center, zoom }
      saveViewState({ center, zoom, baseMap })
    },
    [baseMap]
  )

  const handleBaseMapChange = useCallback((key: TileLayerKey) => {
    setBaseMap(key)
    const { center, zoom } = lastViewRef.current
    saveViewState({ center, zoom, baseMap: key })
  }, [])

  const handleZoomToFit = useCallback(() => {
    setFitBoundsKey((k) => k + 1)
  }, [])

  const handleZoomToFeature = useCallback((featureIndex: number) => {
    setZoomToFeatureIndex(featureIndex)
  }, [])

  const handleZoomToFeatureHandled = useCallback(() => {
    setZoomToFeatureIndex(null)
  }, [])

  const handleGoTo = useCallback(() => {
    const lat = parseFloat(goToLat)
    const lng = parseFloat(goToLng)
    if (!isNaN(lat) && !isNaN(lng)) {
      setGoToCoord([lat, lng])
      setShowGoTo(false)
      setGoToLat("")
      setGoToLng("")
    }
  }, [goToLat, goToLng])

  const handleGoToHandled = useCallback(() => {
    setGoToCoord(null)
  }, [])

  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? null

  return (
    <div className="relative h-screen w-full">
      <LeafletMap
        layers={layers}
        baseMap={baseMap}
        activeLayerId={activeLayerId}
        fitBoundsKey={fitBoundsKey}
        measurementActive={measurementActive}
        zoomToFeatureIndex={zoomToFeatureIndex}
        onZoomToFeatureHandled={handleZoomToFeatureHandled}
        screenshotRef={screenshotRef}
        onViewChange={handleViewChange}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        goToCoord={goToCoord}
        onGoToHandled={handleGoToHandled}
      />

      {/* Back navigation */}
      <Link
        href="/"
        className="absolute left-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium shadow-md hover:bg-gray-50"
      >
        <ArrowLeft className="size-3.5" />
        Home
      </Link>

      {/* Combined upload + layers panel */}
      <div className="absolute left-3 top-14 z-[1000] w-64 overflow-hidden rounded-lg bg-white shadow-lg">
        <UploadPanel onFileParsed={handleFileParsed} />
        <LayerPanel
          layers={layers}
          activeLayerId={activeLayerId}
          baseMap={baseMap}
          onToggleVisibility={handleToggleVisibility}
          onColorChange={handleColorChange}
          onOpacityChange={handleOpacityChange}
          onRemoveLayer={handleRemoveLayer}
          onSelectLayer={handleSelectLayer}
          onBaseMapChange={handleBaseMapChange}
        />
      </div>

      {/* Floating toolbar */}
      <div className="absolute right-3 top-[6.5rem] z-[1000] flex flex-col gap-1.5">
        <button
          onClick={handleZoomToFit}
          className="flex size-9 items-center justify-center rounded-lg bg-white shadow-md hover:bg-gray-50"
          title="Zoom to fit all layers"
        >
          <Crosshair className="size-4 text-gray-700" />
        </button>

        <button
          onClick={() => setMeasurementActive((v) => !v)}
          className={`flex size-9 items-center justify-center rounded-lg shadow-md ${
            measurementActive
              ? "bg-red-50 ring-2 ring-red-400"
              : "bg-white hover:bg-gray-50"
          }`}
          title={measurementActive ? "Disable measurement" : "Measure distance"}
        >
          <Ruler
            className={`size-4 ${measurementActive ? "text-red-600" : "text-gray-700"}`}
          />
        </button>

        <button
          onClick={() => setShowDataTable((v) => !v)}
          className={`flex size-9 items-center justify-center rounded-lg shadow-md ${
            showDataTable
              ? "bg-blue-50 ring-2 ring-blue-400"
              : "bg-white hover:bg-gray-50"
          }`}
          title={showDataTable ? "Hide data table" : "Show data table"}
        >
          <Table2
            className={`size-4 ${showDataTable ? "text-blue-600" : "text-gray-700"}`}
          />
        </button>

        {/* Go-to coordinates */}
        <button
          onClick={() => setShowGoTo((v) => !v)}
          className={`flex size-9 items-center justify-center rounded-lg shadow-md ${
            showGoTo
              ? "bg-green-50 ring-2 ring-green-400"
              : "bg-white hover:bg-gray-50"
          }`}
          title="Go to coordinates"
        >
          <Navigation
            className={`size-4 ${showGoTo ? "text-green-600" : "text-gray-700"}`}
          />
        </button>

        <button
          onClick={async () => {
            if (screenshotRef.current && !screenshotLoading) {
              setScreenshotLoading(true)
              await screenshotRef.current.takeScreenshot()
              setScreenshotLoading(false)
            }
          }}
          disabled={screenshotLoading}
          className="flex size-9 items-center justify-center rounded-lg bg-white shadow-md hover:bg-gray-50 disabled:opacity-50"
          title="Capture map screenshot"
        >
          {screenshotLoading ? (
            <Loader2 className="size-4 animate-spin text-gray-600" />
          ) : (
            <Camera className="size-4 text-gray-700" />
          )}
        </button>
      </div>

      {/* Go-to coordinates panel */}
      {showGoTo && (
        <div className="absolute right-14 top-[10rem] z-[1000] w-52 rounded-lg bg-white p-3 shadow-lg">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Go to Coordinates</p>
          <div className="space-y-1.5">
            <input
              type="number"
              step="any"
              placeholder="Latitude"
              value={goToLat}
              onChange={(e) => setGoToLat(e.target.value)}
              className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs outline-none focus:border-blue-300"
            />
            <input
              type="number"
              step="any"
              placeholder="Longitude"
              value={goToLng}
              onChange={(e) => setGoToLng(e.target.value)}
              className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs outline-none focus:border-blue-300"
            />
            <button
              onClick={handleGoTo}
              disabled={!goToLat || !goToLng}
              className="w-full rounded bg-blue-500 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              Go
            </button>
          </div>
        </div>
      )}

      {/* Data table panel */}
      {showDataTable && (
        <DataTablePanel
          layer={activeLayer}
          onZoomToFeature={handleZoomToFeature}
          onClose={() => setShowDataTable(false)}
        />
      )}
    </div>
  )
}
