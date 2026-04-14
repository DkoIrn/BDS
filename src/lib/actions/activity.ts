'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'
import type {
  ActivityEventType,
  ActivityEventWithActor,
} from '@/lib/types/activity'

/**
 * Log an activity event. Fire-and-forget safe -- never throws.
 * Call this from other server actions after notable actions complete.
 */
export async function logActivity(params: {
  projectId: string
  orgId: string
  actorId: string
  eventType: ActivityEventType
  summary: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('activity_events').insert({
      project_id: params.projectId,
      org_id: params.orgId,
      actor_id: params.actorId,
      event_type: params.eventType,
      summary: params.summary,
      resource_type: params.resourceType ?? null,
      resource_id: params.resourceId ?? null,
      metadata: params.metadata ?? {},
    })

    if (error) {
      console.error('[activity] Failed to log activity event:', error)
    }
  } catch (err) {
    console.error('[activity] Unexpected error logging activity:', err)
  }
}

/**
 * Fetch project activity events with actor join and pagination.
 * Returns events ordered by created_at DESC, limited to `limit` (default 20).
 * Use `before` cursor for pagination (pass the created_at of the last item).
 */
export async function getProjectActivity(
  projectId: string,
  options?: { limit?: number; before?: string }
): Promise<ActivityEventWithActor[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const roleResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in roleResult) return []

  const limit = options?.limit ?? 20

  let query = supabase
    .from('activity_events')
    .select('*, actor:actor_id(full_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options?.before) {
    query = query.lt('created_at', options.before)
  }

  const { data, error } = await query

  if (error) {
    console.error('[activity] Failed to fetch project activity:', error)
    return []
  }

  return (data ?? []) as ActivityEventWithActor[]
}
