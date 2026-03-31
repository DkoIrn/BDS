"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { createProject } from "@/lib/actions/projects"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(createProject, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success) {
      setOpen(false)
      toast.success("Project created")
      formRef.current?.reset()
    }
  }, [state])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      formRef.current?.reset()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-xl">
            <Plus className="size-4" data-icon="inline-start" />
            New Project
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <DialogDescription>
            Add a new survey project to organize your jobs and datasets.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              name="name"
              required
              minLength={3}
              maxLength={100}
              placeholder="Pipeline Survey - North Sea Block 21"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              name="description"
              placeholder="Notes about project scope or client"
              rows={3}
            />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
