"use client"

import { useState } from "react"
import { FileText, FileSpreadsheet, Loader2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

type DownloadType = "pdf" | "csv" | "xlsx"

interface ExportButtonsProps {
  runId: string
  datasetId: string
}

export function ExportButtons({ runId, datasetId }: ExportButtonsProps) {
  const [downloading, setDownloading] = useState<DownloadType | null>(null)

  async function handleDownload(type: DownloadType) {
    setDownloading(type)
    try {
      const url =
        type === "pdf"
          ? `/api/reports/pdf?runId=${runId}`
          : `/api/reports/export?datasetId=${datasetId}&format=${type}&runId=${runId}`

      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Download failed" }))
        throw new Error(body.error || "Download failed")
      }

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download =
        type === "pdf"
          ? `qc-report-${runId.slice(0, 8)}.pdf`
          : `dataset-annotated.${type}`
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error(`Export ${type} failed:`, err)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={downloading !== null}
        onClick={() => handleDownload("pdf")}
      >
        {downloading === "pdf" ? (
          <Loader2 className="animate-spin" />
        ) : (
          <FileText />
        )}
        PDF Report
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={downloading !== null}
        onClick={() => handleDownload("csv")}
      >
        {downloading === "csv" ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Download />
        )}
        CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={downloading !== null}
        onClick={() => handleDownload("xlsx")}
      >
        {downloading === "xlsx" ? (
          <Loader2 className="animate-spin" />
        ) : (
          <FileSpreadsheet />
        )}
        Excel
      </Button>
    </div>
  )
}
