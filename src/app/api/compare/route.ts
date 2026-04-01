import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json(
      { error: 'Compare service is not configured' },
      { status: 503 }
    )
  }

  try {
    const rawBody = await request.arrayBuffer()
    const contentType = request.headers.get('Content-Type') || ''

    const response = await fetch(`${fastApiUrl}/api/v1/compare`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: rawBody,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Compare failed'
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.detail || errorJson.error || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Compare failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
