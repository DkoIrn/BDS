'use server'

import * as crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'
import type { ApiKey, ApiKeyCreateResult } from '@/lib/types/api-keys'

/**
 * Generate a new API key for the current user's org.
 * Returns the raw key exactly once -- it is never stored.
 */
export async function generateApiKey(
  name: string
): Promise<ApiKeyCreateResult | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) return { error: orgResult.error }

  // Verify enterprise plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  if (profile?.plan !== 'enterprise') {
    return { error: 'API keys require an Enterprise plan' }
  }

  // Generate key: tk_ + 64 hex chars
  const rawKey = `tk_${crypto.randomBytes(32).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 11) // "tk_" + first 8 hex chars

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      org_id: orgResult.orgId,
      user_id: user.id,
      name: name.trim() || 'Unnamed Key',
      key_hash: keyHash,
      key_prefix: keyPrefix,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  return {
    key: rawKey,
    prefix: keyPrefix,
    id: data.id,
  }
}

/**
 * List all API keys for the current user's org (never returns key_hash).
 */
export async function listApiKeys(): Promise<
  { data: ApiKey[] } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) return { error: orgResult.error }

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, org_id, user_id, name, key_prefix, last_used_at, revoked_at, created_at')
    .eq('org_id', orgResult.orgId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }

  return { data: data as ApiKey[] }
}

/**
 * Revoke an API key by setting revoked_at timestamp.
 */
export async function revokeApiKey(
  keyId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) return { error: orgResult.error }

  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('org_id', orgResult.orgId)

  if (error) return { error: error.message }

  return { success: true }
}
