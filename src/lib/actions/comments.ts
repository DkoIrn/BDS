'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'
import { createNotification } from '@/lib/actions/notifications'
import { extractMentionedUserIds } from '@/lib/utils/mentions'
import type { IssueComment } from '@/lib/types/organisations'

export async function addComment(
  issueId: string,
  content: string,
  revalidateTo?: string
): Promise<{ success: true; comment: IssueComment } | { error: string }> {
  if (!content.trim()) {
    return { error: 'Comment cannot be empty' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const roleResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in roleResult) return { error: roleResult.error }

  const { data, error } = await supabase
    .from('issue_comments')
    .insert({
      issue_id: issueId,
      user_id: user.id,
      content: content.trim(),
    })
    .select('*, profiles:user_id(full_name)')
    .single()

  if (error) {
    return { error: 'Failed to add comment' }
  }

  // Create mention notifications for @mentioned users (excluding self)
  const mentionedUserIds = extractMentionedUserIds(content)
  const orgId = roleResult.orgId

  // Get current user's display name for notification title
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const actorName = profile?.full_name || 'Someone'

  for (const mentionedUserId of mentionedUserIds) {
    if (mentionedUserId === user.id) continue // Don't notify self
    await createNotification({
      userId: mentionedUserId,
      orgId,
      type: 'mention',
      title: `${actorName} mentioned you in a comment`,
      resourceType: 'issue',
      resourceId: issueId,
      actorId: user.id,
    })
  }

  if (revalidateTo) {
    revalidatePath(revalidateTo)
  }

  return { success: true, comment: data as IssueComment }
}

export async function getIssueComments(
  issueId: string,
  filter: 'all' | 'unresolved' = 'unresolved'
): Promise<IssueComment[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const roleResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in roleResult) return []

  let query = supabase
    .from('issue_comments')
    .select('*, profiles:user_id(full_name), resolver:resolved_by(full_name)')
    .eq('issue_id', issueId)

  if (filter === 'unresolved') {
    query = query.is('resolved_at', null)
  }

  const { data, error } = await query.order('created_at', { ascending: true })

  if (error) return []

  // Map resolver join to resolved_by_name
  return ((data ?? []) as (IssueComment & { resolver?: { full_name: string | null } })[]).map(
    (comment) => ({
      ...comment,
      resolved_by_name: comment.resolver?.full_name ?? null,
    })
  )
}

export async function deleteComment(
  commentId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const roleResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in roleResult) return { error: roleResult.error }

  // Only allow deleting own comments
  const { error } = await supabase
    .from('issue_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id)

  if (error) {
    return { error: 'Failed to delete comment' }
  }

  return { success: true }
}

/**
 * Resolve a comment. Sets resolved_at and resolved_by, then notifies
 * the comment author that their comment was resolved.
 */
export async function resolveComment(
  commentId: string
): Promise<{ success: true; comment: IssueComment } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const roleResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in roleResult) return { error: roleResult.error }

  // Fetch comment to get author and issue context
  const { data: comment, error: fetchError } = await supabase
    .from('issue_comments')
    .select('id, issue_id, user_id')
    .eq('id', commentId)
    .single()

  if (fetchError || !comment) {
    return { error: 'Comment not found' }
  }

  // Update with resolution
  const { data: updated, error: updateError } = await supabase
    .from('issue_comments')
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq('id', commentId)
    .select('*, profiles:user_id(full_name)')
    .single()

  if (updateError) {
    return { error: 'Failed to resolve comment' }
  }

  // Notify comment author (unless resolver is the author)
  if (comment.user_id !== user.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const actorName = profile?.full_name || 'Someone'

    await createNotification({
      userId: comment.user_id,
      orgId: roleResult.orgId,
      type: 'comment_resolved',
      title: `${actorName} resolved your comment`,
      resourceType: 'issue',
      resourceId: comment.issue_id,
      actorId: user.id,
    })
  }

  return { success: true, comment: updated as IssueComment }
}

/**
 * Reopen a previously resolved comment.
 */
export async function reopenComment(
  commentId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const roleResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in roleResult) return { error: roleResult.error }

  const { error } = await supabase
    .from('issue_comments')
    .update({
      resolved_at: null,
      resolved_by: null,
    })
    .eq('id', commentId)

  if (error) {
    return { error: 'Failed to reopen comment' }
  }

  return { success: true }
}
