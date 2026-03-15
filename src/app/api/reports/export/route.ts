import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CONTENT_TYPES: Record<string, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const datasetId = searchParams.get('datasetId')
  const format = searchParams.get('format') || 'csv'
  const runId = searchParams.get('runId')

  if (!datasetId) {
    return NextResponse.json(
      { error: 'datasetId is required' },
      { status: 400 }
    )
  }

  if (!CONTENT_TYPES[format]) {
    return NextResponse.json(
      { error: 'format must be csv or xlsx' },
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

  // Ownership check
  const { data: dataset, error: datasetError } = await supabase
    .from('datasets')
    .select('id')
    .eq('id', datasetId)
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
      { error: 'Export service not configured' },
      { status: 503 }
    )
  }

  try {
    const queryParams = new URLSearchParams({ format })
    if (runId) {
      queryParams.set('run_id', runId)
    }

    const response = await fetch(
      `${fastApiUrl}/api/v1/export/dataset/${datasetId}?${queryParams.toString()}`
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Export generation failed' },
        { status: 502 }
      )
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type':
          response.headers.get('Content-Type') || CONTENT_TYPES[format],
        'Content-Disposition':
          response.headers.get('Content-Disposition') ||
          `attachment; filename=dataset-annotated.${format}`,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Export service unavailable' },
      { status: 503 }
    )
  }
}
