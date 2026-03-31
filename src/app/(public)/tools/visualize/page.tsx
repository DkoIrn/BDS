import type { Metadata } from "next"
import { MapVisualizer } from "./map-visualizer"

export const metadata: Metadata = {
  title: "Map Visualizer | DataFlow",
  description: "Plot spatial survey data on interactive maps",
}

export default function VisualizePage() {
  return <MapVisualizer />
}
