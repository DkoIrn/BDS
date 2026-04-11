"use client"

import { CircleMarker, Polyline, Tooltip } from "react-leaflet"
import type { ComparisonResult } from "./lib/types"

interface ComparisonLayerProps {
  result: ComparisonResult
}

function deviationColor(meters: number): string {
  if (meters < 1) return "#22c55e"
  if (meters <= 5) return "#f59e0b"
  return "#ef4444"
}

export function ComparisonLayer({ result }: ComparisonLayerProps) {
  return (
    <>
      {/* Dataset A matched points (blue) */}
      {result.pairs.map((pair, idx) => (
        <CircleMarker
          key={`a-${idx}`}
          center={[pair.pointA.lat, pair.pointA.lng]}
          radius={6}
          pathOptions={{
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.7,
            weight: 2,
          }}
        />
      ))}

      {/* Dataset B matched points (orange) */}
      {result.pairs.map((pair, idx) => (
        <CircleMarker
          key={`b-${idx}`}
          center={[pair.pointB.lat, pair.pointB.lng]}
          radius={6}
          pathOptions={{
            color: "#f97316",
            fillColor: "#f97316",
            fillOpacity: 0.7,
            weight: 2,
          }}
        />
      ))}

      {/* Deviation lines between matched pairs */}
      {result.pairs.map((pair, idx) => (
        <Polyline
          key={`line-${idx}`}
          positions={[
            [pair.pointA.lat, pair.pointA.lng],
            [pair.pointB.lat, pair.pointB.lng],
          ]}
          pathOptions={{
            color: deviationColor(pair.deviationMeters),
            weight: 2,
            opacity: 0.8,
          }}
        >
          <Tooltip sticky>
            {pair.deviationMeters.toFixed(1)}m deviation
          </Tooltip>
        </Polyline>
      ))}

      {/* Unmatched A points (blue, dashed) */}
      {result.unmatchedA.map((pt, idx) => (
        <CircleMarker
          key={`ua-${idx}`}
          center={[pt.lat, pt.lng]}
          radius={6}
          pathOptions={{
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.4,
            weight: 2,
            dashArray: "4 4",
          }}
        />
      ))}

      {/* Unmatched B points (orange, dashed) */}
      {result.unmatchedB.map((pt, idx) => (
        <CircleMarker
          key={`ub-${idx}`}
          center={[pt.lat, pt.lng]}
          radius={6}
          pathOptions={{
            color: "#f97316",
            fillColor: "#f97316",
            fillOpacity: 0.4,
            weight: 2,
            dashArray: "4 4",
          }}
        />
      ))}
    </>
  )
}
