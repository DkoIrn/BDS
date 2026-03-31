import type { MapLayer, TileLayerKey } from "./types"

const STORAGE_KEY = "map-visualizer-layers"
const VIEW_KEY = "map-visualizer-view"

export interface MapViewState {
  center: [number, number]
  zoom: number
  baseMap: TileLayerKey
}

export function saveLayers(layers: MapLayer[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(layers))
  } catch {
    // QuotaExceededError or other storage errors -- silently fail
    console.warn("Failed to save layers to sessionStorage")
  }
}

export function loadLayers(): MapLayer[] | null {
  try {
    const data = sessionStorage.getItem(STORAGE_KEY)
    if (!data) return null
    return JSON.parse(data) as MapLayer[]
  } catch {
    return null
  }
}

export function clearLayers(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore errors
  }
}

export function saveViewState(view: MapViewState): void {
  try {
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(view))
  } catch {
    // Silently fail
  }
}

export function loadViewState(): MapViewState | null {
  try {
    const data = sessionStorage.getItem(VIEW_KEY)
    if (!data) return null
    return JSON.parse(data) as MapViewState
  } catch {
    return null
  }
}
