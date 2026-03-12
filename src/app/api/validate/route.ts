import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ProfileConfig } from '@/lib/types/validation'

export const maxDuration = 120

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

  // Update status to validating
  await supabase
    .from('datasets')
    .update({ status: 'validating' })
    .eq('id', datasetId)

  try {
    // Proxy validation request to FastAPI
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
      const errorBody = await response.text()
      throw new Error(`FastAPI validation failed: ${errorBody}`)
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (err) {
    // Update status to validation_error on failure
    const errorMessage = err instanceof Error ? err.message : 'Validation failed'

    await supabase
      .from('datasets')
      .update({ status: 'validation_error' })
      .eq('id', datasetId)

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
