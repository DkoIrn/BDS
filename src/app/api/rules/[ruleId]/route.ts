import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ ruleId: string }> }
) {
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

  const { ruleId } = await params
  const body = await request.json()

  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json({ error: 'FASTAPI_URL is not configured' }, { status: 503 })
  }

  try {
    const response = await fetch(`${fastApiUrl}/api/v1/rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ ruleId: string }> }
) {
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

  const { ruleId } = await params

  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json({ error: 'FASTAPI_URL is not configured' }, { status: 503 })
  }

  try {
    const response = await fetch(`${fastApiUrl}/api/v1/rules/${ruleId}`, {
      method: 'DELETE',
    })

    if (!response.ok && response.status !== 204) {
      const errorBody = await response.text()
      return NextResponse.json(
        { error: `Rule service error: ${errorBody}` },
        { status: response.status }
      )
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Rule service unavailable'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
