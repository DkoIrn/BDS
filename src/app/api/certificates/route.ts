import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'

export async function POST(request: Request) {
  let body: { runId?: string } = {}

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { runId } = body
  if (!runId) {
    return NextResponse.json(
      { error: 'runId is required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in orgResult) {
    return NextResponse.json({ error: orgResult.error }, { status: 403 })
  }

  // Fetch org name
  const { data: org } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', orgResult.orgId)
    .single()

  const orgName = org?.name ?? 'Unknown Organisation'

  // Verify the user can access this validation run via RLS
  const { data: run, error: runError } = await supabase
    .from('validation_runs')
    .select('id, dataset_id')
    .eq('id', runId)
    .single()

  if (runError || !run) {
    return NextResponse.json(
      { error: 'Validation run not found' },
      { status: 404 }
    )
  }

  // Proxy to FastAPI
  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json(
      { error: 'Certificate service not configured' },
      { status: 503 }
    )
  }

  try {
    const response = await fetch(
      `${fastApiUrl}/api/v1/certificate/generate/${runId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          org_id: orgResult.orgId,
          org_name: orgName,
        }),
      }
    )

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: 'Certificate generation failed' }))
      return NextResponse.json(
        { error: errorBody.detail || 'Certificate generation failed' },
        { status: response.status }
      )
    }

    const contentDisposition = response.headers.get('content-disposition') ?? ''

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition || `attachment; filename="TruQC-Certificate.pdf"`,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Certificate service unavailable' },
      { status: 503 }
    )
  }
}
