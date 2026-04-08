"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
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
import { deleteProject } from "@/lib/actions/projects"

export function DeleteProjectDialog({
  projectId,
  projectIds,
  projectName,
  open,
  onOpenChange,
}: {
  projectId?: string
  projectIds?: string[]
  projectName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const ids = projectIds ?? (projectId ? [projectId] : [])
  const isBulk = ids.length > 1

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      let failed = 0
      for (const id of ids) {
        const result = await deleteProject(id)
        if ("error" in result) failed++
      }

      if (failed > 0) {
        toast.error(`Failed to delete ${failed} project${failed !== 1 ? "s" : ""}`)
      } else {
        toast.success(isBulk ? `${ids.length} projects deleted` : "Project deleted")
      }
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error("Failed to delete project" + (isBulk ? "s" : ""))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {isBulk ? "Projects" : "Project"}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {isBulk ? `${ids.length} projects` : <>&quot;{projectName}&quot;</>}? This will
            also delete all jobs and uploaded files. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="mr-1 size-4 animate-spin" />}
            Delete{isBulk ? ` ${ids.length} projects` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
