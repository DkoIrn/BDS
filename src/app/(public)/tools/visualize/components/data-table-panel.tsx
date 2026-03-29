"use client"

import { useCallback } from "react"
import { X } from "lucide-react"
import type { MapLayer } from "../lib/types"

interface DataTablePanelProps {
  layer: MapLayer | null
  onZoomToFeature: (featureIndex: number) => void
  onClose: () => void
}

export function DataTablePanel({
  layer,
  onZoomToFeature,
  onClose,
}: DataTablePanelProps) {
  const handleRowClick = useCallback(
    (index: number) => {
      onZoomToFeature(index)
    },
    [onZoomToFeature]
  )

  if (!layer) {
    return (
      <div className="absolute bottom-0 left-16 right-16 z-[1000] rounded-t-lg border border-b-0 border-gray-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
          <span className="text-sm text-muted-foreground">
            Select a layer to view its data
          </span>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100"
            title="Close data table"
          >
            <X className="size-3.5 text-gray-500" />
          </button>
        </div>
      </div>
    )
  }

  const features = layer.geojson.features
  // Auto-detect columns from first feature properties
  const columns =
    features.length > 0 && features[0].properties
      ? Object.keys(features[0].properties)
      : []

  return (
    <div className="absolute bottom-0 left-16 right-16 z-[1000] rounded-t-lg border border-b-0 border-gray-200 bg-white shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <div className="flex items-center gap-2">
          <div
            className="size-3 rounded-full"
            style={{ backgroundColor: layer.color }}
          />
          <span className="text-sm font-medium">{layer.filename}</span>
          <span className="text-xs text-muted-foreground">
            ({layer.featureCount} features)
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 hover:bg-gray-100"
          title="Close data table"
        >
          <X className="size-3.5 text-gray-500" />
        </button>
      </div>

      {/* Table */}
      <div className="max-h-[250px] overflow-auto">
        {columns.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            No attribute data available
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="sticky top-0 bg-gray-50">
                <th className="px-3 py-1.5 text-left font-semibold text-gray-600">
                  #
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-1.5 text-left font-semibold text-gray-600"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr
                  key={feature.id ?? index}
                  onClick={() => handleRowClick(index)}
                  className="cursor-pointer border-t border-gray-50 hover:bg-blue-50"
                >
                  <td className="px-3 py-1 text-gray-400">{index + 1}</td>
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="max-w-[200px] truncate px-3 py-1"
                    >
                      {feature.properties
                        ? String(feature.properties[col] ?? "")
                        : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
