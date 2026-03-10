"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { createJob } from "@/lib/actions/projects"
import { SURVEY_TYPES } from "@/lib/types/projects"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function CreateJobDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(createJob, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [surveyType, setSurveyType] = useState<string>("")

  useEffect(() => {
    if (state?.success) {
      setOpen(false)
      toast.success("Job created")
      formRef.current?.reset()
      setSurveyType("")
    }
  }, [state])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      formRef.current?.reset()
      setSurveyType("")
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" data-icon="inline-start" />
            New Job
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Survey Job</DialogTitle>
          <DialogDescription>
            Add a new survey job to this project. Choose the survey type to
            define what kind of data you will upload.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="survey_type" value={surveyType} />
          <div className="space-y-2">
            <Label htmlFor="job-name">Name</Label>
            <Input
              id="job-name"
              name="name"
              required
              minLength={3}
              maxLength={100}
              placeholder="Phase 1 DOB Survey"
            />
          </div>
          <div className="space-y-2">
            <Label>Survey Type</Label>
            <Select
              value={surveyType}
              onValueChange={(val) => setSurveyType(val ?? "")}
              required
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select survey type" />
              </SelectTrigger>
              <SelectContent>
                {SURVEY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-description">Description</Label>
            <Textarea
              id="job-description"
              name="description"
              placeholder="Notes about this survey job"
              rows={3}
            />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
