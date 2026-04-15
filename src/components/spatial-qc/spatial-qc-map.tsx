"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import L from "leaflet"
import { MapContainer, TileLayer, useMap } from "react-leaflet"
import { MapPin, Flame, GitCompareArrows, Satellite, Map as MapIcon } from "lucide-react"
import "leaflet/dist/leaflet.css"

import { IssueMarkersLayer } from "./issue-markers-layer"
import { HeatmapLayer } from "./heatmap-layer"
import { ComparisonLayer } from "./comparison-layer"
import type { SpatialIssue, ComparisonResult, ValidationSeverity } from "./lib/types"

interface SpatialQCMapProps {
  issues: SpatialIssue[]
  heatmapPoints: [number, number, number][]
  comparisonResult?: ComparisonResult
  activeSeverity?: ValidationSeverity | "all"
}

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const ESRI_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
const ESRI_ATTR =
  '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics'

/** Auto-fit map bounds to issue markers on data change */
function FitToIssues({ issues }: { issues: SpatialIssue[] }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    if (fitted.current || issues.length === 0) return
    fitted.current = true

    const bounds = L.latLngBounds(issues.map((si) => [si.lat, si.lng]))
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
    }
  }, [issues, map])

  return null
}

export function SpatialQCMap({
  issues,
  heatmapPoints,
  comparisonResult,
  activeSeverity = "all",
}: SpatialQCMapProps) {
  const [showIssues, setShowIssues] = useState(true)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [satellite, setSatellite] = useState(false)

  const tileUrl = satellite ? ESRI_URL : OSM_URL
  const tileAttr = satellite ? ESRI_ATTR : OSM_ATTR

  // Memoize filtered heatmap points when severity filter is applied
  const filteredIssues = useMemo(() => {
    if (activeSeverity === "all") return issues
    return issues.filter((si) => si.issue.severity === activeSeverity)
  }, [issues, activeSeverity])

  if (issues.length === 0) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-2xl border bg-muted/30">
        <div className="text-center">
          <MapPin className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No spatial data available
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-[500px] overflow-hidden rounded-2xl border">
      <MapContainer
        center={[51.505, -0.09]}
        zoom={3}
        minZoom={2}
        maxZoom={18}
        worldCopyJump
        preferCanvas
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer key={satellite ? "esri" : "osm"} url={tileUrl} attribution={tileAttr} />
        <FitToIssues issues={issues} />

        {showIssues && (
          <IssueMarkersLayer
            issues={filteredIssues}
            activeSeverity={activeSeverity}
          />
        )}

        <HeatmapLayer points={heatmapPoints} visible={showHeatmap} />

        {showCompare && comparisonResult && (
          <ComparisonLayer result={comparisonResult} />
        )}
      </MapContainer>

      {/* Toggle controls */}
      <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1.5">
        <ToggleButton
          active={showIssues}
          onClick={() => setShowIssues((v) => !v)}
          icon={<MapPin className="size-3.5" />}
          label="Issues"
        />
        <ToggleButton
          active={showHeatmap}
          onClick={() => setShowHeatmap((v) => !v)}
          icon={<Flame className="size-3.5" />}
          label="Heatmap"
        />
        {comparisonResult && (
          <ToggleButton
            active={showCompare}
            onClick={() => setShowCompare((v) => !v)}
            icon={<GitCompareArrows className="size-3.5" />}
            label="Compare"
          />
        )}
        <div className="my-0.5 border-t border-white/20" />
        <ToggleButton
          active={satellite}
          onClick={() => setSatellite((v) => !v)}
          icon={satellite ? <MapIcon className="size-3.5" /> : <Satellite className="size-3.5" />}
          label={satellite ? "Map" : "Satellite"}
        />
      </div>
    </div>
  )
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-md transition-colors cursor-pointer ${
        active
          ? "bg-foreground text-background"
          : "bg-white/90 text-gray-700 hover:bg-white dark:bg-gray-800/90 dark:text-gray-200 dark:hover:bg-gray-800"
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
