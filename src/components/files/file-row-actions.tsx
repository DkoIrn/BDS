"use client"

import { useState } from "react"
import { MoreHorizontal, Download, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeleteFileDialog } from "@/components/files/delete-file-dialog"
import { getDownloadUrl } from "@/lib/actions/files"

export function FileRowActions({
  fileId,
  fileName,
}: {
  fileId: string
  fileName: string
}) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const result = await getDownloadUrl(fileId)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      window.open(result.url, "_blank")
    } catch {
      toast.error("Failed to generate download URL")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8" />
          }
        >
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Actions</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            Download
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteFileDialog
        fileId={fileId}
        fileName={fileName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}
