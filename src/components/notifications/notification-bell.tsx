"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { Popover } from "@base-ui/react/popover"
import { getNotifications, getUnreadCount, markRead, markAllRead } from "@/lib/actions/notifications"
import { NotificationPopover } from "./notification-popover"
import type { NotificationWithActor } from "@/lib/types/notifications"

interface NotificationBellProps {
  userId: string
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationWithActor[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const fetchedRef = useRef(false)

  // Initial fetch
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    Promise.all([getUnreadCount(), getNotifications(20)]).then(
      ([count, notifs]) => {
        setUnreadCount(count)
        setNotifications(notifs)
      }
    )
  }, [])

  // Reconcile on window focus (Pitfall 6)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        getUnreadCount().then(setUnreadCount)
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [])

  // Listen for real-time new notifications via custom event
  useEffect(() => {
    function handleNewNotification(e: Event) {
      const detail = (e as CustomEvent).detail as NotificationWithActor
      if (!detail) return
      setNotifications((prev) => [detail, ...prev].slice(0, 20))
      setUnreadCount((prev) => prev + 1)
    }
    window.addEventListener("truqc:new-notification", handleNewNotification)
    return () => window.removeEventListener("truqc:new-notification", handleNewNotification)
  }, [])

  const handleItemClick = useCallback(
    async (notification: NotificationWithActor) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, read: true } : n
        )
      )
      if (!notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
      setIsOpen(false)

      // Server call
      await markRead(notification.id)

      // Navigate
      if (notification.link_url) {
        router.push(notification.link_url)
      }
    },
    [router]
  )

  const handleMarkAllRead = useCallback(async () => {
    // Optimistic
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)

    await markAllRead()
  }, [])

  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount)

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger
        className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/60 cursor-pointer"
        data-tutorial="notifications"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
            {badgeLabel}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50 outline-none">
          <Popover.Popup className="origin-(--transform-origin) data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-100">
            <NotificationPopover
              notifications={notifications}
              onMarkAllRead={handleMarkAllRead}
              onItemClick={handleItemClick}
              hasUnread={unreadCount > 0}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
