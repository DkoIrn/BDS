"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, ChevronDown, ChevronUp, Loader2, X } from "lucide-react"
import { parseSpatialFile } from "../lib/parse-spatial-file"

const ACCEPTED_EXTENSIONS = [".geojson", ".json", ".kml", ".kmz", ".zip"]

interface UploadPanelProps {
  onFileParsed: (file: File, geojson: GeoJSON.FeatureCollection) => void
}

export function UploadPanel({ onFileParsed }: UploadPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return
      const file = acceptedFiles[0]

      setLoading(true)
      setError(null)

      try {
        const geojson = await parseSpatialFile(file)
        onFileParsed(file, geojson)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to parse file"
        )
      } finally {
        setLoading(false)
      }
    },
    [onFileParsed]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    validator: (file) => {
      const ext = file.name
        .substring(file.name.lastIndexOf("."))
        .toLowerCase()
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return {
          code: "file-invalid-type",
          message: `Unsupported: ${ext}`,
        }
      }
      return null
    },
  })

  return (
    <div className="w-64 rounded-lg bg-white shadow-lg">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-gray-700"
      >
        <span className="flex items-center gap-1.5">
          <Upload className="size-3.5" />
          Upload
        </span>
        {collapsed ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronUp className="size-3.5" />
        )}
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="border-t px-3 pb-3 pt-2">
          {loading ? (
            <div className="flex flex-col items-center py-4">
              <Loader2 className="size-5 animate-spin text-blue-500" />
              <p className="mt-2 text-xs text-gray-500">Parsing file...</p>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-md border-2 border-dashed px-3 py-4 text-center transition-colors ${
                isDragActive
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 hover:border-blue-300 hover:bg-gray-50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto size-4 text-gray-400" />
              <p className="mt-1.5 text-xs font-medium text-gray-600">
                Drop spatial files here
              </p>
              <p className="mt-0.5 text-[10px] text-gray-400">
                GeoJSON, KML, KMZ, Shapefile (ZIP)
              </p>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="mt-2 flex items-start gap-1.5 rounded bg-red-50 px-2 py-1.5">
              <p className="flex-1 text-[10px] text-red-600">{error}</p>
              <button onClick={() => setError(null)}>
                <X className="size-3 text-red-400 hover:text-red-600" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
