import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'

export interface ApiKeyResult {
  orgId: string
  userId: string
  keyId: string
}

/**
 * Resolve an API key from the Authorization header.
 * Extracts Bearer tk_... token, hashes with SHA-256, looks up in api_keys table.
 * Returns org context if valid enterprise key, null otherwise.
 */
export async function resolveApiKey(
  request: Request
): Promise<ApiKeyResult | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer tk_')) return null

  const rawKey = authHeader.slice(7) // remove "Bearer "
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: apiKey } = await supabaseAdmin
    .from('api_keys')
    .select('id, org_id, user_id')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .single()

  if (!apiKey) return null

  // Verify enterprise tier
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', apiKey.user_id)
    .single()

  if (profile?.plan !== 'enterprise') return null

  // Update last_used_at (fire and forget)
  await supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)

  return {
    orgId: apiKey.org_id,
    userId: apiKey.user_id,
    keyId: apiKey.id,
  }
}
