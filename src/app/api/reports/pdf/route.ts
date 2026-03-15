import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const runId = searchParams.get('runId')

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
    const response = await fetch(
      `${fastApiUrl}/api/v1/report/pdf/${runId}`
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
          response.headers.get('Content-Disposition') ||
          `attachment; filename=qc-report-${runId.slice(0, 8)}.pdf`,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Report service unavailable' },
      { status: 503 }
    )
  }
}
