'use server'

import type {
  ContextZone,
  CreateZonePayload,
  UpdateZonePayload,
  ContextPreset,
} from '@/lib/types/context-zones'

/**
 * Helper to build absolute URL for API routes in server actions.
 * Uses VERCEL_URL (auto-set by Vercel), NEXT_PUBLIC_APP_URL, or localhost.
 */
function apiUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000'
  return `${base}${path}`
}

/**
 * Forward cookies from the incoming request so the API route
 * can create an authenticated Supabase client.
 */
async function cookieHeader(): Promise<Record<string, string>> {
  const { cookies } = await import('next/headers')
  const jar = await cookies()
  const cookieStr = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')
  return { Cookie: cookieStr }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getContextZones(
  profileId: string
): Promise<{ data: ContextZone[] } | { error: string }> {
  try {
    const headers = await cookieHeader()
    const res = await fetch(
      apiUrl(`/api/context-zones?profile_id=${encodeURIComponent(profileId)}`),
      { headers, cache: 'no-store' }
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { error: body.error ?? `Failed (${res.status})` }
    }
    const data: ContextZone[] = await res.json()
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch zones' }
  }
}

export async function createContextZone(
  payload: CreateZonePayload
): Promise<{ data: ContextZone } | { error: string }> {
  try {
    const headers = await cookieHeader()
    const res = await fetch(apiUrl('/api/context-zones'), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { error: body.error ?? `Failed (${res.status})` }
    }
    const data: ContextZone = await res.json()
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create zone' }
  }
}

export async function updateContextZone(
  zoneId: string,
  payload: UpdateZonePayload
): Promise<{ data: ContextZone } | { error: string }> {
  try {
    const headers = await cookieHeader()
    const res = await fetch(apiUrl(`/api/context-zones/${zoneId}`), {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { error: body.error ?? `Failed (${res.status})` }
    }
    const data: ContextZone = await res.json()
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update zone' }
  }
}

export async function deleteContextZone(
  zoneId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const headers = await cookieHeader()
    const res = await fetch(apiUrl(`/api/context-zones/${zoneId}`), {
      method: 'DELETE',
      headers,
    })
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { error: body.error ?? `Failed (${res.status})` }
    }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete zone' }
  }
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export async function getPresets(): Promise<
  { data: ContextPreset[] } | { error: string }
> {
  try {
    const headers = await cookieHeader()
    const res = await fetch(apiUrl('/api/context-zones/presets'), {
      headers,
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { error: body.error ?? `Failed (${res.status})` }
    }
    const data: ContextPreset[] = await res.json()
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch presets' }
  }
}

export async function applyPreset(
  presetId: string,
  profileId: string,
  userId: string,
  orgId: string,
  kpOverrides?: { kp_start?: number; kp_end?: number }
): Promise<{ data: ContextZone } | { error: string }> {
  try {
    const headers = await cookieHeader()
    const res = await fetch(apiUrl('/api/context-zones/presets'), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preset_id: presetId,
        profile_id: profileId,
        user_id: userId,
        org_id: orgId,
        ...(kpOverrides ?? {}),
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { error: body.error ?? `Failed (${res.status})` }
    }
    const data: ContextZone = await res.json()
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to apply preset' }
  }
}
