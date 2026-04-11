'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'
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

  if (revalidateTo) {
    revalidatePath(revalidateTo)
  }

  return { success: true, comment: data as IssueComment }
}

export async function getIssueComments(
  issueId: string
): Promise<IssueComment[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const roleResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in roleResult) return []

  const { data, error } = await supabase
    .from('issue_comments')
    .select('*, profiles:user_id(full_name)')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true })

  if (error) return []

  return (data ?? []) as IssueComment[]
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
