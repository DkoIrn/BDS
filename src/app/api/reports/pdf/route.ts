import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  // Fetch validation run to get dataset_id
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

  // Ownership check via dataset
  const { data: dataset, error: datasetError } = await supabase
    .from('datasets')
    .select('id')
    .eq('id', run.dataset_id)
    .eq('user_id', user.id)
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
