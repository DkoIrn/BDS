import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'

/**
 * GET /api/jobs/[jobId] - Proxy to FastAPI GET /api/v1/jobs/{jobId}
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
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

  const { jobId } = await params

  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json({ error: 'Job service not configured' }, { status: 503 })
  }

  try {
    const response = await fetch(`${fastApiUrl}/api/v1/jobs/${jobId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    console.error('[api/jobs/detail] Error:', err)
    return NextResponse.json({ error: 'Job service unavailable' }, { status: 503 })
  }
}
