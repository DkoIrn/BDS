"use client"

import { useEffect, useState, useCallback } from "react"
import { Clock } from "lucide-react"
import { getProjectActivity } from "@/lib/actions/activity"
import { ActivityItem } from "@/components/activity/activity-item"
import { ActivityFilters } from "@/components/activity/activity-filters"
import { Button } from "@/components/ui/button"
import type { ActivityEventWithActor, ActivityEventType } from "@/lib/types/activity"

const ALL_TYPES: ActivityEventType[] = [
  "validation_run",
  "validation_failed",
  "cleaning_applied",
  "comment_added",
  "comment_resolved",
  "report_exported",
  "certificate_generated",
  "dataset_uploaded",
]

const PAGE_SIZE = 20

interface ActivityFeedProps {
  projectId: string
}

export function ActivityFeed({ projectId }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEventWithActor[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Set<ActivityEventType>>(
    () => new Set(ALL_TYPES)
  )

  const fetchInitial = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getProjectActivity(projectId, { limit: PAGE_SIZE })
      setEvents(data)
      setHasMore(data.length === PAGE_SIZE)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchInitial()
  }, [fetchInitial])

  async function loadMore() {
    if (events.length === 0) return
    setLoadingMore(true)
    try {
      const last = events[events.length - 1]
      const data = await getProjectActivity(projectId, {
        limit: PAGE_SIZE,
        before: last.created_at,
      })
      setEvents((prev) => [...prev, ...data])
      setHasMore(data.length === PAGE_SIZE)
    } finally {
      setLoadingMore(false)
    }
  }

  const filteredEvents = events.filter((e) =>
    activeFilters.has(e.event_type)
  )

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="size-8 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Clock className="size-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-sm font-semibold">No activity yet</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Activity will appear here as your team works on this project
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ActivityFilters
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
      />

      <div>
        {filteredEvents.map((event, index) => (
          <ActivityItem
            key={event.id}
            event={event}
            isLast={index === filteredEvents.length - 1}
          />
        ))}

        {filteredEvents.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No events match the selected filters
          </p>
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  )
}
