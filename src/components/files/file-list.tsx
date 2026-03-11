"use client"

import { FileSpreadsheet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FileRowActions } from "@/components/files/file-row-actions"
import type { Dataset } from "@/lib/types/files"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function FileList({
  files,
  jobId,
}: {
  files: Dataset[]
  jobId: string
}) {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
        <FileSpreadsheet className="size-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          No files uploaded yet
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File Name</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Uploaded</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((file) => (
          <TableRow key={file.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">{file.file_name}</span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatFileSize(file.file_size)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(file.created_at)}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">
                {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
              </Badge>
            </TableCell>
            <TableCell>
              <FileRowActions fileId={file.id} fileName={file.file_name} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
