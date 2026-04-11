'use server'

import * as crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'
import type { WebhookEndpoint, WebhookDelivery } from '@/lib/types/api-keys'

/**
 * Create a new webhook endpoint for the current user's org.
 * Returns the endpoint with its signing secret (shown once).
 */
export async function createWebhookEndpoint(
  url: string,
  events: string[]
): Promise<{ endpoint: WebhookEndpoint; secret: string } | { error: string }> {
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
    return { error: 'Webhooks require an Enterprise plan' }
  }

  // Validate URL format
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { error: 'URL must use HTTP or HTTPS protocol' }
    }
  } catch {
    return { error: 'Invalid URL format' }
  }

  if (!events.length) {
    return { error: 'At least one event must be selected' }
  }

  // Generate signing secret (32 bytes hex)
  const secret = crypto.randomBytes(32).toString('hex')

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .insert({
      org_id: orgResult.orgId,
      url: url.trim(),
      secret,
      events,
      active: true,
    })
    .select('id, org_id, url, events, active, created_at, updated_at')
    .single()

  if (error) return { error: error.message }

  return {
    endpoint: data as WebhookEndpoint,
    secret,
  }
}

/**
 * List all webhook endpoints for the current user's org.
 */
export async function listWebhookEndpoints(): Promise<
  { data: WebhookEndpoint[] } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) return { error: orgResult.error }

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('id, org_id, url, events, active, created_at, updated_at')
    .eq('org_id', orgResult.orgId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }

  return { data: data as WebhookEndpoint[] }
}

/**
 * Delete a webhook endpoint.
 */
export async function deleteWebhookEndpoint(
  endpointId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) return { error: orgResult.error }

  const { error } = await supabase
    .from('webhook_endpoints')
    .delete()
    .eq('id', endpointId)
    .eq('org_id', orgResult.orgId)

  if (error) return { error: error.message }

  return { success: true }
}

/**
 * Toggle a webhook endpoint's active status.
 */
export async function toggleWebhookEndpoint(
  endpointId: string,
  active: boolean
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) return { error: orgResult.error }

  const { error } = await supabase
    .from('webhook_endpoints')
    .update({ active })
    .eq('id', endpointId)
    .eq('org_id', orgResult.orgId)

  if (error) return { error: error.message }

  return { success: true }
}

/**
 * List delivery history for a specific webhook endpoint.
 */
export async function listWebhookDeliveries(
  endpointId: string
): Promise<{ data: WebhookDelivery[] } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) return { error: orgResult.error }

  // Verify endpoint belongs to this org
  const { data: endpoint } = await supabase
    .from('webhook_endpoints')
    .select('id')
    .eq('id', endpointId)
    .eq('org_id', orgResult.orgId)
    .single()

  if (!endpoint) return { error: 'Endpoint not found' }

  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('id, endpoint_id, event, payload, status, attempts, last_attempt_at, response_status, created_at')
    .eq('endpoint_id', endpointId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { error: error.message }

  return { data: data as WebhookDelivery[] }
}
