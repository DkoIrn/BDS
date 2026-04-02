import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/actions/audit'
import type { ProfileConfig } from '@/lib/types/validation'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Parse request body
  const body = (await request.json()) as { datasetId?: string; config?: ProfileConfig }
  const { datasetId, config } = body

  if (!datasetId) {
    return NextResponse.json({ error: 'datasetId is required' }, { status: 400 })
  }

  // Fetch dataset with ownership check
  const { data: dataset, error: datasetError } = await supabase
    .from('datasets')
    .select('id, status, user_id')
    .eq('id', datasetId)
    .eq('user_id', user.id)
    .single()

  if (datasetError || !dataset) {
    return NextResponse.json(
      { error: 'Dataset not found or access denied' },
      { status: 404 }
    )
  }

  // Only mapped/validated datasets can be validated (allow re-runs)
  const validStatuses = ['parsed', 'mapped', 'validated', 'validation_error']
  if (!validStatuses.includes(dataset.status as string)) {
    return NextResponse.json(
      { error: 'Dataset must be in "mapped" or "validated" status to validate' },
      { status: 400 }
    )
  }

  // Update status to validating (Next.js sets this, not FastAPI -- avoids race condition)
  await supabase
    .from('datasets')
    .update({ status: 'validating' })
    .eq('id', datasetId)

  try {
    // Fire-and-forget proxy to FastAPI -- await only to confirm service is reachable
    const fastApiUrl = process.env.FASTAPI_URL
    if (!fastApiUrl) {
      throw new Error('FASTAPI_URL is not configured')
    }

    const response = await fetch(`${fastApiUrl}/api/v1/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id: datasetId, config: config ?? null }),
    })

    if (!response.ok) {
      // FastAPI rejected the request -- set error status and inform user
      const errorBody = await response.text()
      await supabase
        .from('datasets')
        .update({ status: 'validation_error' })
        .eq('id', datasetId)

      return NextResponse.json(
        { error: `Validation service error: ${errorBody}` },
        { status: 502 }
      )
    }

    // Log the validation run
    logAudit({
      action: 'validation.run',
      entityType: 'dataset',
      entityId: datasetId,
      metadata: { source: 'project_backend', hasCustomConfig: !!config },
    })

    // FastAPI accepted (202) -- return 202 to frontend
    // Results will arrive via Supabase Realtime subscription
    return NextResponse.json(
      { status: 'accepted', datasetId },
      { status: 202 }
    )
  } catch (err) {
    // Connection error (FastAPI unreachable) -- immediate feedback
    const errorMessage =
      err instanceof Error ? err.message : 'Processing service unavailable'

    await supabase
      .from('datasets')
      .update({ status: 'validation_error' })
      .eq('id', datasetId)

    return NextResponse.json(
      { error: errorMessage },
      { status: 503 }
    )
  }
}
