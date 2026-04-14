import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'

export async function POST(request: Request) {
  let body: { certId?: string; reason?: string } = {}

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { certId, reason } = body
  if (!certId) {
    return NextResponse.json(
      { error: 'certId is required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) {
    return NextResponse.json({ error: orgResult.error }, { status: 403 })
  }

  // Proxy to FastAPI
  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json(
      { error: 'Certificate service not configured' },
      { status: 503 }
    )
  }

  try {
    const response = await fetch(
      `${fastApiUrl}/api/v1/certificates/${certId}/revoke`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reason || undefined,
          user_id: user.id,
          org_id: orgResult.orgId,
        }),
      }
    )

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: 'Failed to revoke certificate' }))
      return NextResponse.json(
        { error: errorBody.detail || 'Failed to revoke certificate' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'Certificate service unavailable' },
      { status: 503 }
    )
  }
}
