'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'
import { sendNotificationEmail } from '@/lib/email'
import { DEFAULT_PREFERENCES } from '@/lib/types/notifications'
import type {
  NotificationType,
  NotificationPreferences,
  NotificationWithActor,
} from '@/lib/types/notifications'

/**
 * Fetch notifications for the current user, ordered by most recent.
 * Joins actor profile for display name.
 */
export async function getNotifications(
  limit: number = 20
): Promise<NotificationWithActor[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const roleResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in roleResult) return []

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []

  // Fetch actor names separately (profiles RLS blocks cross-user joins)
  const notifications = (data ?? []) as NotificationWithActor[]
  const actorIds = [...new Set(notifications.map((n) => n.actor_id).filter(Boolean))]

  if (actorIds.length > 0) {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const admin = createServiceClient()
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', actorIds)

    const profileMap = new Map((profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]))
    for (const n of notifications) {
      if (n.actor_id && profileMap.has(n.actor_id)) {
        n.actor_profile = { full_name: profileMap.get(n.actor_id)! }
      }
    }
  }

  return notifications
}

/**
 * Get count of unread notifications for current user.
 */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return 0

  const roleResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in roleResult) return 0

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false)

  if (error) return 0

  return count ?? 0
}

/**
 * Mark a single notification as read.
 */
export async function markRead(
  notificationId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)

  if (error) return { error: 'Failed to mark notification as read' }

  return { success: true }
}

/**
 * Mark all unread notifications as read for current user.
 */
export async function markAllRead(): Promise<
  { success: true } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)

  if (error) return { error: 'Failed to mark notifications as read' }

  return { success: true }
}

/**
 * Create a notification. Used internally by other server actions
 * (e.g. when resolving a comment or @mentioning someone).
 */
export async function createNotification(params: {
  userId: string
  orgId: string
  type: NotificationType
  title: string
  body?: string
  resourceType?: 'dataset' | 'issue' | 'comment'
  resourceId?: string
  linkUrl?: string
  actorId?: string
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()

  // Fetch user preferences (defaults to all-on if no row exists)
  let preferences: NotificationPreferences = DEFAULT_PREFERENCES
  const { data: prefRow } = await supabase
    .from('notification_preferences')
    .select('preferences')
    .eq('user_id', params.userId)
    .maybeSingle()

  if (prefRow?.preferences) {
    preferences = prefRow.preferences as NotificationPreferences
  }

  const typePrefs = preferences[params.type] ?? { in_app: true, email: true }

  // Only insert notification row if in-app is enabled
  if (typePrefs.in_app) {
    const { error } = await supabase.from('notifications').insert({
      user_id: params.userId,
      org_id: params.orgId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      resource_type: params.resourceType ?? null,
      resource_id: params.resourceId ?? null,
      link_url: params.linkUrl ?? null,
      actor_id: params.actorId ?? null,
    })

    if (error) {
      // Dedup constraint violation is not an error -- notification already exists
      if (error.code !== '23505') {
        return { error: 'Failed to create notification' }
      }
    }
  }

  // Dispatch email if email preference is enabled
  if (typePrefs.email) {
    // Fetch user email from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', params.userId)
      .single()

    // Fetch actor name if actorId provided
    let actorName: string | null = null
    if (params.actorId) {
      const { data: actorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', params.actorId)
        .single()
      actorName = actorProfile?.full_name ?? null
    }

    if (profile?.email) {
      // Fire-and-forget -- never block notification creation on email
      sendNotificationEmail({
        to: profile.email,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        linkUrl: params.linkUrl ?? null,
        actorName,
      }).catch(console.error)
    }
  }

  return { success: true }
}
