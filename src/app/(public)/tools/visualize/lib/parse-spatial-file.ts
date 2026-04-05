import * as toGeoJSON from "@mapbox/togeojson"
import JSZip from "jszip"
import shp from "shpjs"

const SUPPORTED_EXTENSIONS = [".geojson", ".json", ".kml", ".kmz", ".zip", ".csv"]

// Common coordinate column name patterns
const LAT_PATTERNS = [/^lat/i, /^latitude/i, /^y$/i, /^northing/i, /^north/i]
const LON_PATTERNS = [/^lon/i, /^lng/i, /^longitude/i, /^x$/i, /^easting/i, /^east/i]

function getExtension(filename: string): string {
  return filename.substring(filename.lastIndexOf(".")).toLowerCase()
}

function ensureFeatureIds(
  fc: GeoJSON.FeatureCollection
): GeoJSON.FeatureCollection {
  fc.features.forEach((feature, i) => {
    if (feature.id == null) {
      feature.id = `feature-${i}`
    }
  })
  return fc
}

async function parseGeoJSON(file: File): Promise<GeoJSON.FeatureCollection> {
  const text = await file.text()
  const parsed = JSON.parse(text)

  if (parsed.type === "FeatureCollection") {
    return parsed as GeoJSON.FeatureCollection
  }
  if (parsed.type === "Feature") {
    return { type: "FeatureCollection", features: [parsed] }
  }
  if (parsed.coordinates || parsed.geometries) {
    return {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: parsed, properties: {} }],
    }
  }

  throw new Error("Invalid GeoJSON: unrecognized structure")
}

async function parseKML(file: File): Promise<GeoJSON.FeatureCollection> {
  const text = await file.text()
  const parser = new DOMParser()
  const dom = parser.parseFromString(text, "text/xml")
  return toGeoJSON.kml(dom)
}

async function parseKMZ(file: File): Promise<GeoJSON.FeatureCollection> {
  const buffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)

  const kmlEntry = Object.keys(zip.files).find((name) =>
    name.toLowerCase().endsWith(".kml")
  )
  if (!kmlEntry) {
    throw new Error("KMZ archive does not contain a .kml file")
  }

  const kmlText = await zip.files[kmlEntry].async("text")
  const parser = new DOMParser()
  const dom = parser.parseFromString(kmlText, "text/xml")
  return toGeoJSON.kml(dom)
}

async function parseShapefile(
  file: File
): Promise<GeoJSON.FeatureCollection> {
  const buffer = await file.arrayBuffer()
  const result = await shp(buffer)

  if (Array.isArray(result)) {
    return result[0]
  }
  return result
}

function findColumn(headers: string[], patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex((h) => pattern.test(h.trim()))
    if (idx !== -1) return idx
  }
  return -1
}

async function parseCSV(file: File): Promise<GeoJSON.FeatureCollection> {
  const text = await file.text()
  const lines = text.split("\n").filter((l) => l.trim())
  if (lines.length < 2) {
    throw new Error("CSV file must have at least a header and one data row")
  }

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""))
  const latIdx = findColumn(headers, LAT_PATTERNS)
  const lonIdx = findColumn(headers, LON_PATTERNS)

  if (latIdx === -1 || lonIdx === -1) {
    throw new Error(
      "CSV must contain coordinate columns (latitude/longitude, lat/lon, easting/northing, x/y). " +
      `Found columns: ${headers.join(", ")}`
    )
  }

  const features: GeoJSON.Feature[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
    const lat = parseFloat(values[latIdx])
    const lon = parseFloat(values[lonIdx])

    if (isNaN(lat) || isNaN(lon)) continue

    const properties: Record<string, string> = {}
    headers.forEach((h, j) => {
      if (j < values.length) {
        properties[h] = values[j]
      }
    })

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
      properties,
    })
  }

  if (features.length === 0) {
    throw new Error("No valid coordinate pairs found in CSV")
  }

  return { type: "FeatureCollection", features }
}

export async function parseSpatialFile(
  file: File
): Promise<GeoJSON.FeatureCollection> {
  const ext = getExtension(file.name)

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Unsupported file type: ${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`
    )
  }

  let fc: GeoJSON.FeatureCollection

  switch (ext) {
    case ".geojson":
    case ".json":
      fc = await parseGeoJSON(file)
      break
    case ".kml":
      fc = await parseKML(file)
      break
    case ".kmz":
      fc = await parseKMZ(file)
      break
    case ".zip":
      fc = await parseShapefile(file)
      break
    case ".csv":
      fc = await parseCSV(file)
      break
    default:
      throw new Error(`Unsupported file type: ${ext}`)
  }

  return ensureFeatureIds(fc)
}
