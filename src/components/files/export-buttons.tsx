"use client"

import { useState, useRef, useEffect } from "react"
import { FileText, FileSpreadsheet, Loader2, Download, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"

type DownloadType = "pdf" | "csv" | "xlsx"

interface ExportButtonsProps {
  runId: string
  datasetId: string
}

export function ExportButtons({ runId, datasetId }: ExportButtonsProps) {
  const [downloading, setDownloading] = useState<DownloadType | null>(null)
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false)
  const pdfMenuRef = useRef<HTMLDivElement>(null)

  // Close menu on click outside
  useEffect(() => {
    if (!pdfMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (pdfMenuRef.current && !pdfMenuRef.current.contains(e.target as Node)) {
        setPdfMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [pdfMenuOpen])

  async function handleDownload(type: DownloadType, mode?: "executive" | "technical") {
    setDownloading(type)
    setPdfMenuOpen(false)
    try {
      const url =
        type === "pdf"
          ? `/api/reports/pdf?runId=${runId}&mode=${mode || "technical"}`
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
          ? `qc-${mode || "technical"}-report-${runId.slice(0, 8)}.pdf`
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
      {/* PDF Report Dropdown */}
      <div className="relative" ref={pdfMenuRef}>
        <Button
          variant="outline"
          size="sm"
          disabled={downloading !== null}
          onClick={() => setPdfMenuOpen((prev) => !prev)}
        >
          {downloading === "pdf" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <FileText />
          )}
          PDF Report
          <ChevronDown className="ml-1 size-3" />
        </Button>
        {pdfMenuOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border bg-popover p-1 shadow-md">
            <button
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
              onClick={() => handleDownload("pdf", "executive")}
            >
              <FileText className="size-4 text-teal-600" />
              Executive Report
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
              onClick={() => handleDownload("pdf", "technical")}
            >
              <FileText className="size-4 text-blue-600" />
              Technical Report
            </button>
          </div>
        )}
      </div>
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
