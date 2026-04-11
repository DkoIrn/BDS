'use server'

import { createClient } from '@/lib/supabase/server'
import type { ProfileConfig, ValidationProfile } from '@/lib/types/validation'
import { requireOrgRole } from '@/lib/permissions'

export async function getProfiles(): Promise<
  { data: ValidationProfile[] } | { error: string }
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in orgResult) return { error: orgResult.error }
  const { orgId } = orgResult

  // Filter by org_id instead of user_id so all team members see shared profiles
  const { data, error } = await supabase
    .from('validation_profiles')
    .select('*')
    .eq('org_id', orgId)
    .order('name')

  if (error) {
    return { error: error.message }
  }

  return { data: data as ValidationProfile[] }
}

export async function createProfile(
  name: string,
  surveyType: string | null,
  config: ProfileConfig
): Promise<{ success: true; id: string } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'reviewer')
  if ('error' in orgResult) return { error: orgResult.error }
  const { orgId } = orgResult

  const { data, error } = await supabase
    .from('validation_profiles')
    .insert({
      user_id: user.id,
      org_id: orgId,
      name,
      survey_type: surveyType,
      config: config as unknown as Record<string, unknown>,
    })
    .select('id')
    .single()

  if (error) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      return { error: 'A profile with this name already exists' }
    }
    return { error: error.message }
  }

  return { success: true, id: data.id }
}

export async function updateProfile(
  profileId: string,
  name: string,
  config: ProfileConfig
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'reviewer')
  if ('error' in orgResult) return { error: orgResult.error }

  // RLS ensures profile belongs to the user's org
  const { error } = await supabase
    .from('validation_profiles')
    .update({
      name,
      config: config as unknown as Record<string, unknown>,
    })
    .eq('id', profileId)

  if (error) {
    if (error.code === '23505') {
      return { error: 'A profile with this name already exists' }
    }
    return { error: error.message }
  }

  return { success: true }
}

export async function deleteProfile(
  profileId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) return { error: orgResult.error }

  // RLS ensures profile belongs to the user's org
  const { error } = await supabase
    .from('validation_profiles')
    .delete()
    .eq('id', profileId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
