# Phase 27: Spatial QC Map Overlay - Research

**Researched:** 2026-04-10
**Domain:** Leaflet map visualization, heatmap layers, spatial issue plotting
**Confidence:** HIGH

## Summary

Phase 27 adds spatial QC visualization to the existing Leaflet map infrastructure. The core challenge is connecting validation issues (which have row_number, column_name, kp_value but NOT direct lat/lon) to geographic coordinates stored in the parsed dataset. This requires a coordinate extraction step that uses column_mappings to find easting/northing or lat/lon columns and cross-references issue row numbers back to the parsed data to get coordinates.

The existing map at `/tools/visualize` uses react-leaflet v5 with Leaflet 1.9.4, circleMarker rendering, layer management, and session persistence. This infrastructure can be largely reused. The heatmap layer will use `leaflet.heat` (the official Leaflet plugin) directly with a thin React wrapper using `useMap()` -- the existing npm react-leaflet heatmap wrappers are all outdated and incompatible with react-leaflet v5.

**Primary recommendation:** Build a reusable `SpatialQCMap` component that accepts validation issues + parsed data + column mappings, extracts coordinates per issue, renders severity-colored circleMarkers with popups, and provides a toggleable heatmap layer via leaflet.heat. Expose this component in both the results dashboard and the pipeline validate stage.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SQCV-01 | Overlay flagged issues on map visualiser | Severity-colored circleMarkers from react-leaflet, coordinate extraction from parsedData using column_mappings easting/northing/lat/lon indices |
| SQCV-02 | Error density heatmap | leaflet.heat plugin with L.heatLayer, intensity mapped from issue severity (critical=1.0, warning=0.6, info=0.3) |
| SQCV-03 | Compare two datasets spatially on map | Dual-layer rendering with distinct color schemes, deviation line/area highlights between matching KP points |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-leaflet | ^5.0.0 | React map components | Already installed, used by /tools/visualize |
| leaflet | ^1.9.4 | Map engine | Already installed |
| leaflet.heat | ^0.2.0 | Heatmap layer plugin | Official Leaflet plugin, tiny (3KB), no dependencies beyond Leaflet |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/leaflet | ^1.9.21 | TypeScript defs | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| leaflet.heat | react-leaflet-heatmap-layer-v3 | Outdated (4 years), incompatible with react-leaflet v5 |
| leaflet.heat | heatmap.js + leaflet plugin | Heavier, more config, overkill for density overlay |
| Custom circleMarkers | Leaflet.markercluster | Clusters hide individual issues; we need each issue visible |

**Installation:**
```bash
npm install leaflet.heat
```

Note: `leaflet.heat` has no @types package. A local `.d.ts` declaration file is needed (same pattern as existing `leaflet-screenshoter.d.ts` and `shpjs.d.ts` in the visualize lib folder).

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    spatial-qc/
      spatial-qc-map.tsx         # Main map component (client-only, dynamic import)
      issue-markers-layer.tsx    # CircleMarker layer for issues with popups
      heatmap-layer.tsx          # leaflet.heat wrapper using useMap()
      comparison-layer.tsx       # Dual-dataset deviation overlay
      lib/
        coordinate-extractor.ts  # Extract lat/lon from parsedData + columnMappings
        types.ts                 # SpatialIssue, SpatialDataPoint interfaces
        severity-colors.ts       # Severity -> color mapping for markers
```

### Pattern 1: Coordinate Extraction from Validation Issues
**What:** ValidationIssue has row_number but no coordinates. Must cross-reference with parsedData and column_mappings to get lat/lon.
**When to use:** Every time issues are plotted on the map.
**Example:**
```typescript
// coordinate-extractor.ts
interface SpatialIssue {
  issue: ValidationIssue
  lat: number
  lng: number
}

function extractSpatialIssues(
  issues: ValidationIssue[],
  parsedData: string[][],
  columnMappings: ColumnMapping[]
): SpatialIssue[] {
  // Find lat/lon or easting/northing columns from mappings
  const latCol = columnMappings.find(m => m.mappedType === 'latitude')
  const lonCol = columnMappings.find(m => m.mappedType === 'longitude')
  const eastCol = columnMappings.find(m => m.mappedType === 'easting')
  const northCol = columnMappings.find(m => m.mappedType === 'northing')

  // Prefer lat/lon, fall back to easting/northing (need CRS conversion)
  // For each issue, look up row_number in parsedData to get coords
  return issues
    .filter(issue => issue.row_number > 0 && issue.row_number < parsedData.length)
    .map(issue => {
      const row = parsedData[issue.row_number] // row_number is 1-indexed (header=0)
      const lat = parseFloat(row[latCol?.index ?? -1])
      const lng = parseFloat(row[lonCol?.index ?? -1])
      if (isNaN(lat) || isNaN(lng)) return null
      return { issue, lat, lng }
    })
    .filter(Boolean)
}
```

### Pattern 2: Heatmap Layer with useMap()
**What:** Thin React wrapper around L.heatLayer using react-leaflet's useMap() hook.
**When to use:** For the error density heatmap toggle.
**Example:**
```typescript
// heatmap-layer.tsx
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'

interface HeatmapLayerProps {
  points: [number, number, number][] // [lat, lng, intensity]
  options?: { radius?: number; blur?: number; maxZoom?: number; gradient?: Record<number, string> }
}

export function HeatmapLayer({ points, options }: HeatmapLayerProps) {
  const map = useMap()

  useEffect(() => {
    const heat = (L as any).heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: { 0.2: '#22c55e', 0.5: '#f59e0b', 0.8: '#ef4444', 1.0: '#991b1b' },
      ...options,
    }).addTo(map)

    return () => { map.removeLayer(heat) }
  }, [map, points, options])

  return null
}
```

### Pattern 3: Dataset Comparison Overlay
**What:** Plot two datasets with distinct colors and draw deviation lines between matching KP points.
**When to use:** SQCV-03 spatial comparison.
**Example approach:**
- Dataset A: blue markers, Dataset B: orange markers
- Match rows by KP value (nearest-KP matching with tolerance)
- Draw polylines between matched points showing spatial deviation
- Color deviation lines by distance (green < threshold, red > threshold)

### Anti-Patterns to Avoid
- **Loading full parsedData into map state:** parsedData can be huge. Extract only the coordinates needed, do not pass entire string[][] to map components.
- **Using popup HTML strings for complex content:** Use react-leaflet's `<Popup>` component with JSX, not raw HTML string binding.
- **Re-rendering entire GeoJSON layer on filter change:** Use React keys and memoization to avoid full layer re-renders when toggling severity filters.
- **Blocking render with coordinate extraction:** For large datasets (10k+ rows), extract coordinates in a useMemo or Web Worker, not synchronously in render.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Heatmap rendering | Canvas-based heat grid | leaflet.heat L.heatLayer | GPU-optimized, handles clustering, gradient interpolation |
| Coordinate system conversion | Easting/northing to lat/lon math | pyproj on backend (already exists) | Datum transformations are complex; project already has CRS transform endpoint |
| Map tile serving | Custom tile server | ESRI/OSM (already configured) | Free, reliable, no maintenance |
| Marker clustering at zoom | Manual grouping logic | Keep individual markers, rely on Leaflet's canvas renderer | Survey datasets are typically <5000 rows; clustering hides issue context |

**Key insight:** The coordinate extraction is the only genuinely new logic. Everything else (map rendering, heatmap, popups, layers) is library configuration on top of existing infrastructure.

## Common Pitfalls

### Pitfall 1: Missing Coordinate Columns
**What goes wrong:** User uploads a dataset without lat/lon or easting/northing columns, tries to view spatial QC map, sees empty map or error.
**Why it happens:** Not all survey datasets have spatial columns mapped.
**How to avoid:** Check column_mappings for spatial columns before showing the "View on Map" button. Show a disabled state with tooltip "No spatial columns detected" when coordinates are unavailable.
**Warning signs:** Map renders with 0 markers and no error message.

### Pitfall 2: Easting/Northing Without CRS Context
**What goes wrong:** Dataset has easting/northing (e.g., OSGB36) but no lat/lon. Plotting easting as longitude produces garbage.
**Why it happens:** Easting/northing are projected coordinates, not geographic.
**How to avoid:** When only easting/northing are available, call the existing CRS transform endpoint (`/api/v1/transform/crs`) to convert to WGS84 lat/lon before plotting. Cache the converted coordinates.
**Warning signs:** All points cluster near (0,0) or in completely wrong location.

### Pitfall 3: leaflet.heat TypeScript Types
**What goes wrong:** TypeScript errors because leaflet.heat has no @types package and augments L namespace.
**Why it happens:** Plugin uses `L.heatLayer()` which is not in @types/leaflet.
**How to avoid:** Create a `leaflet-heat.d.ts` type declaration file. Follow the same pattern as existing `leaflet-screenshoter.d.ts`.
**Warning signs:** Build errors on `L.heatLayer is not a function` or TS2339.

### Pitfall 4: Performance with Large Issue Sets
**What goes wrong:** 5000+ circleMarkers with popups cause laggy map interaction.
**Why it happens:** Each marker is a DOM element with event listeners.
**How to avoid:** Use Leaflet's Canvas renderer (L.canvas()) instead of default SVG for circleMarkers when issue count > 500. Canvas markers are much faster. Also consider pagination or viewport-based rendering.
**Warning signs:** Map panning becomes choppy, popup open delay > 200ms.

### Pitfall 5: SSR with Leaflet
**What goes wrong:** `window is not defined` error during server rendering.
**Why it happens:** Leaflet requires browser APIs.
**How to avoid:** Use `dynamic(() => import(...), { ssr: false })` -- same pattern as existing `LeafletMap` in visualize page. The `leaflet.heat` import must also be client-side only.
**Warning signs:** Build error or hydration mismatch.

### Pitfall 6: Pipeline vs Dashboard Data Sources
**What goes wrong:** Pipeline has in-memory parsedData (string[][]) while dashboard fetches from Supabase. Map component needs to handle both.
**Why it happens:** Two different data flows feed the same visualization.
**How to avoid:** Define a common `SpatialIssue[]` interface. Create separate adapter functions for pipeline context (parsedData + client ValidationIssue) and dashboard context (server ValidationIssue + fetched dataset row data).
**Warning signs:** Map works in pipeline but not dashboard, or vice versa.

## Code Examples

### Severity Color Mapping for Markers
```typescript
// severity-colors.ts
export const SEVERITY_MARKER_COLORS = {
  critical: { fill: '#ef4444', stroke: '#991b1b' },  // red
  warning:  { fill: '#f59e0b', stroke: '#b45309' },  // amber
  info:     { fill: '#3b82f6', stroke: '#1d4ed8' },  // blue
} as const

export const SEVERITY_HEAT_INTENSITY = {
  critical: 1.0,
  warning: 0.6,
  info: 0.3,
} as const
```

### leaflet-heat.d.ts Type Declaration
```typescript
// leaflet-heat.d.ts
import * as L from 'leaflet'

declare module 'leaflet' {
  function heatLayer(
    latlngs: Array<[number, number] | [number, number, number]>,
    options?: {
      radius?: number
      blur?: number
      maxZoom?: number
      max?: number
      minOpacity?: number
      gradient?: Record<number, string>
    }
  ): L.Layer
}
```

### "View on Map" Button Guard
```typescript
// Check if spatial visualization is available
function hasSpatialColumns(mappings: ColumnMapping[] | null): boolean {
  if (!mappings) return false
  const hasLatLon = mappings.some(m => m.mappedType === 'latitude') &&
                    mappings.some(m => m.mappedType === 'longitude')
  const hasEastNorth = mappings.some(m => m.mappedType === 'easting') &&
                       mappings.some(m => m.mappedType === 'northing')
  return hasLatLon || hasEastNorth
}
```

### Dynamic Import Pattern (matches existing project pattern)
```typescript
const SpatialQCMap = dynamic(
  () => import('@/components/spatial-qc/spatial-qc-map'),
  { ssr: false, loading: () => <MapLoadingSkeleton /> }
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-leaflet-heatmap-layer | Direct leaflet.heat + useMap() wrapper | react-leaflet v4+ (2023) | Old wrappers incompatible with v5; custom wrapper is 15 lines |
| SVG markers for large datasets | Canvas renderer for 500+ markers | Leaflet 1.8+ | 10x performance improvement for dense point layers |
| Separate map page | Embedded map panel in existing views | Current trend | Better UX; map is contextual to the data being reviewed |

**Deprecated/outdated:**
- `react-leaflet-heatmap-layer` (v2.0.0, 7 years old): Incompatible with react-leaflet v5
- `react-leaflet-heatmap-layer-v3`: Last published 4 years ago, not maintained

## Open Questions

1. **Easting/Northing conversion approach for pipeline context**
   - What we know: Backend has `/api/v1/transform/crs` endpoint that converts coordinates. Column detector identifies easting/northing.
   - What's unclear: Whether to convert on-the-fly (API call) or pre-convert during inspect stage.
   - Recommendation: Convert lazily when user opens map view. Cache converted coords in component state. Do NOT pre-convert during pipeline -- it adds latency to the happy path.

2. **Dataset comparison data source for SQCV-03**
   - What we know: Pipeline processes one file at a time. Dashboard shows one dataset's results.
   - What's unclear: Where does the second dataset come from for comparison? User must select it.
   - Recommendation: Add a "Compare with..." dropdown that lists other datasets in the same job. Fetch the second dataset's parsed data on demand.

3. **Map panel placement in results dashboard**
   - What we know: Results dashboard currently has stat cards, AI summary, and issues table.
   - What's unclear: Whether map should be a tab, a collapsible panel, or a modal overlay.
   - Recommendation: Add a "Map View" tab alongside the existing clustered/individual toggle. Full-width map panel that replaces the issues table when active.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SQCV-01 | Coordinate extraction from issues + parsedData | unit | `npx vitest run src/components/spatial-qc/lib/coordinate-extractor.test.ts -x` | Wave 0 |
| SQCV-01 | hasSpatialColumns guard function | unit | `npx vitest run src/components/spatial-qc/lib/coordinate-extractor.test.ts -x` | Wave 0 |
| SQCV-02 | Heatmap intensity mapping from severity | unit | `npx vitest run src/components/spatial-qc/lib/severity-colors.test.ts -x` | Wave 0 |
| SQCV-03 | KP-based dataset matching for comparison | unit | `npx vitest run src/components/spatial-qc/lib/dataset-comparison.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/spatial-qc/lib/coordinate-extractor.test.ts` -- covers SQCV-01 coordinate extraction and guard
- [ ] `src/components/spatial-qc/lib/severity-colors.test.ts` -- covers SQCV-02 intensity mapping
- [ ] `src/components/spatial-qc/lib/dataset-comparison.test.ts` -- covers SQCV-03 KP matching
- [ ] `src/components/spatial-qc/lib/leaflet-heat.d.ts` -- type declaration for leaflet.heat

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/app/(public)/tools/visualize/` -- existing Leaflet map implementation, patterns, types
- Project codebase: `src/lib/types/validation.ts` -- ValidationIssue structure (row_number, column_name, severity, kp_value)
- Project codebase: `src/lib/parsing/types.ts` -- ColumnMapping with mappedType including latitude/longitude/easting/northing
- Project codebase: `src/app/(dashboard)/pipeline/lib/pipeline-state.ts` -- parsedData as string[][]
- [Leaflet.heat GitHub](https://github.com/Leaflet/Leaflet.heat) -- L.heatLayer API, options, data format

### Secondary (MEDIUM confidence)
- [react-leaflet-heatmap-layer-v3 npm](https://www.npmjs.com/package/react-leaflet-heatmap-layer-v3) -- confirmed outdated, last publish 4 years ago
- [react-leaflet docs](https://react-leaflet.js.org/) -- useMap() hook for custom layer integration

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project except leaflet.heat (official, well-documented)
- Architecture: HIGH -- follows exact patterns established in Phase 13 map visualization
- Pitfalls: HIGH -- derived from actual codebase analysis (SSR, column mapping types, data flow)

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable domain, no fast-moving dependencies)
