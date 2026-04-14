"use client"

import {
  CheckCircle2,
  XCircle,
  Wrench,
  MessageSquare,
  CheckSquare,
  FileDown,
  Award,
  Upload,
} from "lucide-react"
import type { ActivityEventWithActor } from "@/lib/types/activity"
import type { ActivityEventType } from "@/lib/types/activity"
import type { LucideIcon } from "lucide-react"

const EVENT_CONFIG: Record<
  ActivityEventType,
  { icon: LucideIcon; color: string }
> = {
  validation_run: { icon: CheckCircle2, color: "text-emerald-500" },
  validation_failed: { icon: XCircle, color: "text-red-500" },
  cleaning_applied: { icon: Wrench, color: "text-amber-500" },
  comment_added: { icon: MessageSquare, color: "text-blue-500" },
  comment_resolved: { icon: CheckSquare, color: "text-teal-500" },
  report_exported: { icon: FileDown, color: "text-violet-500" },
  certificate_generated: { icon: Award, color: "text-indigo-500" },
  dataset_uploaded: { icon: Upload, color: "text-sky-500" },
}

function relativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.max(0, now - then)
  const seconds = Math.floor(diff / 1000)

  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

interface ActivityItemProps {
  event: ActivityEventWithActor
  isLast?: boolean
}

export function ActivityItem({ event, isLast = false }: ActivityItemProps) {
  const config = EVENT_CONFIG[event.event_type] ?? EVENT_CONFIG.validation_run
  const Icon = config.icon
  const actorName = event.actor?.full_name ?? "System"

  return (
    <div className="flex gap-3">
      {/* Timeline column */}
      <div className="flex flex-col items-center">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-muted ${config.color}`}
        >
          <Icon className="size-4" />
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-border" />
        )}
      </div>

      {/* Content column */}
      <div className="pb-6">
        <p className="text-sm">
          <span className="font-semibold">{actorName}</span>{" "}
          {event.summary}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {relativeTime(event.created_at)}
        </p>
      </div>
    </div>
  )
}
