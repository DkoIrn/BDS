import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveApiKey } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/api-rate-limit'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params

  // 1. API key auth
  const apiKey = await resolveApiKey(request)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Invalid or missing API key' },
      { status: 401 }
    )
  }

  // 2. Rate limiting
  const rateLimit = checkRateLimit(apiKey.keyId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'Retry-After': '60',
        },
      }
    )
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 3. Fetch validation run with org ownership join
  const { data: run, error: runError } = await supabaseAdmin
    .from('validation_runs')
    .select(`
      id, dataset_id,
      datasets!inner(
        id,
        jobs!inner(
          id,
          projects!inner(id, org_id)
        )
      )
    `)
    .eq('id', runId)
    .single()

  if (runError || !run) {
    return NextResponse.json(
      { error: 'Validation run not found' },
      {
        status: 404,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  // 4. Verify org ownership
  const datasets = run.datasets as unknown as {
    jobs: { projects: { org_id: string } }
  }
  if (datasets.jobs.projects.org_id !== apiKey.orgId) {
    return NextResponse.json(
      { error: 'Validation run not found' },
      {
        status: 404,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  // 5. Parse query params
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') || 'technical'

  // 6. Proxy to FastAPI for PDF generation
  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json(
      { error: 'Report service not configured' },
      {
        status: 503,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  try {
    const response = await fetch(
      `${fastApiUrl}/api/v1/report/pdf/${runId}?mode=${encodeURIComponent(mode)}`
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Report generation failed' },
        {
          status: 502,
          headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
        }
      )
    }

    // Stream PDF response back with correct headers
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="truqc-report-${runId.slice(0, 8)}.pdf"`,
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Report service unavailable' },
      {
        status: 503,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }
}
