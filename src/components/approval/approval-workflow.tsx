"use client"

import { useState, useTransition } from "react"
import { Loader2, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { updateApprovalStatus } from "@/lib/actions/approval"
import { canTransition } from "@/lib/types/organisations"
import { hasPermission } from "@/lib/permissions"
import { APPROVAL_STATUSES } from "@/lib/types/organisations"
import type { ApprovalStatus, OrgRole } from "@/lib/types/organisations"

const STATUS_STYLES: Record<ApprovalStatus, { badge: string; pill: string }> = {
  draft: {
    badge: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
    pill: "bg-gray-200 dark:bg-gray-700",
  },
  reviewed: {
    badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300",
    pill: "bg-blue-200 dark:bg-blue-700",
  },
  approved: {
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300",
    pill: "bg-emerald-200 dark:bg-emerald-700",
  },
  issued: {
    badge: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900 dark:text-violet-300",
    pill: "bg-violet-200 dark:bg-violet-700",
  },
}

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  approved: "Approved",
  issued: "Issued",
}

interface ApprovalWorkflowProps {
  datasetId: string
  currentStatus: ApprovalStatus
  userRole: OrgRole
  revalidatePath?: string
}

export function ApprovalWorkflow({
  datasetId,
  currentStatus,
  userRole,
  revalidatePath: revalidateTo,
}: ApprovalWorkflowProps) {
  const [status, setStatus] = useState<ApprovalStatus>(currentStatus)
  const [isPending, startTransition] = useTransition()
  const [pendingTarget, setPendingTarget] = useState<ApprovalStatus | null>(null)

  const canApprove = hasPermission(userRole, "approve_datasets")

  function handleTransition(newStatus: ApprovalStatus) {
    setPendingTarget(newStatus)
    startTransition(async () => {
      const result = await updateApprovalStatus(datasetId, newStatus, revalidateTo)
      if ("success" in result) {
        setStatus(newStatus)
        toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`)
      } else {
        toast.error(result.error)
      }
      setPendingTarget(null)
    })
  }

  // Build valid next transitions
  const validTransitions = APPROVAL_STATUSES.filter((s) =>
    canTransition(status, s)
  )

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status progression pills */}
      <div className="flex items-center gap-1">
        {APPROVAL_STATUSES.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <Badge
              variant="outline"
              className={`rounded-md text-[10px] font-semibold ${
                s === status
                  ? STATUS_STYLES[s].badge
                  : "border-transparent bg-muted/50 text-muted-foreground"
              }`}
            >
              {STATUS_LABELS[s]}
            </Badge>
            {i < APPROVAL_STATUSES.length - 1 && (
              <ArrowRight className="size-3 text-muted-foreground/40" />
            )}
          </div>
        ))}
      </div>

      {/* Transition buttons */}
      {canApprove && validTransitions.length > 0 && (
        <div className="flex items-center gap-1.5">
          {validTransitions.map((next) => (
            <Button
              key={next}
              size="sm"
              variant="outline"
              onClick={() => handleTransition(next)}
              disabled={isPending}
              className="h-7 gap-1.5 rounded-lg px-2.5 text-[11px] font-medium"
            >
              {isPending && pendingTarget === next && (
                <Loader2 className="size-3 animate-spin" />
              )}
              {next === "draft" ? "Revert to Draft" : `Mark ${STATUS_LABELS[next]}`}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
