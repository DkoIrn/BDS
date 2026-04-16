'use server'

import type {
  CustomRule,
  CustomRuleDefinition,
  ConditionGroup,
  RuleTestResult,
} from '@/lib/types/custom-rules'

/**
 * Helper to build absolute URL for API routes in server actions.
 * Uses NEXT_PUBLIC_APP_URL or falls back to localhost.
 */
function apiUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
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

export async function getRulesForProfile(
  profileId: string
): Promise<{ data: CustomRule[] } | { error: string }> {
  try {
    const headers = await cookieHeader()
    const res = await fetch(
      apiUrl(`/api/rules?profile_id=${encodeURIComponent(profileId)}`),
      { headers, cache: 'no-store' }
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { error: body.error ?? `Failed (${res.status})` }
    }
    const data: CustomRule[] = await res.json()
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch rules' }
  }
}

export async function createRule(
  profileId: string,
  rule: CustomRuleDefinition
): Promise<{ data: CustomRule } | { error: string }> {
  try {
    const headers = await cookieHeader()
    const res = await fetch(apiUrl('/api/rules'), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: profileId,
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        rule_definition: rule.rootGroup,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { error: body.error ?? `Failed (${res.status})` }
    }
    const data: CustomRule = await res.json()
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create rule' }
  }
}

export async function updateRule(
  ruleId: string,
  updates: Partial<CustomRuleDefinition & { enabled: boolean }>
): Promise<{ data: CustomRule } | { error: string }> {
  try {
    const headers = await cookieHeader()
    // Map frontend rootGroup to backend rule_definition
    const body: Record<string, unknown> = {}
    if (updates.name !== undefined) body.name = updates.name
    if (updates.description !== undefined) body.description = updates.description
    if (updates.severity !== undefined) body.severity = updates.severity
    if (updates.enabled !== undefined) body.enabled = updates.enabled
    if (updates.rootGroup !== undefined) body.rule_definition = updates.rootGroup

    const res = await fetch(apiUrl(`/api/rules/${ruleId}`), {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const respBody = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { error: respBody.error ?? `Failed (${res.status})` }
    }
    const data: CustomRule = await res.json()
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update rule' }
  }
}

export async function deleteRule(
  ruleId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const headers = await cookieHeader()
    const res = await fetch(apiUrl(`/api/rules/${ruleId}`), {
      method: 'DELETE',
      headers,
    })
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { error: body.error ?? `Failed (${res.status})` }
    }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete rule' }
  }
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

export async function testRule(
  ruleDefinition: ConditionGroup,
  datasetId: string,
  severity?: string
): Promise<{ data: RuleTestResult } | { error: string }> {
  try {
    const headers = await cookieHeader()
    const res = await fetch(apiUrl('/api/rules/test'), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rule_definition: ruleDefinition,
        dataset_id: datasetId,
        severity: severity ?? 'warning',
        name: 'Test rule',
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { error: body.error ?? `Failed (${res.status})` }
    }
    const data: RuleTestResult = await res.json()
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to test rule' }
  }
}
