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

  // 3. Fetch validation run with org ownership join:
  //    validation_runs -> datasets -> jobs -> projects -> org_id
  const { data: run, error: runError } = await supabaseAdmin
    .from('validation_runs')
    .select(`
      id, dataset_id, status, total_issues, critical_count, warning_count,
      info_count, pass_rate, created_at,
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

  // 5. Fetch all validation issues for this run
  const { data: issues, error: issuesError } = await supabaseAdmin
    .from('validation_issues')
    .select('row_number, column_name, rule_type, severity, message, expected, actual')
    .eq('run_id', runId)
    .order('row_number', { ascending: true })

  if (issuesError) {
    return NextResponse.json(
      { error: 'Failed to fetch validation issues' },
      {
        status: 500,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  // 6. Return structured JSON response
  return NextResponse.json(
    {
      run_id: run.id,
      dataset_id: run.dataset_id,
      status: run.status,
      total_issues: run.total_issues,
      critical_count: run.critical_count,
      warning_count: run.warning_count,
      info_count: run.info_count,
      pass_rate: run.pass_rate,
      created_at: run.created_at,
      issues: issues ?? [],
    },
    {
      status: 200,
      headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
    }
  )
}
