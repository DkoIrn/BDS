import type { MapLayer } from "./types"

const STORAGE_KEY = "map-visualizer-layers"

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
