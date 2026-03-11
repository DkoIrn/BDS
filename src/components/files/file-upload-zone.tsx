"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useDropzone, type FileRejection } from "react-dropzone"
import {
  Upload,
  FileSpreadsheet,
  X,
  Check,
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
  let dropZoneClass =
    "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors"
  if (isDragReject) {
    dropZoneClass += " border-destructive bg-destructive/5"
  } else if (isDragActive && isDragAccept) {
    dropZoneClass += " border-teal-500 bg-teal-50 dark:bg-teal-950/20"
  } else {
    dropZoneClass += " border-muted-foreground/25 bg-muted/50 hover:border-muted-foreground/50"
  }

  return (
    <div className="space-y-4">
      <div {...getRootProps()} className={dropZoneClass}>
        <input {...getInputProps()} />
        <Upload className="size-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">
          {isDragReject
            ? "File type not accepted"
            : isDragActive
              ? "Drop files here"
              : "Drag and drop files here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          CSV, XLS, XLSX - Max 50MB per file
        </p>
      </div>

      {hasItems && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {uploadItems.length} file{uploadItems.length !== 1 ? "s" : ""} in
              queue
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearNonUploading}
                disabled={isUploading}
              >
                Clear All
              </Button>
              {hasQueued && (
                <Button size="sm" onClick={uploadAll} disabled={isUploading}>
                  {isUploading && (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  )}
                  Upload All
                </Button>
              )}
            </div>
          </div>

          <div className="divide-y rounded-lg border">
            {uploadItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-3 py-2"
              >
                <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.file.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(item.file.size)}
                    </span>
                    {item.status === "failed" && item.error && (
                      <span className="text-xs text-destructive">
                        {item.error}
                      </span>
                    )}
                    {item.status === "cancelled" && (
                      <span className="text-xs text-muted-foreground">
                        Cancelled
                      </span>
                    )}
                  </div>
                  {item.status === "uploading" && (
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full animate-pulse rounded-full bg-primary" style={{ width: "100%" }} />
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {item.status === "queued" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => removeFromQueue(item.id)}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                  {item.status === "uploading" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => cancelUpload(item.id)}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                  {item.status === "uploaded" && (
                    <Check className="size-5 text-green-600" />
                  )}
                  {item.status === "failed" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => retryUpload(item.id)}
                    >
                      <RotateCcw className="size-4 text-destructive" />
                    </Button>
                  )}
                  {item.status === "cancelled" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => retryUpload(item.id)}
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
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
