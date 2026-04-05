"use client"

import { useCallback, useMemo, useState } from "react"
import { X, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react"
import type { MapLayer } from "../lib/types"

interface DataTablePanelProps {
  layer: MapLayer | null
  onZoomToFeature: (featureIndex: number) => void
  onClose: () => void
}

type SortDir = "asc" | "desc" | null

export function DataTablePanel({
  layer,
  onZoomToFeature,
  onClose,
}: DataTablePanelProps) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [filter, setFilter] = useState("")

  const handleRowClick = useCallback(
    (index: number) => {
      onZoomToFeature(index)
    },
    [onZoomToFeature]
  )

  const handleSort = useCallback((col: string) => {
    setSortCol((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"))
        return col
      }
      setSortDir("asc")
      return col
    })
  }, [])

  const columns = useMemo(() => {
    if (!layer || layer.geojson.features.length === 0) return []
    const first = layer.geojson.features[0]
    return first.properties ? Object.keys(first.properties) : []
  }, [layer])

  // Build sorted + filtered feature index mapping
  const sortedIndices = useMemo(() => {
    if (!layer) return []
    const features = layer.geojson.features
    let indices = features.map((_, i) => i)

    // Filter
    if (filter.trim()) {
      const q = filter.toLowerCase()
      indices = indices.filter((i) => {
        const props = features[i].properties
        if (!props) return false
        return Object.values(props).some((v) =>
          String(v ?? "").toLowerCase().includes(q)
        )
      })
    }

    // Sort
    if (sortCol && sortDir) {
      indices.sort((a, b) => {
        const va = features[a].properties?.[sortCol] ?? ""
        const vb = features[b].properties?.[sortCol] ?? ""
        const na = parseFloat(String(va))
        const nb = parseFloat(String(vb))

        // Numeric sort if both are numbers
        if (!isNaN(na) && !isNaN(nb)) {
          return sortDir === "asc" ? na - nb : nb - na
        }
        // String sort
        const cmp = String(va).localeCompare(String(vb))
        return sortDir === "asc" ? cmp : -cmp
      })
    }

    return indices
  }, [layer, sortCol, sortDir, filter])

  const handleExportCSV = useCallback(() => {
    if (!layer || columns.length === 0) return
    const features = layer.geojson.features
    const header = columns.join(",")
    const rows = sortedIndices.map((i) => {
      const props = features[i].properties || {}
      return columns.map((c) => {
        const val = String(props[c] ?? "")
        return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
      }).join(",")
    })
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${layer.filename.replace(/\.[^.]+$/, "")}-attributes.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [layer, columns, sortedIndices])

  if (!layer) {
    return (
      <div className="absolute bottom-0 left-16 right-16 z-[1000] rounded-t-lg border border-b-0 border-gray-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
          <span className="text-sm text-gray-500">
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
          <span className="text-xs text-gray-500">
            ({sortedIndices.length}{filter ? ` of ${features.length}` : ""} features)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Search filter */}
          <input
            type="text"
            placeholder="Filter..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-6 w-36 rounded border border-gray-200 bg-gray-50 px-2 text-[11px] outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
          />
          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-100"
            title="Export as CSV"
          >
            <Download className="size-3" />
            CSV
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100"
            title="Close data table"
          >
            <X className="size-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[250px] overflow-auto">
        {columns.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-500">
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
                    onClick={() => handleSort(col)}
                    className="cursor-pointer select-none px-3 py-1.5 text-left font-semibold text-gray-600 hover:text-blue-600"
                  >
                    <span className="flex items-center gap-1">
                      {col}
                      {sortCol === col && sortDir === "asc" ? (
                        <ArrowUp className="size-3 text-blue-500" />
                      ) : sortCol === col && sortDir === "desc" ? (
                        <ArrowDown className="size-3 text-blue-500" />
                      ) : (
                        <ArrowUpDown className="size-3 text-gray-300" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedIndices.map((featureIdx, displayIdx) => {
                const feature = features[featureIdx]
                return (
                  <tr
                    key={feature.id ?? featureIdx}
                    onClick={() => handleRowClick(featureIdx)}
                    className="cursor-pointer border-t border-gray-50 hover:bg-blue-50"
                  >
                    <td className="px-3 py-1 text-gray-400">{displayIdx + 1}</td>
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
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
