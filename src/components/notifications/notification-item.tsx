"use client"

import { CheckCircle2, XCircle, AtSign, MessageSquareCheck } from "lucide-react"
import type { NotificationWithActor, NotificationType } from "@/lib/types/notifications"

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 60) return "just now"
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const typeIcons: Record<NotificationType, typeof CheckCircle2> = {
  validation_complete: CheckCircle2,
  validation_failed: XCircle,
  mention: AtSign,
  comment_resolved: MessageSquareCheck,
}

const typeColors: Record<NotificationType, string> = {
  validation_complete: "text-emerald-500",
  validation_failed: "text-destructive",
  mention: "text-blue-500",
  comment_resolved: "text-violet-500",
}

interface NotificationItemProps {
  notification: NotificationWithActor
  onClick: (notification: NotificationWithActor) => void
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const Icon = typeIcons[notification.type]
  const iconColor = typeColors[notification.type]
  const actorName = notification.actor_profile?.full_name || "System"

  return (
    <button
      onClick={() => onClick(notification)}
      className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/60 cursor-pointer ${
        notification.read ? "bg-transparent" : "bg-accent/50"
      }`}
    >
      <Icon className={`mt-0.5 size-4 shrink-0 ${iconColor}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground truncate">
            {actorName}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {relativeTime(notification.created_at)}
          </span>
        </div>
        <p className="text-xs text-foreground/80 line-clamp-1">
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
            {notification.body}
          </p>
        )}
      </div>
      {!notification.read && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />
      )}
    </button>
  )
}
