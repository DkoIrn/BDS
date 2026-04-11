'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'
import { canTransition } from '@/lib/types/organisations'
import type { ApprovalStatus } from '@/lib/types/organisations'

export async function getApprovalStatus(
  datasetId: string
): Promise<{ status: ApprovalStatus } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const roleResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in roleResult) return { error: roleResult.error }

  const { data, error } = await supabase
    .from('datasets')
    .select('approval_status')
    .eq('id', datasetId)
    .single()

  if (error || !data) {
    return { error: 'Dataset not found' }
  }

  return { status: (data.approval_status ?? 'draft') as ApprovalStatus }
}

export async function updateApprovalStatus(
  datasetId: string,
  newStatus: ApprovalStatus,
  revalidateTo?: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // Only reviewers and admins can change approval status
  const roleResult = await requireOrgRole(supabase, user.id, 'reviewer')
  if ('error' in roleResult) return { error: roleResult.error }

  // Fetch current status
  const { data: dataset, error: fetchError } = await supabase
    .from('datasets')
    .select('approval_status')
    .eq('id', datasetId)
    .single()

  if (fetchError || !dataset) {
    return { error: 'Dataset not found' }
  }

  const currentStatus = (dataset.approval_status ?? 'draft') as ApprovalStatus

  // Validate transition
  if (!canTransition(currentStatus, newStatus)) {
    return {
      error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
    }
  }

  // Update status
  const { error: updateError } = await supabase
    .from('datasets')
    .update({ approval_status: newStatus })
    .eq('id', datasetId)

  if (updateError) {
    return { error: 'Failed to update approval status' }
  }

  // Audit log
  try {
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'approval_change',
      entity_type: 'dataset',
      entity_id: datasetId,
      metadata: {
        from: currentStatus,
        to: newStatus,
        changed_by: user.id,
      },
    })
  } catch {
    // Audit logging should never break the primary flow
  }

  if (revalidateTo) {
    revalidatePath(revalidateTo)
  }

  return { success: true }
}
