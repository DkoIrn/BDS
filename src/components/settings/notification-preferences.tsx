"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/actions/notification-preferences"
import {
  DEFAULT_PREFERENCES,
  type NotificationType,
  type NotificationPreferences as NotificationPreferencesType,
} from "@/lib/types/notifications"

const LABEL_MAP: Record<NotificationType, string> = {
  validation_complete: "Validation Complete",
  validation_failed: "Validation Failed",
  mention: "Mentions",
  comment_resolved: "Comment Resolved",
}

const NOTIFICATION_TYPES: NotificationType[] = [
  "validation_complete",
  "validation_failed",
  "mention",
  "comment_resolved",
]

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferencesType>(DEFAULT_PREFERENCES)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getNotificationPreferences().then((prefs) => {
      setPreferences(prefs)
      setLoaded(true)
    })
  }, [])

  async function handleToggle(
    type: NotificationType,
    channel: "in_app" | "email",
    checked: boolean
  ) {
    const prev = { ...preferences }
    const updated: NotificationPreferencesType = {
      ...preferences,
      [type]: {
        ...preferences[type],
        [channel]: checked,
      },
    }
    setPreferences(updated)

    const result = await updateNotificationPreferences(updated)
    if ("error" in result) {
      setPreferences(prev)
      toast.error("Failed to update preference")
    }
  }

  if (!loaded) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50">
              <Bell className="size-4 text-blue-600" />
            </div>
            Notifications
          </CardTitle>
          <CardDescription>Control how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50">
            <Bell className="size-4 text-blue-600" />
          </div>
          Notifications
        </CardTitle>
        <CardDescription>Control how you receive notifications</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-2 pb-2 text-xs font-medium text-muted-foreground">
            <span>Category</span>
            <span className="w-14 text-center">In-App</span>
            <span className="w-14 text-center">Email</span>
          </div>

          {/* Preference rows */}
          {NOTIFICATION_TYPES.map((type) => (
            <div
              key={type}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/50"
            >
              <span className="text-sm font-medium">{LABEL_MAP[type]}</span>
              <div className="flex w-14 justify-center">
                <Switch
                  checked={preferences[type].in_app}
                  onCheckedChange={(checked) =>
                    handleToggle(type, "in_app", checked)
                  }
                  aria-label={`${LABEL_MAP[type]} in-app notifications`}
                />
              </div>
              <div className="flex w-14 justify-center">
                <Switch
                  checked={preferences[type].email}
                  onCheckedChange={(checked) =>
                    handleToggle(type, "email", checked)
                  }
                  aria-label={`${LABEL_MAP[type]} email notifications`}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
