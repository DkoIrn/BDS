import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'

/** Convert frontend camelCase rule definition to backend snake_case */
function toBackendRuleDef(group: Record<string, unknown>): Record<string, unknown> {
  const conditions = ((group.conditions as Record<string, unknown>[]) || []).map((c) => ({
    column: c.column,
    rule_type: c.ruleType || c.rule_type,
    operator: c.operator,
    value: c.value,
    compare_column: c.compareColumn || c.compare_column,
  }))
  const groups = ((group.groups as Record<string, unknown>[]) || []).map(toBackendRuleDef)
  return {
    logic: group.logic || "AND",
    conditions,
    groups,
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'reviewer')
  if ('error' in orgResult) {
    return NextResponse.json({ error: orgResult.error }, { status: 403 })
  }

  const body = await request.json()

  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json({ error: 'FASTAPI_URL is not configured' }, { status: 503 })
  }

  try {
    const response = await fetch(`${fastApiUrl}/api/v1/rules/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        rule_definition: body.rule_definition ? toBackendRuleDef(body.rule_definition) : body.rule_definition,
        user_id: user.id,
        org_id: orgResult.orgId,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return NextResponse.json(
        { error: `Rule service error: ${errorBody}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Rule service unavailable'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in orgResult) {
    return NextResponse.json({ error: orgResult.error }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const profileId = searchParams.get('profile_id')

  if (!profileId) {
    return NextResponse.json({ error: 'profile_id is required' }, { status: 400 })
  }

  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json({ error: 'FASTAPI_URL is not configured' }, { status: 503 })
  }

  try {
    const response = await fetch(
      `${fastApiUrl}/api/v1/rules/?profile_id=${encodeURIComponent(profileId)}`,
      { method: 'GET' }
    )

    if (!response.ok) {
      const errorBody = await response.text()
      return NextResponse.json(
        { error: `Rule service error: ${errorBody}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Rule service unavailable'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
