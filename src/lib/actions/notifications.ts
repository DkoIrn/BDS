'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'
import type {
  NotificationType,
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
    .select('*, actor_profile:actor_id(full_name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []

  return (data ?? []) as NotificationWithActor[]
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
    if (error.code === '23505') return { success: true }
    return { error: 'Failed to create notification' }
  }

  return { success: true }
}
