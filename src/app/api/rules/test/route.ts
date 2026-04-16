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

  if (!body.dataset_id) {
    return NextResponse.json({ error: 'dataset_id is required' }, { status: 400 })
  }

  if (!body.rule_definition) {
    return NextResponse.json({ error: 'rule_definition is required' }, { status: 400 })
  }

  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json({ error: 'FASTAPI_URL is not configured' }, { status: 503 })
  }

  try {
    const response = await fetch(`${fastApiUrl}/api/v1/rules/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        rule_definition: body.rule_definition ? toBackendRuleDef(body.rule_definition) : body.rule_definition,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return NextResponse.json(
        { error: `Rule test error: ${errorBody}` },
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
