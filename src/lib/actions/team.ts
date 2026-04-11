'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'
import type { OrgRole, OrgMember, OrgInvite } from '@/lib/types/organisations'

/**
 * Get the current user's org role. Used by frontend components for role-gating UI.
 */
export async function getUserOrgRole(): Promise<
  { role: OrgRole; orgId: string } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in orgResult) return { error: orgResult.error }

  return { role: orgResult.role, orgId: orgResult.orgId }
}

/**
 * Fetch all org members with joined profile data.
 */
export async function getTeamMembers(): Promise<
  { data: OrgMember[] } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in orgResult) return { error: orgResult.error }
  const { orgId } = orgResult

  const { data, error } = await supabase
    .from('org_members')
    .select('*, profiles:user_id(full_name, email)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  return { data: (data ?? []) as OrgMember[] }
}

/**
 * Invite a new team member by email. Admin only.
 */
export async function inviteTeamMember(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) return { error: orgResult.error }
  const { orgId } = orgResult

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const role = (formData.get('role') as OrgRole) || 'viewer'

  if (!email || !email.includes('@')) {
    return { error: 'A valid email address is required' }
  }

  if (!['admin', 'reviewer', 'viewer'].includes(role)) {
    return { error: 'Invalid role' }
  }

  // Check if already a member
  const { data: existingMembers } = await supabase
    .from('org_members')
    .select('id, profiles:user_id(email)')
    .eq('org_id', orgId)

  const alreadyMember = (existingMembers ?? []).some(
    (m: Record<string, unknown>) => {
      const profile = m.profiles as { email?: string } | null
      return profile?.email?.toLowerCase() === email
    }
  )

  if (alreadyMember) {
    return { error: 'This person is already a member of your team' }
  }

  // Check if already invited (pending)
  const { data: existingInvite } = await supabase
    .from('org_invites')
    .select('id')
    .eq('org_id', orgId)
    .eq('email', email)
    .eq('status', 'pending')
    .single()

  if (existingInvite) {
    return { error: 'An invite has already been sent to this email' }
  }

  // Create invite record with 7-day expiry
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { error: inviteError } = await supabase.from('org_invites').insert({
    org_id: orgId,
    email,
    role,
    invited_by: user.id,
    expires_at: expiresAt.toISOString(),
  })

  if (inviteError) {
    return { error: inviteError.message }
  }

  // Check if user already exists in auth (by email lookup in profiles)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (!existingProfile) {
    // New user -- use Supabase Admin to send invite email
    // This requires SUPABASE_SERVICE_ROLE_KEY in env
    try {
      const { createClient: createAdminClient } = await import('@supabase/supabase-js')
      const adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await adminClient.auth.admin.inviteUserByEmail(email)
    } catch {
      // If admin invite fails, the invite record still exists
      // User can sign up manually and accept the invite
    }
  }

  return { success: true }
}

/**
 * Get pending org invites. Admin only.
 */
export async function getOrgInvites(): Promise<
  { data: OrgInvite[] } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) return { error: orgResult.error }
  const { orgId } = orgResult

  const { data, error } = await supabase
    .from('org_invites')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }

  return { data: (data ?? []) as OrgInvite[] }
}

/**
 * Remove a team member. Admin only. Cannot remove self if sole admin.
 */
export async function removeMember(
  memberId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) return { error: orgResult.error }
  const { orgId } = orgResult

  // Get the member to be removed
  const { data: member } = await supabase
    .from('org_members')
    .select('id, user_id, role')
    .eq('id', memberId)
    .eq('org_id', orgId)
    .single()

  if (!member) {
    return { error: 'Member not found' }
  }

  // Cannot remove self if sole admin
  if (member.user_id === user.id) {
    const { count: adminCount } = await supabase
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('role', 'admin')

    if ((adminCount ?? 0) <= 1) {
      return { error: 'Cannot remove yourself as the only admin' }
    }
  }

  const { error } = await supabase
    .from('org_members')
    .delete()
    .eq('id', memberId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

/**
 * Cancel a pending invite. Admin only.
 */
export async function cancelInvite(
  inviteId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) return { error: orgResult.error }
  const { orgId } = orgResult

  const { error } = await supabase
    .from('org_invites')
    .update({ status: 'expired' })
    .eq('id', inviteId)
    .eq('org_id', orgId)
    .eq('status', 'pending')

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

/**
 * Update a member's role. Admin only. Cannot demote sole admin.
 */
export async function updateMemberRole(
  memberId: string,
  newRole: OrgRole
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) return { error: orgResult.error }
  const { orgId } = orgResult

  // Get the member
  const { data: member } = await supabase
    .from('org_members')
    .select('id, user_id, role')
    .eq('id', memberId)
    .eq('org_id', orgId)
    .single()

  if (!member) {
    return { error: 'Member not found' }
  }

  // Cannot demote self if sole admin
  if (member.user_id === user.id && member.role === 'admin' && newRole !== 'admin') {
    const { count: adminCount } = await supabase
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('role', 'admin')

    if ((adminCount ?? 0) <= 1) {
      return { error: 'Cannot demote yourself as the only admin' }
    }
  }

  const { error } = await supabase
    .from('org_members')
    .update({ role: newRole })
    .eq('id', memberId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
