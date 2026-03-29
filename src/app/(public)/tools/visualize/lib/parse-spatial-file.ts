import * as toGeoJSON from "@mapbox/togeojson"
import JSZip from "jszip"
import shp from "shpjs"

const SUPPORTED_EXTENSIONS = [".geojson", ".json", ".kml", ".kmz", ".zip"]

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

  // Handle bare geometry or single feature
  if (parsed.type === "FeatureCollection") {
    return parsed as GeoJSON.FeatureCollection
  }
  if (parsed.type === "Feature") {
    return { type: "FeatureCollection", features: [parsed] }
  }
  // Bare geometry
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

  // Find the .kml file inside the KMZ
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
    // Multiple layers in shapefile -- use the first one
    return result[0]
  }
  return result
}

export async function parseSpatialFile(
  file: File
): Promise<GeoJSON.FeatureCollection> {
  const ext = getExtension(file.name)

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Unsupported file type: ${ext}. Supported formats: ${SUPPORTED_EXTENSIONS.join(", ")}`
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
    default:
      throw new Error(`Unsupported file type: ${ext}`)
  }

  return ensureFeatureIds(fc)
}
