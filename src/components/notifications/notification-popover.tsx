"use client"

import { Bell } from "lucide-react"
import { NotificationItem } from "./notification-item"
import type { NotificationWithActor } from "@/lib/types/notifications"

interface NotificationPopoverProps {
  notifications: NotificationWithActor[]
  onMarkAllRead: () => void
  onItemClick: (notification: NotificationWithActor) => void
  hasUnread: boolean
}

export function NotificationPopover({
  notifications,
  onMarkAllRead,
  onItemClick,
  hasUnread,
}: NotificationPopoverProps) {
  return (
    <div className="w-80 rounded-xl border bg-popover shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
        {hasUnread && (
          <button
            onClick={onMarkAllRead}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Body */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4">
            <Bell className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div className="py-1">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={onItemClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
