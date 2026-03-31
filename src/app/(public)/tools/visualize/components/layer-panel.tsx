"use client"

import { useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Layers,
  X,
} from "lucide-react"
import type { MapLayer, TileLayerKey } from "../lib/types"
import { TILE_LAYERS } from "../lib/types"

interface LayerPanelProps {
  layers: MapLayer[]
  activeLayerId: string | null
  baseMap: TileLayerKey
  onToggleVisibility: (layerId: string) => void
  onColorChange: (layerId: string, color: string) => void
  onRemoveLayer: (layerId: string) => void
  onSelectLayer: (layerId: string) => void
  onBaseMapChange: (key: TileLayerKey) => void
}

const BASE_MAP_KEYS = Object.keys(TILE_LAYERS) as TileLayerKey[]

export function LayerPanel({
  layers,
  activeLayerId,
  baseMap,
  onToggleVisibility,
  onColorChange,
  onRemoveLayer,
  onSelectLayer,
  onBaseMapChange,
}: LayerPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div>
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-gray-700"
      >
        <span className="flex items-center gap-1.5">
          <Layers className="size-3.5" />
          Layers
          {layers.length > 0 && (
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              {layers.length}
            </span>
          )}
        </span>
        {collapsed ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronUp className="size-3.5" />
        )}
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="border-t">
          {/* Layer list */}
          {layers.length === 0 ? (
            <p className="px-3 py-4 text-center text-[10px] text-gray-400">
              Upload files to add layers
            </p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  onClick={() => onSelectLayer(layer.id)}
                  className={`flex cursor-pointer items-center gap-2 border-b px-3 py-2 transition-colors last:border-b-0 ${
                    activeLayerId === layer.id
                      ? "bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {/* Color swatch */}
                  <label className="relative shrink-0 cursor-pointer">
                    <span
                      className="block size-4 rounded"
                      style={{ backgroundColor: layer.color }}
                    />
                    <input
                      type="color"
                      value={layer.color}
                      onChange={(e) =>
                        onColorChange(layer.id, e.target.value)
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="absolute inset-0 size-4 cursor-pointer opacity-0"
                    />
                  </label>

                  {/* Filename & feature count */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-gray-700">
                      {layer.filename}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {layer.featureCount} feature
                      {layer.featureCount !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Visibility toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleVisibility(layer.id)
                    }}
                    className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title={layer.visible ? "Hide layer" : "Show layer"}
                  >
                    {layer.visible ? (
                      <Eye className="size-3.5" />
                    ) : (
                      <EyeOff className="size-3.5" />
                    )}
                  </button>

                  {/* Remove */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveLayer(layer.id)
                    }}
                    className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    title="Remove layer"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Base map selector */}
          <div className="border-t px-3 py-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Base Map
            </p>
            <div className="flex gap-1">
              {BASE_MAP_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => onBaseMapChange(key)}
                  className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                    baseMap === key
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {TILE_LAYERS[key].name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
