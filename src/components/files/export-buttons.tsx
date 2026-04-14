"use client"

import { useState, useRef, useEffect } from "react"
import { FileText, FileSpreadsheet, Loader2, Download, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CertificateButton } from "@/components/files/certificate-button"

type DownloadType = "pdf" | "csv" | "xlsx"

interface ExportButtonsProps {
  runId: string
  datasetId: string
  criticalCount?: number
  status?: string
}

const TECHNICAL_SECTIONS = [
  { key: "severity_pie", label: "Severity Chart" },
  { key: "severity_breakdown", label: "Severity Breakdown" },
  { key: "issues_by_category", label: "Issues by Category" },
  { key: "issues_by_column", label: "Issues by Column" },
  { key: "kp_density", label: "KP Density" },
  { key: "methodology", label: "Methodology" },
  { key: "soq", label: "Statement of Quality" },
  { key: "detailed_issues", label: "Detailed Issues Table" },
]

const EXECUTIVE_SECTIONS = [
  { key: "severity_pie", label: "Severity Chart" },
  { key: "top_issues", label: "Top Issues" },
  { key: "soq", label: "Statement of Quality" },
]

const COMMENTARY_FIELDS = [
  { key: "executive_summary", label: "Executive Summary Notes" },
  { key: "soq", label: "Statement of Quality Notes" },
]

export function ExportButtons({ runId, datasetId, criticalCount, status }: ExportButtonsProps) {
  const [downloading, setDownloading] = useState<DownloadType | null>(null)
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedMode, setSelectedMode] = useState<"executive" | "technical" | null>(null)
  const [sectionToggles, setSectionToggles] = useState<Record<string, boolean>>({})
  const [commentaryText, setCommentaryText] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
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

  function openDialog(mode: "executive" | "technical") {
    setSelectedMode(mode)
    setPdfMenuOpen(false)

    const sections = mode === "technical" ? TECHNICAL_SECTIONS : EXECUTIVE_SECTIONS
    const toggles: Record<string, boolean> = {}
    for (const s of sections) {
      toggles[s.key] = true
    }
    setSectionToggles(toggles)
    setCommentaryText({})
    setDialogOpen(true)
  }

  async function handleGenerate() {
    if (!selectedMode) return
    setGenerating(true)

    try {
      // Build sections dict
      const sections = { ...sectionToggles }

      // Build commentary dict (only non-empty)
      const commentary: Record<string, string> = {}
      for (const [key, val] of Object.entries(commentaryText)) {
        if (val.trim()) {
          commentary[key] = val.trim()
        }
      }

      const res = await fetch(`/api/reports/pdf?runId=${runId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: selectedMode,
          sections,
          commentary: Object.keys(commentary).length > 0 ? commentary : null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Download failed" }))
        throw new Error(body.error || "Download failed")
      }

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = `qc-${selectedMode}-report-${runId.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error("Export PDF failed:", err)
    } finally {
      setGenerating(false)
      setDialogOpen(false)
    }
  }

  async function handleDownload(type: DownloadType) {
    setDownloading(type)
    try {
      const url = `/api/reports/export?datasetId=${datasetId}&format=${type}&runId=${runId}`

      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Download failed" }))
        throw new Error(body.error || "Download failed")
      }

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = `dataset-annotated.${type}`
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error(`Export ${type} failed:`, err)
    } finally {
      setDownloading(null)
    }
  }

  const activeSections = selectedMode === "technical" ? TECHNICAL_SECTIONS : EXECUTIVE_SECTIONS
  const modeLabel = selectedMode === "executive" ? "Executive" : "Technical"

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Certificate Button */}
        {criticalCount !== undefined && status && (
          <CertificateButton runId={runId} criticalCount={criticalCount} status={status} />
        )}
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
                onClick={() => openDialog("executive")}
              >
                <FileText className="size-4 text-teal-600" />
                Executive Report
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                onClick={() => openDialog("technical")}
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

      {/* Pre-generation Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative mx-3 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:mx-4 sm:max-h-[80vh] sm:p-6">
            {/* Close button */}
            <button
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted"
              onClick={() => setDialogOpen(false)}
            >
              <X className="size-4" />
            </button>

            <h2 className="text-lg font-semibold">
              Configure {modeLabel} Report
            </h2>

            {/* Section Toggles */}
            <p className="mt-4 text-sm font-medium text-muted-foreground">Sections</p>
            <div className="mt-2 space-y-2">
              {activeSections.map((section) => (
                <label
                  key={section.key}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={sectionToggles[section.key] ?? true}
                    onChange={(e) =>
                      setSectionToggles((prev) => ({
                        ...prev,
                        [section.key]: e.target.checked,
                      }))
                    }
                    className="size-4 rounded border-gray-300 accent-teal-600"
                  />
                  <span className="text-sm">{section.label}</span>
                </label>
              ))}
            </div>

            {/* Commentary Fields */}
            <p className="mt-4 text-sm font-medium text-muted-foreground">Commentary</p>
            <div className="mt-2 space-y-3">
              {COMMENTARY_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-sm text-muted-foreground">{field.label}</label>
                  <textarea
                    value={commentaryText[field.key] ?? ""}
                    onChange={(e) =>
                      setCommentaryText((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    placeholder="Add notes for this section..."
                    className="h-16 w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring sm:h-20"
                  />
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setDialogOpen(false)}
                disabled={generating}
              >
                Cancel
              </Button>
              <Button
                className="rounded-xl bg-foreground text-background hover:bg-foreground/90"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Report"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
