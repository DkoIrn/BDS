'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'
import {
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
} from '@/lib/types/notifications'

/**
 * Get notification preferences for a user.
 * If no preferences row exists, returns DEFAULT_PREFERENCES (all enabled).
 * Can be called with explicit userId (for internal use) or will use current auth user.
 */
export async function getNotificationPreferences(
  userId?: string
): Promise<NotificationPreferences> {
  const supabase = await createClient()

  let targetUserId = userId
  if (!targetUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return DEFAULT_PREFERENCES
    targetUserId = user.id
  }

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('preferences')
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (error || !data) {
    return DEFAULT_PREFERENCES
  }

  return data.preferences as NotificationPreferences
}

/**
 * Upsert notification preferences for the current user.
 */
export async function updateNotificationPreferences(
  preferences: NotificationPreferences
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const roleResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in roleResult) return { error: roleResult.error }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: user.id,
        preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) return { error: 'Failed to update notification preferences' }

  return { success: true }
}
