import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const runId = searchParams.get('runId')
  const mode = searchParams.get('mode') || 'technical'
  const triageAccepted = searchParams.get('triage_accepted')
  const triageRejected = searchParams.get('triage_rejected')
  const triageDeferred = searchParams.get('triage_deferred')

  if (!runId) {
    return NextResponse.json(
      { error: 'runId is required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Auth check
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

  // Fetch validation run (RLS ensures org-scoped access)
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

  // Verify dataset access via RLS
  const { data: dataset, error: datasetError } = await supabase
    .from('datasets')
    .select('id')
    .eq('id', run.dataset_id)
    .single()

  if (datasetError || !dataset) {
    return NextResponse.json(
      { error: 'Dataset not found or access denied' },
      { status: 404 }
    )
  }

  // Proxy to FastAPI
  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json(
      { error: 'Report service not configured' },
      { status: 503 }
    )
  }

  try {
    // Build query params for FastAPI
    const params = new URLSearchParams({ mode })
    if (triageAccepted) params.set('triage_accepted', triageAccepted)
    if (triageRejected) params.set('triage_rejected', triageRejected)
    if (triageDeferred) params.set('triage_deferred', triageDeferred)

    const response = await fetch(
      `${fastApiUrl}/api/v1/report/pdf/${runId}?${params.toString()}`
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Report generation failed' },
        { status: 502 }
      )
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          `attachment; filename=qc-${mode}-report-${runId.slice(0, 8)}.pdf`,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Report service unavailable' },
      { status: 503 }
    )
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const runId = searchParams.get('runId')

  if (!runId) {
    return NextResponse.json(
      { error: 'runId is required' },
      { status: 400 }
    )
  }

  let body: {
    mode?: string
    triage_accepted?: number | null
    triage_rejected?: number | null
    triage_deferred?: number | null
    sections?: Record<string, boolean> | null
    commentary?: Record<string, string> | null
  } = {}

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const mode = body.mode || 'technical'

  const supabase = await createClient()

  // Auth check
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

  // Fetch validation run (RLS ensures org-scoped access)
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

  // Verify dataset access via RLS
  const { data: dataset, error: datasetError } = await supabase
    .from('datasets')
    .select('id')
    .eq('id', run.dataset_id)
    .single()

  if (datasetError || !dataset) {
    return NextResponse.json(
      { error: 'Dataset not found or access denied' },
      { status: 404 }
    )
  }

  // Fetch branding from profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('logo_storage_path, brand_color')
    .eq('id', user.id)
    .single()

  let logo_base64: string | null = null

  if (profile?.logo_storage_path) {
    const { data: logoData } = await supabase.storage
      .from('datasets')
      .download(profile.logo_storage_path)

    if (logoData) {
      const arrayBuffer = await logoData.arrayBuffer()
      logo_base64 = Buffer.from(arrayBuffer).toString('base64')
    }
  }

  // Proxy to FastAPI
  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json(
      { error: 'Report service not configured' },
      { status: 503 }
    )
  }

  try {
    const fastapiBody = {
      mode,
      triage_accepted: body.triage_accepted ?? null,
      triage_rejected: body.triage_rejected ?? null,
      triage_deferred: body.triage_deferred ?? null,
      sections: body.sections ?? null,
      commentary: body.commentary ?? null,
      brand_color: profile?.brand_color ?? null,
      logo_base64,
    }

    const response = await fetch(
      `${fastApiUrl}/api/v1/report/pdf/${runId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fastapiBody),
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Report generation failed' },
        { status: 502 }
      )
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          `attachment; filename=qc-${mode}-report-${runId.slice(0, 8)}.pdf`,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Report service unavailable' },
      { status: 503 }
    )
  }
}
