"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMapEvents,
  useMap,
} from "react-leaflet"
import "leaflet/dist/leaflet.css"

import type { MapLayer, TileLayerKey } from "../lib/types"
import { TILE_LAYERS } from "../lib/types"

interface LeafletMapProps {
  layers: MapLayer[]
  baseMap: TileLayerKey
  activeLayerId: string | null
  fitBoundsKey: number
}

// Sub-component: Coordinate display on mouse move
function CoordinateDisplay() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    null
  )

  useMapEvents({
    mousemove(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
    mouseout() {
      setPosition(null)
    },
  })

  if (!position) return null

  return (
    <div className="leaflet-bottom leaflet-left" style={{ pointerEvents: "none" }}>
      <div
        className="leaflet-control"
        style={{
          background: "rgba(255,255,255,0.9)",
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "11px",
          fontFamily: "monospace",
          marginBottom: "12px",
          marginLeft: "12px",
          pointerEvents: "none",
        }}
      >
        Lat: {position.lat.toFixed(6)}, Lng: {position.lng.toFixed(6)}
      </div>
    </div>
  )
}

// Sub-component: Fit bounds when fitKey changes
function FitBounds({
  layers,
  fitKey,
}: {
  layers: MapLayer[]
  fitKey: number
}) {
  const map = useMap()
  const prevKey = useRef(fitKey)

  useEffect(() => {
    if (fitKey === prevKey.current && fitKey !== 0) return
    prevKey.current = fitKey

    const visibleLayers = layers.filter((l) => l.visible && l.geojson.features.length > 0)
    if (visibleLayers.length === 0) return

    const bounds = L.latLngBounds([])
    visibleLayers.forEach((layer) => {
      try {
        const geojsonLayer = L.geoJSON(layer.geojson)
        const layerBounds = geojsonLayer.getBounds()
        if (layerBounds.isValid()) {
          bounds.extend(layerBounds)
        }
      } catch {
        // Skip layers with invalid bounds
      }
    })

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [fitKey, layers, map])

  return null
}

// Feature tooltip/popup helpers
function getFeatureLabel(feature: GeoJSON.Feature): string {
  const props = feature.properties || {}
  return (
    props.name ||
    props.Name ||
    props.NAME ||
    props.description ||
    props.Description ||
    `Feature ${feature.id || ""}`
  )
}

function formatProperties(properties: Record<string, unknown>): string {
  const entries = Object.entries(properties).filter(
    ([, v]) => v != null && v !== ""
  )
  if (entries.length === 0) return "<em>No properties</em>"

  const rows = entries
    .map(
      ([k, v]) =>
        `<tr><td style="font-weight:600;padding:2px 8px 2px 0;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:2px 0">${String(v)}</td></tr>`
    )
    .join("")

  return `<div style="max-height:200px;overflow-y:auto"><table style="font-size:12px">${rows}</table></div>`
}

export default function LeafletMap({
  layers,
  baseMap,
  activeLayerId,
  fitBoundsKey,
}: LeafletMapProps) {
  const tileConfig = TILE_LAYERS[baseMap]

  return (
    <MapContainer
      center={[51.505, -0.09]}
      zoom={3}
      style={{ height: "100%", width: "100%" }}
      className="z-0"
    >
      <TileLayer
        key={baseMap}
        url={tileConfig.url}
        attribution={tileConfig.attribution}
      />

      {layers
        .filter((l) => l.visible)
        .map((layer) => (
          <GeoJSON
            key={layer.id + layer.color}
            data={layer.geojson}
            style={() => ({
              color: layer.color,
              weight: 2,
              fillColor: layer.color,
              fillOpacity: 0.3,
            })}
            pointToLayer={(_feature, latlng) =>
              L.circleMarker(latlng, {
                radius: 6,
                color: layer.color,
                fillColor: layer.color,
                fillOpacity: 0.7,
                weight: 2,
              })
            }
            onEachFeature={(feature, featureLayer) => {
              // Hover tooltip
              featureLayer.bindTooltip(getFeatureLabel(feature), {
                sticky: true,
                direction: "top",
                offset: [0, -10],
              })

              // Click popup with all attributes
              if (feature.properties) {
                featureLayer.bindPopup(
                  formatProperties(feature.properties as Record<string, unknown>),
                  { maxWidth: 300 }
                )
              }
            }}
          />
        ))}

      <CoordinateDisplay />
      <FitBounds layers={layers} fitKey={fitBoundsKey} />
    </MapContainer>
  )
}
