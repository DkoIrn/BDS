"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardCheck } from "lucide-react"
import type { PipelineState, PipelineAction } from "../lib/pipeline-state"
import type { ValidationIssue } from "../lib/client-validate"

interface StageReviewProps {
  state: PipelineState
  dispatch: React.Dispatch<PipelineAction>
  validationIssues: ValidationIssue[]
}

export function StageReview({ state, dispatch, validationIssues }: StageReviewProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-5" />
          Review Issues
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {validationIssues.length} issues to review. Full UI coming in next plan.
        </p>
      </CardContent>
    </Card>
  )
}
