"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Download,
  Loader2,
  Check,
  FileText,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  FolderPlus,
  ChevronDown,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { clearPipelineState } from "../lib/pipeline-store"
import { SURVEY_TYPES } from "@/lib/types/projects"
import { logAuditClient } from "@/lib/audit-client"
import type { PipelineState, PipelineAction } from "../lib/pipeline-state"

import type { ValidationIssue } from "../lib/client-validate"

interface StageExportProps {
  state: PipelineState
  dispatch: React.Dispatch<PipelineAction>
  fileRef: React.MutableRefObject<File | null>
  userId: string
  validationIssues: ValidationIssue[]
}

const EXPORT_FORMATS = [
  { id: "csv", label: "CSV", ext: ".csv", description: "Comma-separated values" },
  { id: "geojson", label: "GeoJSON", ext: ".geojson", description: "Geographic JSON" },
  { id: "kml", label: "KML", ext: ".kml", description: "Keyhole Markup Language" },
] as const

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getDefaultFormat(fileName: string | null): string {
  if (!fileName) return "csv"
  const ext = fileName.substring(fileName.lastIndexOf(".")).toLowerCase()
  const match = EXPORT_FORMATS.find((f) => f.ext === ext)
  return match?.id || "csv"
}

export function StageExport({ state, dispatch, fileRef, userId, validationIssues }: StageExportProps) {
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [downloadedFilename, setDownloadedFilename] = useState<string | null>(null)
  const [downloadedSize, setDownloadedSize] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  // Set default format if not set
  useEffect(() => {
    if (!state.exportFormat) {
      dispatch({
        type: "SET_EXPORT_FORMAT",
        format: getDefaultFormat(state.fileName),
      })
    }
  }, [state.exportFormat, state.fileName, dispatch])

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => revokeBlobUrl()
  }, [revokeBlobUrl])

  function triggerDownload(url: string, filename: string) {
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function handleDownload() {
    if (!state.exportFormat) return

    setDownloading(true)
    setError(null)
    revokeBlobUrl()

    try {
      const formData = new FormData()

      if (fileRef.current) {
        formData.append("file", fileRef.current)
      } else if (state.datasetId) {
        // For existing datasets without a file ref, fetch the file first
        const { getDatasetSignedUrl } = await import("@/lib/actions/files")
        const result = await getDatasetSignedUrl(state.datasetId)
        if ("error" in result) throw new Error(result.error)

        const response = await fetch(result.url)
        const blob = await response.blob()
        const file = new File([blob], result.fileName)
        formData.append("file", file)
      } else if (state.parsedData && state.parsedData.length > 0) {
        // Reconstruct CSV from parsed data (e.g. after session restore when fileRef is lost)
        const csvContent = state.parsedData
          .map((row) =>
            row.map((cell) => {
              if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
                return `"${cell.replace(/"/g, '""')}"`
              }
              return cell
            }).join(",")
          )
          .join("\n")
        const blob = new Blob([csvContent], { type: "text/csv" })
        const file = new File([blob], state.fileName || "export.csv")
        formData.append("file", file)
      } else {
        throw new Error("No file available for export")
      }

      formData.append("target_format", state.exportFormat)

      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(
          errorData?.error || `Export failed (${response.status})`
        )
      }

      const contentDisposition =
        response.headers.get("Content-Disposition") || ""
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
      const outputFilename =
        filenameMatch?.[1] ||
        `${(state.fileName || "export").replace(/\.[^.]+$/, "")}.${state.exportFormat}`

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      blobUrlRef.current = blobUrl

      triggerDownload(blobUrl, outputFilename)

      setDownloadedFilename(outputFilename)
      setDownloadedSize(blob.size)
      setDownloaded(true)

      logAuditClient({
        action: "export.download",
        entityType: "dataset",
        entityId: state.datasetId ?? undefined,
        metadata: {
          fileName: state.fileName,
          outputFilename,
          format: state.exportFormat,
          fileSize: blob.size,
          rowCount: state.rowCount,
          wasClean: state.stages.clean.completed,
        },
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Export failed"
      setError(message)
    } finally {
      setDownloading(false)
    }
  }

  function handleReset() {
    clearPipelineState()
    dispatch({ type: "RESET" })
  }

  // Pipeline complete state
  if (downloaded) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="size-5 text-green-600" />
            Pipeline Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Download success */}
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
            <Check className="size-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                Downloaded: {downloadedFilename}
              </p>
              {downloadedSize && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  {formatFileSize(downloadedSize)}
                </p>
              )}
            </div>
          </div>

          {/* Re-download */}
          {blobUrlRef.current && downloadedFilename && (
            <Button
              variant="outline"
              onClick={() =>
                triggerDownload(blobUrlRef.current!, downloadedFilename!)
              }
              className="w-full"
            >
              <Download className="mr-2 size-4" />
              Download Again
            </Button>
          )}

          {/* QC Report download */}
          {state.validationRunId && state.datasetId && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                window.open(
                  `/api/reports/pdf?dataset_id=${state.datasetId}`,
                  "_blank"
                )
              }}
            >
              <FileText className="mr-2 size-4" />
              Download QC Report (PDF)
            </Button>
          )}

          {/* Stage summary */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pipeline Summary
            </p>
            <div className="space-y-2 text-sm">
              <SummaryRow label="Import" value={state.stages.import.summary} />
              <SummaryRow label="Inspect" value={state.stages.inspect.summary} />
              <SummaryRow
                label="Validate"
                value={state.stages.validate.summary}
                warning={state.stages.validate.skipped}
              />
              <SummaryRow
                label="Clean"
                value={state.stages.clean.summary}
                warning={state.stages.clean.skipped}
              />
              <SummaryRow label="Export" value={downloadedFilename} />
            </div>
          </div>

          {/* Save to Project */}
          <SaveToProject
            state={state}
            userId={userId}
            fileRef={fileRef}
            validationIssues={validationIssues}
          />

          <button
            onClick={handleReset}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <RefreshCw className="size-3.5" />
            Start New Pipeline
          </button>
        </CardContent>
      </Card>
    )
  }

  // Export form
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="size-5" />
          Export Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Format selection */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Output Format</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {EXPORT_FORMATS.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() =>
                  dispatch({ type: "SET_EXPORT_FORMAT", format: fmt.id })
                }
                className={`rounded-xl border p-4 text-left transition-all ${
                  state.exportFormat === fmt.id
                    ? "border-foreground bg-foreground/5 ring-1 ring-foreground"
                    : "border-border bg-card hover:border-foreground/40"
                }`}
              >
                <p className="text-sm font-medium">{fmt.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {fmt.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() =>
              dispatch({ type: "GO_TO_STAGE", stage: "clean" })
            }
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
          <button
            onClick={handleDownload}
            disabled={!state.exportFormat || downloading}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="size-4" />
                Download Dataset
              </>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryRow({
  label,
  value,
  warning,
}: {
  label: string
  value: string | null
  warning?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={warning ? "text-amber-600 dark:text-amber-400" : ""}>
        {value || "--"}
      </span>
    </div>
  )
}

// --- Save to Project ---

type SaveStep = "prompt" | "form" | "saving" | "saved"

function SaveToProject({
  state,
  userId,
  fileRef,
  validationIssues,
}: {
  state: PipelineState
  userId: string
  fileRef: React.MutableRefObject<File | null>
  validationIssues: ValidationIssue[]
}) {
  const [step, setStep] = useState<SaveStep>("prompt")
  const [projectName, setProjectName] = useState("")
  const [jobName, setJobName] = useState("")
  const [surveyType, setSurveyType] = useState("General")
  const [error, setError] = useState<string | null>(null)
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null)

  // Pre-fill from filename
  useEffect(() => {
    if (state.fileName) {
      const baseName = state.fileName.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")
      setJobName(baseName)
    }
  }, [state.fileName])

  async function handleSave() {
    if (projectName.trim().length < 3) {
      setError("Project name must be at least 3 characters")
      return
    }
    if (jobName.trim().length < 3) {
      setError("Job name must be at least 3 characters")
      return
    }

    setStep("saving")
    setError(null)

    try {
      // 1. Create project
      const projectForm = new FormData()
      projectForm.set("name", projectName.trim())
      const { createProject } = await import("@/lib/actions/projects")
      const projectResult = await createProject(null, projectForm)
      if ("error" in projectResult) throw new Error(projectResult.error)

      // Get the project ID from the DB (most recent project by this user)
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: projects } = await supabase
        .from("projects")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)

      const projectId = projects?.[0]?.id
      if (!projectId) throw new Error("Failed to retrieve project")

      // 2. Create job
      const jobForm = new FormData()
      jobForm.set("name", jobName.trim())
      jobForm.set("survey_type", surveyType)
      jobForm.set("project_id", projectId)
      const { createJob } = await import("@/lib/actions/projects")
      const jobResult = await createJob(null, jobForm)
      if ("error" in jobResult) throw new Error(jobResult.error)

      // Get the job ID
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)

      const jobId = jobs?.[0]?.id
      if (!jobId) throw new Error("Failed to retrieve job")

      // 3. Build the file to upload
      let file: File | null = fileRef.current

      if (!file && state.parsedData && state.parsedData.length > 0) {
        // Reconstruct from parsed data
        const csvContent = state.parsedData
          .map((row) =>
            row.map((cell) => {
              if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
                return `"${cell.replace(/"/g, '""')}"`
              }
              return cell
            }).join(",")
          )
          .join("\n")
        const blob = new Blob([csvContent], { type: "text/csv" })
        file = new File([blob], state.fileName || "pipeline-export.csv")
      }

      if (!file) throw new Error("No file available to save")

      // 4. Upload to Supabase Storage
      const storagePath = `${userId}/${jobId}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from("datasets")
        .upload(storagePath, file)

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      // 5. Create file record
      const { createFileRecord } = await import("@/lib/actions/files")
      const fileResult = await createFileRecord({
        jobId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "text/csv",
        storagePath,
      })

      if ("error" in fileResult) throw new Error(fileResult.error)

      // 6. Trigger parse (fire-and-forget)
      fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: fileResult.id }),
      }).catch(() => {})

      // 7. Save pipeline validation results if we ran validation
      if (validationIssues.length > 0 || state.stages.validate.completed) {
        fetch("/api/pipeline-validation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datasetId: fileResult.id,
            issues: validationIssues.map((i) => ({
              type: i.type,
              severity: i.severity,
              row: i.row,
              column: i.column,
              message: i.message,
              detail: i.detail,
            })),
            totalRows: state.rowCount ?? 0,
            cleanActionCount: state.cleanActionCount ?? 0,
          }),
        }).catch(() => {})
      }

      setSavedProjectId(projectId)
      setStep("saved")

      logAuditClient({
        action: "dataset.save_to_project",
        entityType: "dataset",
        metadata: {
          projectName: projectName.trim(),
          jobName: jobName.trim(),
          surveyType,
          fileName: state.fileName,
          rowCount: state.rowCount,
          hadValidation: state.stages.validate.completed,
          hadCleaning: state.stages.clean.completed,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
      setStep("form")
    }
  }

  // Prompt — collapsed state
  if (step === "prompt") {
    return (
      <button
        onClick={() => setStep("form")}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border/60 p-4 text-left transition-all hover:border-solid hover:border-border hover:bg-muted/40"
      >
        <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50">
          <FolderPlus className="size-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Save to Project</p>
          <p className="text-xs text-muted-foreground">
            Keep this dataset organized for future QC runs and reports
          </p>
        </div>
      </button>
    )
  }

  // Saving state
  if (step === "saving") {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <div className="relative flex size-8 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <FolderPlus className="size-3.5 text-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">Saving to project...</p>
          <p className="text-xs text-muted-foreground">
            Creating project, uploading file, triggering parse
          </p>
        </div>
      </div>
    )
  }

  // Saved state
  if (step === "saved" && savedProjectId) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
        <div className="flex items-center gap-2">
          <Check className="size-4 text-green-600 dark:text-green-400" />
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            Saved to project
          </p>
        </div>
        <p className="mt-1 text-xs text-green-600 dark:text-green-400">
          {projectName} / {jobName}
        </p>
        <a
          href={`/projects/${savedProjectId}`}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-green-700 underline hover:text-green-900 dark:text-green-300 dark:hover:text-green-100"
        >
          View Project
          <ExternalLink className="size-3" />
        </a>
      </div>
    )
  }

  // Form state
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <FolderPlus className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Save to Project</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Project Name
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g., Pipeline Route Survey 2026"
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Job Name
          </label>
          <input
            type="text"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="e.g., DOB Survey Line 1"
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Survey Type
          </label>
          <select
            value={surveyType}
            onChange={(e) => setSurveyType(e.target.value)}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          >
            {SURVEY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setStep("prompt")}>
          Cancel
        </Button>
        <button
          onClick={handleSave}
          disabled={!projectName.trim() || !jobName.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          <FolderPlus className="size-3.5" />
          Save
        </button>
      </div>
    </div>
  )
}
