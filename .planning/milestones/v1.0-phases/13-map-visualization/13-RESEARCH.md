# Phase 13: Map Visualization - Research

**Researched:** 2026-03-29
**Domain:** Interactive web mapping with Leaflet, client-side spatial file parsing
**Confidence:** HIGH

## Summary

This phase builds a standalone map visualization tool at `/tools/visualize` where users upload spatial files (GeoJSON, KML/KMZ, Shapefile ZIP) and see them plotted on an interactive Leaflet map. The architecture is entirely client-side -- no backend endpoint needed. Files are parsed in the browser using `@mapbox/togeojson` (KML), `shpjs` (Shapefile), and `JSZip` (KMZ extraction), then rendered as GeoJSON layers on a `react-leaflet` map.

The key technical challenge is integrating Leaflet with Next.js App Router (SSR incompatibility requires `next/dynamic` with `ssr: false`). Beyond that, the implementation is straightforward: Leaflet handles GeoJSON natively, and the three parsing libraries convert KML and Shapefile to GeoJSON client-side. Layer management, tooltips, popups, coordinate readout, and measurement are all well-supported Leaflet patterns.

**Primary recommendation:** Use react-leaflet v5 + Leaflet 1.9.4 with `next/dynamic` SSR bypass. Parse all formats to GeoJSON client-side (no backend needed). Use `leaflet-simple-map-screenshoter` for PNG export and a lightweight custom polyline for distance measurement.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Standalone upload tool -- no connection to projects/datasets
- No login required -- public tool, anyone can upload and visualize
- Accepted formats: GeoJSON, KML/KMZ, Shapefile (common spatial formats only -- not CSV/Excel/LandXML/DXF)
- Multi-file upload supported -- each file becomes a separate layer
- Session-based memory -- plotted data persists in browser session so users can reload without re-uploading
- No server persistence, no database records, no visualization history
- Multiple base map options with tile layer switcher: OpenStreetMap, satellite imagery (ESRI World Imagery), and topographic map
- Auto-fit bounds on data load -- zoom/pan to fit all uploaded features
- Zoom-to-fit button to re-center after user pans away
- Persistent cursor coordinate readout in corner of map (lat/lng as mouse moves)
- Hover tooltip showing brief info (name/label of feature)
- Click opens detailed popup with all attributes from the source file
- Each uploaded file becomes a toggleable layer with auto-assigned colors and color picker
- Layer panel shows filename + feature count
- Optional collapsible data table panel (hidden by default)
- Click a row in the table to zoom to that feature on the map
- Full-width map with floating panels (layer controls, upload zone, data table)
- Panels are collapsible to maximize map space
- PNG screenshot button to capture current map view as image
- Distance measurement tool -- click points to measure distance between them
- No shareable URLs for MVP
- No area measurement for MVP

### Claude's Discretion
- Map library choice (Leaflet with react-leaflet recommended given it's free and well-suited)
- Exact floating panel positions and collapse behavior
- Tooltip and popup styling
- Color palette for auto-assigned layer colors
- Session storage implementation details (sessionStorage vs in-memory)
- Screenshot implementation approach (html2canvas or leaflet plugin)
- Distance measurement UI (Leaflet.Draw or custom)
- How to handle very large files / feature counts (clustering, simplification)

### Deferred Ideas (OUT OF SCOPE)
- CSV/Excel support for map (would need coordinate column detection UI)
- LandXML/DXF map support (complex geometry types)
- Shareable map URLs with encoded state
- Data export from map view (GeoJSON/CSV of visible features)
- Area measurement tool
- Batch upload / drag multiple files at once
- Feature filtering by attribute values
- Heatmap or density visualization mode
- Integration with project datasets (plot QC results on map)

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| leaflet | 1.9.4 | Map rendering engine | Industry standard open-source mapping library |
| react-leaflet | 5.0.0 | React bindings for Leaflet | Official React wrapper, requires React 19 (which project uses) |
| @types/leaflet | 1.9.21 | TypeScript types for Leaflet | Microsoft-maintained type definitions |

### Supporting -- File Parsing (client-side)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @mapbox/togeojson | 0.16.2 | Convert KML to GeoJSON | KML file uploads |
| shpjs | 6.2.0 | Parse Shapefile ZIP to GeoJSON | Shapefile uploads |
| jszip | 3.10.1 | Extract KMZ archives | KMZ uploads (extract KML from ZIP) |

### Supporting -- Map Features
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| leaflet-simple-map-screenshoter | 0.5.0 | PNG export of map view | Screenshot button |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Leaflet | MapLibre GL JS | Vector tiles, WebGL -- overkill for file overlay use case |
| leaflet-simple-map-screenshoter | html2canvas | More control but known issues with Leaflet tiles (panning misses tiles, CORS) |
| leaflet-geoman (measurement) | Custom polyline | Geoman Pro required for measurement; custom polyline is simpler for distance-only |
| Server-side parsing | Client-side parsing | No backend needed = simpler architecture for a public/no-auth tool |

**Installation:**
```bash
npm install leaflet react-leaflet @types/leaflet @mapbox/togeojson shpjs jszip leaflet-simple-map-screenshoter
```

## Architecture Patterns

### Recommended Project Structure
```
src/app/(dashboard)/tools/visualize/
  page.tsx                    # Server component shell (like converter)
  map-visualizer.tsx          # "use client" -- main orchestrator component
  components/
    leaflet-map.tsx           # MapContainer + TileLayer + GeoJSON layers (dynamically imported)
    layer-panel.tsx           # Floating layer controls panel
    upload-panel.tsx          # Floating file upload dropzone
    data-table-panel.tsx      # Collapsible attribute table
    coordinate-display.tsx    # Cursor lat/lng readout
    measurement-tool.tsx      # Distance measurement control
    screenshot-button.tsx     # PNG export button
  lib/
    parse-spatial-file.ts     # Unified parser: file -> GeoJSON FeatureCollection
    layer-colors.ts           # Auto-assign distinct colors
    session-store.ts          # sessionStorage persistence for layers
    format-utils.ts           # Helpers (feature count, bounds, etc.)
```

### Pattern 1: Dynamic Import for Leaflet (SSR Bypass)
**What:** Leaflet accesses `window` and `document` on import, which breaks Next.js SSR. Must use `next/dynamic` with `ssr: false`.
**When to use:** Always -- every component that imports from `leaflet` or `react-leaflet`.
**Example:**
```typescript
// map-visualizer.tsx
"use client"
import dynamic from "next/dynamic"

const LeafletMap = dynamic(() => import("./components/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-muted">
      <p className="text-sm text-muted-foreground">Loading map...</p>
    </div>
  ),
})
```

### Pattern 2: Unified File-to-GeoJSON Parser
**What:** Single entry point that routes file to correct parser based on extension, always returns GeoJSON FeatureCollection.
**When to use:** On every file upload.
**Example:**
```typescript
// lib/parse-spatial-file.ts
import * as toGeoJSON from "@mapbox/togeojson"
import shp from "shpjs"
import JSZip from "jszip"

export async function parseSpatialFile(file: File): Promise<GeoJSON.FeatureCollection> {
  const ext = file.name.split(".").pop()?.toLowerCase()

  switch (ext) {
    case "geojson":
    case "json": {
      const text = await file.text()
      return JSON.parse(text) as GeoJSON.FeatureCollection
    }
    case "kml": {
      const text = await file.text()
      const dom = new DOMParser().parseFromString(text, "text/xml")
      return toGeoJSON.kml(dom) as GeoJSON.FeatureCollection
    }
    case "kmz": {
      const buffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(buffer)
      const kmlFile = Object.keys(zip.files).find(name => name.endsWith(".kml"))
      if (!kmlFile) throw new Error("No KML file found in KMZ archive")
      const kmlText = await zip.files[kmlFile].async("string")
      const dom = new DOMParser().parseFromString(kmlText, "text/xml")
      return toGeoJSON.kml(dom) as GeoJSON.FeatureCollection
    }
    case "zip": {
      const buffer = await file.arrayBuffer()
      const geojson = await shp(buffer)
      // shpjs returns FeatureCollection or array of them
      if (Array.isArray(geojson)) return geojson[0]
      return geojson as GeoJSON.FeatureCollection
    }
    default:
      throw new Error(`Unsupported format: .${ext}`)
  }
}
```

### Pattern 3: Leaflet CSS Import
**What:** Leaflet requires its CSS to render correctly. Must be imported explicitly.
**When to use:** In the dynamically-imported map component.
**Example:**
```typescript
// components/leaflet-map.tsx
import "leaflet/dist/leaflet.css"
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet"
```

### Pattern 4: Layer State Management
**What:** Each uploaded file becomes a layer with GeoJSON data, metadata, visibility toggle, and color. State lives in the parent orchestrator.
**When to use:** Core state pattern for the entire tool.
**Example:**
```typescript
interface MapLayer {
  id: string
  filename: string
  geojson: GeoJSON.FeatureCollection
  color: string
  visible: boolean
  featureCount: number
}

// In map-visualizer.tsx
const [layers, setLayers] = useState<MapLayer[]>([])
```

### Pattern 5: Session Persistence
**What:** Store serialized layer data in `sessionStorage` so page reloads preserve state.
**When to use:** After every layer add/remove/toggle. Restore on mount.
**Example:**
```typescript
// Serialize on change
useEffect(() => {
  try {
    sessionStorage.setItem("map-layers", JSON.stringify(layers))
  } catch {
    // sessionStorage full or unavailable -- silently fail
  }
}, [layers])

// Restore on mount
useEffect(() => {
  try {
    const stored = sessionStorage.getItem("map-layers")
    if (stored) setLayers(JSON.parse(stored))
  } catch {
    // Ignore parse errors
  }
}, [])
```

**Note:** `sessionStorage` has a ~5MB limit. For very large GeoJSON datasets, this may not suffice. Recommendation: catch quota errors and skip persistence for oversized datasets (the user can re-upload).

### Anti-Patterns to Avoid
- **Importing leaflet at module level in a server component:** Always use `next/dynamic` with `ssr: false`. Even importing the CSS at the top level of a non-dynamic component will break SSR.
- **Creating new GeoJSON layer instances on every render:** React-leaflet's `<GeoJSON>` component needs a stable `key` prop. Use the layer ID as key and only recreate when data changes.
- **Storing Leaflet map instance in React state:** The map ref should use `useRef` or react-leaflet's `useMap()` hook, not `useState` (Leaflet objects are not serializable).
- **Forgetting Leaflet default marker icon fix:** Leaflet's default marker icon paths break with bundlers. Must configure `L.Icon.Default` with explicit icon URLs or use `circleMarker` instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| KML to GeoJSON conversion | Custom XML parser | `@mapbox/togeojson` | KML spec is complex; handles placemarks, styles, extended data |
| Shapefile parsing | Custom binary reader | `shpjs` | Binary format (.shp/.dbf/.shx); encoding detection; projection handling |
| ZIP extraction | Custom decompressor | `jszip` | Standard, handles KMZ and Shapefile ZIPs |
| Map tile rendering | Canvas-based map | Leaflet | Mature library with 15+ years of development |
| Screenshot capture | Manual canvas compositing | `leaflet-simple-map-screenshoter` | Handles tile compositing, layer ordering, async tile loading |
| Marker clustering | Custom viewport filtering | `react-leaflet-cluster` (if needed) | Handles zoom-level aggregation, animations, performance |

**Key insight:** This phase is almost entirely assembly -- connecting well-established libraries. The custom code is the glue: file routing, state management, UI panels.

## Common Pitfalls

### Pitfall 1: Leaflet SSR Crash
**What goes wrong:** `ReferenceError: window is not defined` at build time or server render.
**Why it happens:** Leaflet accesses `window` and `document` globals on import.
**How to avoid:** Every file that imports from `leaflet` or `react-leaflet` must be loaded via `next/dynamic({ ssr: false })`. This includes the CSS import.
**Warning signs:** Build errors mentioning `window`, `document`, or `L is not defined`.

### Pitfall 2: Leaflet Default Marker Icon Broken
**What goes wrong:** Default blue markers show as broken images.
**Why it happens:** Webpack/Turbopack rewrites the icon image paths that Leaflet hardcodes.
**How to avoid:** Either (a) set `L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })` with explicit imports from `leaflet/dist/images/`, or (b) use `circleMarker` style for points instead of icon markers.
**Warning signs:** Console errors about missing marker images, broken image icons on map.

### Pitfall 3: GeoJSON Component Not Updating
**What goes wrong:** Adding new data doesn't re-render the GeoJSON layer.
**Why it happens:** React-leaflet's `<GeoJSON>` component does not update when `data` prop changes -- it only renders on mount.
**How to avoid:** Use a unique `key` prop tied to layer data (e.g., layer ID + hash). When data changes, a new key forces remount.
**Warning signs:** Map shows stale data after upload.

### Pitfall 4: sessionStorage Size Limit
**What goes wrong:** Saving large GeoJSON to sessionStorage throws `QuotaExceededError`.
**Why it happens:** sessionStorage limit is typically 5MB per origin.
**How to avoid:** Wrap persistence in try/catch. For very large datasets, skip session storage and show a notification that session persistence is unavailable for large files.
**Warning signs:** Console `QuotaExceededError`, layers disappearing on reload.

### Pitfall 5: CORS on Tile Layers
**What goes wrong:** Screenshot export shows blank tiles.
**Why it happens:** Cross-origin tile images taint the canvas, preventing export.
**How to avoid:** `leaflet-simple-map-screenshoter` uses `dom-to-image-more` which handles this better than html2canvas. Ensure tile URLs use HTTPS. If issues persist, use `crossOrigin: "anonymous"` on TileLayer.
**Warning signs:** Screenshot is blank or missing tile imagery.

### Pitfall 6: shpjs Returns Array for Multi-Shapefile ZIPs
**What goes wrong:** Code expects a single FeatureCollection but gets an array.
**Why it happens:** If a ZIP contains multiple .shp files, shpjs returns an array of FeatureCollections.
**How to avoid:** Check `Array.isArray()` on the result. Either use the first one or create multiple layers.
**Warning signs:** TypeError when accessing `.features` on the parsed result.

## Code Examples

### Base Map Tile Layers
```typescript
// Source: Leaflet tile providers (leaflet-providers project)
const TILE_LAYERS = {
  osm: {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; Esri &mdash; Esri, i-cubed, USDA, ArcGIS',
  },
  topo: {
    name: "Topographic",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  },
} as const
```

### Coordinate Display Component
```typescript
// Source: react-leaflet useMapEvents hook
import { useMapEvents } from "react-leaflet"
import { useState } from "react"

function CoordinateDisplay() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  useMapEvents({
    mousemove(e) {
      setCoords({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
    mouseout() {
      setCoords(null)
    },
  })

  if (!coords) return null
  return (
    <div className="leaflet-bottom leaflet-left">
      <div className="leaflet-control bg-white/90 px-2 py-1 rounded text-xs font-mono">
        {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
      </div>
    </div>
  )
}
```

### Auto-Fit Bounds on Layer Add
```typescript
// Source: react-leaflet useMap hook
import { useMap } from "react-leaflet"
import L from "leaflet"

function FitBounds({ layers }: { layers: MapLayer[] }) {
  const map = useMap()

  useEffect(() => {
    const visibleLayers = layers.filter(l => l.visible)
    if (visibleLayers.length === 0) return

    const bounds = L.latLngBounds([])
    visibleLayers.forEach(layer => {
      const layerBounds = L.geoJSON(layer.geojson).getBounds()
      if (layerBounds.isValid()) bounds.extend(layerBounds)
    })

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] })
    }
  }, [layers, map])

  return null
}
```

### Distance Measurement (Custom Polyline Approach)
```typescript
// Lightweight distance measurement -- no external plugin needed
// User clicks points on the map, a polyline is drawn, total distance shown
import L from "leaflet"
import { useMapEvents } from "react-leaflet"

function MeasurementTool({ active }: { active: boolean }) {
  const [points, setPoints] = useState<L.LatLng[]>([])
  const map = useMap()

  useMapEvents({
    click(e) {
      if (!active) return
      setPoints(prev => [...prev, e.latlng])
    },
  })

  const totalDistance = points.reduce((sum, pt, i) => {
    if (i === 0) return 0
    return sum + points[i - 1].distanceTo(pt)
  }, 0)

  // Render polyline + distance label via Leaflet directly
  // (implementation details in plan)
}
```

### Layer Color Palette
```typescript
// Distinct colors for up to 10 layers, then cycle
const LAYER_COLORS = [
  "#3B82F6", // blue
  "#EF4444", // red
  "#10B981", // emerald
  "#F59E0B", // amber
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange (brand accent)
  "#6366F1", // indigo
  "#14B8A6", // teal (brand secondary)
]

export function getLayerColor(index: number): string {
  return LAYER_COLORS[index % LAYER_COLORS.length]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-leaflet v4 (React 18) | react-leaflet v5 (React 19) | 2024 | Must use v5 since project uses React 19.2.3 |
| ESRI World Imagery (free, no key) | ESRI requires API key for new services | 2022+ | Legacy tile URL still works for non-commercial; monitor for deprecation |
| html2canvas for screenshots | leaflet-simple-map-screenshoter (dom-to-image) | 2023+ | Better Leaflet tile handling than html2canvas |
| leaflet-omnivore (all-in-one parser) | Individual parsers (togeojson, shpjs) | Ongoing | Omnivore is unmaintained; individual libraries are actively maintained |

**Deprecated/outdated:**
- `leaflet-omnivore`: Last meaningful update years ago. Use individual parsers instead.
- `@mapbox/togeojson` v0.16.x is stable but old -- it works fine for KML. There is no newer maintained alternative.
- Legacy ESRI tile URLs (`server.arcgisonline.com`): Still functional but officially deprecated. Works for this use case but may require migration later.

## Open Questions

1. **ESRI Satellite Tile Longevity**
   - What we know: The legacy `server.arcgisonline.com` URL still serves tiles without an API key. ESRI has officially moved to a token-based service.
   - What's unclear: How long the legacy endpoint will remain available.
   - Recommendation: Use it for now. If it breaks, swap to Mapbox Satellite (requires free API key) or remove satellite option. Easy to change since it's just a URL string.

2. **sessionStorage vs In-Memory for Large Files**
   - What we know: sessionStorage has ~5MB limit. A large GeoJSON (10,000+ features with attributes) can easily exceed this.
   - What's unclear: Typical file sizes users will upload.
   - Recommendation: Use sessionStorage with try/catch fallback. Store layer metadata (filename, color, visibility) always; store GeoJSON data on best-effort basis. If quota exceeded, layers restore without data (user re-uploads).

3. **Performance with Very Large Datasets**
   - What we know: Leaflet handles ~10,000 markers well. Beyond 50,000, clustering or canvas rendering is needed.
   - What's unclear: Whether survey files commonly have 50K+ features.
   - Recommendation: Implement without clustering initially. If performance issues arise, add `react-leaflet-cluster` for point layers. For polylines/polygons, Leaflet handles large counts better than points.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + jsdom |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

Since no formal requirement IDs are assigned, testing maps to the functional behaviors specified in CONTEXT.md:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Parse GeoJSON file to FeatureCollection | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "geojson"` | Wave 0 |
| Parse KML file to FeatureCollection | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "kml"` | Wave 0 |
| Parse KMZ (ZIP with KML) to FeatureCollection | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "kmz"` | Wave 0 |
| Parse Shapefile ZIP to FeatureCollection | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "shapefile"` | Wave 0 |
| Unsupported format throws error | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "unsupported"` | Wave 0 |
| Layer color assignment cycles correctly | unit | `npx vitest run tests/visualize/layer-colors.test.ts` | Wave 0 |
| Session store serializes/deserializes layers | unit | `npx vitest run tests/visualize/session-store.test.ts` | Wave 0 |
| Map renders without SSR errors | manual-only | Manual: load `/tools/visualize` in browser | N/A |
| Layer toggle hides/shows features | manual-only | Manual: upload file, toggle layer | N/A |
| Screenshot exports PNG | manual-only | Manual: click screenshot button | N/A |
| Distance measurement calculates correctly | unit | `npx vitest run tests/visualize/measurement.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/visualize/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/visualize/parse-spatial-file.test.ts` -- file parsing tests
- [ ] `tests/visualize/layer-colors.test.ts` -- color assignment tests
- [ ] `tests/visualize/session-store.test.ts` -- session persistence tests
- [ ] `tests/visualize/measurement.test.ts` -- distance calculation tests
- [ ] `tests/fixtures/sample.geojson` -- sample GeoJSON fixture
- [ ] `tests/fixtures/sample.kml` -- sample KML fixture

## Sources

### Primary (HIGH confidence)
- [npm registry: react-leaflet](https://www.npmjs.com/package/react-leaflet) - v5.0.0, peer deps: React 19, Leaflet ^1.9.0
- [npm registry: leaflet](https://www.npmjs.com/package/leaflet) - v1.9.4 confirmed
- [npm registry: shpjs](https://www.npmjs.com/package/shpjs) - v6.2.0, pure JS shapefile parser
- [npm registry: @mapbox/togeojson](https://www.npmjs.com/package/@mapbox/togeojson) - v0.16.2, KML/GPX to GeoJSON
- [npm registry: jszip](https://www.npmjs.com/package/jszip) - v3.10.1
- [npm registry: leaflet-simple-map-screenshoter](https://www.npmjs.com/package/leaflet-simple-map-screenshoter) - v0.5.0
- [react-leaflet docs](https://react-leaflet.js.org/) - API reference

### Secondary (MEDIUM confidence)
- [Leaflet Provider Demo](https://leaflet-extras.github.io/leaflet-providers/preview/) - tile layer URLs and attribution
- [ESRI basemap migration notice](https://www.esri.com/arcgis-blog/products/developers/developers/open-source-developers-time-to-upgrade-to-the-new-arcgis-basemap-layer-service/) - API key requirements
- Multiple Stack Overflow / Medium articles on react-leaflet + Next.js SSR pattern (consistent solution: `next/dynamic` with `ssr: false`)

### Tertiary (LOW confidence)
- ESRI legacy tile URL longevity -- no official deprecation date found

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all versions verified against npm registry, peer deps confirmed compatible with project (React 19.2.3)
- Architecture: HIGH - SSR bypass pattern is well-documented and universally used; client-side parsing approach verified with library docs
- Pitfalls: HIGH - SSR issues, marker icons, GeoJSON key prop are extensively documented in community
- File parsing: MEDIUM - @mapbox/togeojson is old but stable; shpjs v6 is less widely documented

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable ecosystem, Leaflet 2.0 alpha exists but not production-ready)
