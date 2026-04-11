import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'

/**
 * GET /api/jobs - Proxy to FastAPI GET /api/v1/jobs
 * Query params: dataset_id, status, limit
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in orgResult) {
    return NextResponse.json({ error: orgResult.error }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const params = new URLSearchParams()
  if (searchParams.get('dataset_id')) params.set('dataset_id', searchParams.get('dataset_id')!)
  if (searchParams.get('status')) params.set('status', searchParams.get('status')!)
  if (searchParams.get('limit')) params.set('limit', searchParams.get('limit')!)

  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json({ error: 'Job service not configured' }, { status: 503 })
  }

  try {
    const response = await fetch(`${fastApiUrl}/api/v1/jobs?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    console.error('[api/jobs] Error:', err)
    return NextResponse.json({ error: 'Job service unavailable' }, { status: 503 })
  }
}
