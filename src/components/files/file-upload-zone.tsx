"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useDropzone, type FileRejection } from "react-dropzone"
import {
  Upload,
  CloudUpload,
  FileSpreadsheet,
  FileText,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { createFileRecord } from "@/lib/actions/files"
import type { Dataset, FileUploadItem } from "@/lib/types/files"
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/types/files"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase()
  if (ext === "csv") return FileText
  return FileSpreadsheet
}

interface DuplicateInfo {
  file: File
  existingName: string
}

export function FileUploadZone({
  jobId,
  userId,
  existingFiles,
}: {
  jobId: string
  userId: string
  existingFiles: Dataset[]
}) {
  const router = useRouter()
  const [uploadItems, setUploadItems] = useState<FileUploadItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const abortControllers = useRef<Map<string, AbortController>>(new Map())

  const existingNames = new Set([
    ...existingFiles.map((f) => f.file_name),
    ...uploadItems.map((item) => item.file.name),
  ])

  const addFilesToQueue = useCallback(
    (files: File[]) => {
      const toAdd: File[] = []
      const duplicates: File[] = []

      for (const file of files) {
        if (existingNames.has(file.name)) {
          duplicates.push(file)
        } else {
          toAdd.push(file)
          existingNames.add(file.name)
        }
      }

      if (toAdd.length > 0) {
        const newItems: FileUploadItem[] = toAdd.map((file) => ({
          id: crypto.randomUUID(),
          file,
          status: "queued" as const,
          progress: 0,
        }))
        setUploadItems((prev) => [...prev, ...newItems])
      }

      if (duplicates.length > 0) {
        setPendingFiles(duplicates.slice(1))
        setDuplicateInfo({
          file: duplicates[0],
          existingName: duplicates[0].name,
        })
      }
    },
    [existingNames]
  )

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) {
        addFilesToQueue(accepted)
      }
    },
    [addFilesToQueue]
  )

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    for (const rejection of rejections) {
      const errors = rejection.errors.map((e) => e.message).join(", ")
      toast.error(`${rejection.file.name}: ${errors}`)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } =
    useDropzone({
      onDrop,
      onDropRejected,
      accept: ACCEPTED_FILE_TYPES,
      maxSize: MAX_FILE_SIZE,
      multiple: true,
      noKeyboard: false,
    })

  const removeFromQueue = (id: string) => {
    setUploadItems((prev) => prev.filter((item) => item.id !== id))
  }

  const cancelUpload = (id: string) => {
    const controller = abortControllers.current.get(id)
    if (controller) {
      controller.abort()
      abortControllers.current.delete(id)
    }
    setUploadItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "cancelled" as const } : item
      )
    )
  }

  const retryUpload = async (id: string) => {
    setUploadItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: "queued" as const, progress: 0, error: undefined }
          : item
      )
    )
  }

  const clearNonUploading = () => {
    setUploadItems((prev) => prev.filter((item) => item.status === "uploading"))
  }

  const uploadSingleFile = async (item: FileUploadItem) => {
    const controller = new AbortController()
    abortControllers.current.set(item.id, controller)

    setUploadItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, status: "uploading" as const, progress: 0 } : i
      )
    )

    const storagePath = `${userId}/${jobId}/${Date.now()}-${item.file.name}`

    try {
      const supabase = createClient()

      const { error: storageError } = await supabase.storage
        .from("datasets")
        .upload(storagePath, item.file, {
          cacheControl: "3600",
          upsert: false,
        })

      if (controller.signal.aborted) return

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`)
      }

      const result = await createFileRecord({
        jobId,
        fileName: item.file.name,
        fileSize: item.file.size,
        mimeType: item.file.type || "application/octet-stream",
        storagePath,
      })

      if (controller.signal.aborted) return

      if ("error" in result) {
        // Clean up storage since DB insert failed
        await supabase.storage.from("datasets").remove([storagePath])
        throw new Error(result.error)
      }

      setUploadItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: "uploaded" as const, progress: 100 }
            : i
        )
      )

      // Trigger auto-parse (fire-and-forget so subsequent uploads proceed)
      fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: result.id }),
      }).catch(() => {
        // Parse errors are handled server-side via dataset status
      })
      toast.info(`Parsing started for ${item.file.name}`)
    } catch (err) {
      if (controller.signal.aborted) return

      const message =
        err instanceof Error ? err.message : "Upload failed"
      setUploadItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: "failed" as const, error: message }
            : i
        )
      )
    } finally {
      abortControllers.current.delete(item.id)
    }
  }

  const uploadAll = async () => {
    setIsUploading(true)

    const queued = uploadItems.filter((item) => item.status === "queued")
    for (const item of queued) {
      // Re-check status in case user cancelled during sequential processing
      const current = uploadItems.find((i) => i.id === item.id)
      if (current && current.status === "queued") {
        await uploadSingleFile(item)
      }
    }

    setIsUploading(false)
    router.refresh()
  }

  // Duplicate dialog handlers
  const handleDuplicateReplace = () => {
    if (!duplicateInfo) return
    // Remove existing item from queue if present
    setUploadItems((prev) =>
      prev.filter((item) => item.file.name !== duplicateInfo.file.name)
    )
    // Add the new file
    const newItem: FileUploadItem = {
      id: crypto.randomUUID(),
      file: duplicateInfo.file,
      status: "queued",
      progress: 0,
    }
    setUploadItems((prev) => [...prev, newItem])
    processNextDuplicate()
  }

  const handleDuplicateKeepBoth = () => {
    if (!duplicateInfo) return
    const timestamp = Date.now()
    const parts = duplicateInfo.file.name.split(".")
    const ext = parts.length > 1 ? `.${parts.pop()}` : ""
    const baseName = parts.join(".")
    const renamedName = `${baseName}-${timestamp}${ext}`

    const renamedFile = new File([duplicateInfo.file], renamedName, {
      type: duplicateInfo.file.type,
    })
    const newItem: FileUploadItem = {
      id: crypto.randomUUID(),
      file: renamedFile,
      status: "queued",
      progress: 0,
    }
    setUploadItems((prev) => [...prev, newItem])
    processNextDuplicate()
  }

  const handleDuplicateSkip = () => {
    processNextDuplicate()
  }

  const processNextDuplicate = () => {
    if (pendingFiles.length > 0) {
      const [next, ...rest] = pendingFiles
      setPendingFiles(rest)
      setDuplicateInfo({ file: next, existingName: next.name })
    } else {
      setDuplicateInfo(null)
      setPendingFiles([])
    }
  }

  const hasQueued = uploadItems.some((item) => item.status === "queued")
  const hasItems = uploadItems.length > 0

  // Drop zone styling
  const dropZoneBase =
    "group relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all duration-200 cursor-pointer"
  const dropZoneState = isDragReject
    ? "border-destructive/40 bg-destructive/[0.03]"
    : isDragActive && isDragAccept
      ? "border-primary/40 bg-primary/[0.03]"
      : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"

  return (
    <div className="space-y-4">
      <div {...getRootProps()} className={`${dropZoneBase} ${dropZoneState}`}>
        <input {...getInputProps()} />
        <div className={`rounded-lg p-3 transition-colors duration-200 ${
          isDragActive
            ? "bg-primary/10"
            : "bg-muted group-hover:bg-primary/5"
        }`}>
          <CloudUpload className={`size-6 transition-colors duration-200 ${
            isDragReject
              ? "text-destructive"
              : isDragActive
                ? "text-primary"
                : "text-muted-foreground group-hover:text-primary"
          }`} />
        </div>
        <div className="mt-3 text-center">
          <p className="text-sm font-medium text-foreground">
            {isDragReject
              ? "File type not supported"
              : isDragActive
                ? "Drop to upload"
                : "Drop files here or click to browse"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            CSV, XLS, XLSX up to 50MB
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground/50">
          <span className="rounded bg-muted px-1.5 py-0.5">.csv</span>
          <span className="rounded bg-muted px-1.5 py-0.5">.xls</span>
          <span className="rounded bg-muted px-1.5 py-0.5">.xlsx</span>
        </div>
      </div>

      {hasItems && (
        <div className="space-y-3 animate-fade-up">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {uploadItems.length} file{uploadItems.length !== 1 ? "s" : ""} queued
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearNonUploading}
                disabled={isUploading}
                className="text-muted-foreground"
              >
                Clear
              </Button>
              {hasQueued && (
                <Button size="sm" onClick={uploadAll} disabled={isUploading} className="gap-1.5">
                  {isUploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  Upload{uploadItems.filter(i => i.status === "queued").length > 1 ? " All" : ""}
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg border divide-y">
            {uploadItems.map((item) => {
              const FileIcon = getFileIcon(item.file.name)
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    {item.status === "uploaded" ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : item.status === "uploading" ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : item.status === "failed" ? (
                      <AlertCircle className="size-4 text-destructive" />
                    ) : (
                      <FileIcon className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(item.file.size)}
                      </span>
                      {item.status === "uploading" && (
                        <span className="text-xs text-muted-foreground">Uploading...</span>
                      )}
                      {item.status === "uploaded" && (
                        <span className="text-xs text-emerald-600">Done</span>
                      )}
                      {item.status === "failed" && item.error && (
                        <span className="text-xs text-destructive">{item.error}</span>
                      )}
                    </div>
                    {item.status === "uploading" && (
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full animate-pulse rounded-full bg-primary/40" style={{ width: "100%" }} />
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {(item.status === "queued" || item.status === "uploading") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => item.status === "queued" ? removeFromQueue(item.id) : cancelUpload(item.id)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    )}
                    {(item.status === "failed" || item.status === "cancelled") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => retryUpload(item.id)}
                      >
                        <RotateCcw className="size-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Duplicate file dialog */}
      <Dialog
        open={duplicateInfo !== null}
        onOpenChange={(open) => {
          if (!open) handleDuplicateSkip()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate File</DialogTitle>
            <DialogDescription>
              A file named &quot;{duplicateInfo?.existingName}&quot; already
              exists. What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={handleDuplicateSkip}>
              Skip
            </Button>
            <Button variant="outline" onClick={handleDuplicateKeepBoth}>
              Keep Both
            </Button>
            <Button onClick={handleDuplicateReplace}>Replace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
