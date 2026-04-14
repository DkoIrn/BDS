import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveApiKey } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/api-rate-limit'
import type { ProfileConfig } from '@/lib/types/validation'

export async function POST(request: Request) {
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

  // 3. Parse JSON body
  let body: {
    dataset_id?: string
    config?: ProfileConfig
    secondary_dataset_id?: string
    cross_dataset_config?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      {
        status: 400,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  const { dataset_id, config, secondary_dataset_id, cross_dataset_config } = body

  if (!dataset_id) {
    return NextResponse.json(
      { error: 'dataset_id is required' },
      {
        status: 400,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 4. Verify dataset belongs to API key's org via join chain:
  //    dataset -> job -> project -> org_id
  const { data: dataset, error: datasetError } = await supabaseAdmin
    .from('datasets')
    .select('id, status, job_id, jobs!inner(id, project_id, projects!inner(id, org_id))')
    .eq('id', dataset_id)
    .single()

  if (datasetError || !dataset) {
    return NextResponse.json(
      { error: 'Dataset not found' },
      {
        status: 404,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  // Check org ownership
  const jobs = dataset.jobs as unknown as { projects: { org_id: string } }
  if (jobs.projects.org_id !== apiKey.orgId) {
    return NextResponse.json(
      { error: 'Dataset not found' },
      {
        status: 404,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  // 5. Check dataset is in a valid status for validation
  const validStatuses = ['parsed', 'mapped', 'validated', 'validation_error', 'queued']
  if (!validStatuses.includes(dataset.status as string)) {
    return NextResponse.json(
      { error: 'Dataset must be in parsed, mapped, or validated status to validate' },
      {
        status: 400,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  // 6. Update status to queued (the job queue task will set it to validating when it starts)
  await supabaseAdmin
    .from('datasets')
    .update({ status: 'queued' as string })
    .eq('id', dataset_id)

  // 7. Proxy to FastAPI
  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    await supabaseAdmin
      .from('datasets')
      .update({ status: 'validation_error' })
      .eq('id', dataset_id)
    return NextResponse.json(
      { error: 'Validation service not configured' },
      {
        status: 503,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  try {
    const fastApiResponse = await fetch(`${fastApiUrl}/api/v1/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset_id,
        config: config ?? null,
        ...(secondary_dataset_id ? { secondary_dataset_id } : {}),
        ...(cross_dataset_config ? { cross_dataset_config } : {}),
      }),
    })

    if (!fastApiResponse.ok) {
      const errorBody = await fastApiResponse.text()
      console.error('[v1/validate] FastAPI error:', fastApiResponse.status, errorBody)
      await supabaseAdmin
        .from('datasets')
        .update({ status: 'validation_error' })
        .eq('id', dataset_id)

      return NextResponse.json(
        { error: `Validation service error: ${errorBody}` },
        {
          status: 502,
          headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
        }
      )
    }

    // Extract job_id from FastAPI response
    const responseBody = await fastApiResponse.json().catch(() => ({}))
    const jobId = responseBody.job_id ?? null

    return NextResponse.json(
      {
        dataset_id,
        job_id: jobId,
        status: 'queued',
        message: 'Validation queued',
      },
      {
        status: 202,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Validation service unavailable'
    console.error('[v1/validate] catch error:', errorMessage)

    await supabaseAdmin
      .from('datasets')
      .update({ status: 'validation_error' })
      .eq('id', dataset_id)

    return NextResponse.json(
      { error: errorMessage },
      {
        status: 503,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }
}
