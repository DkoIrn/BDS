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
      { error: 'Transform service is not configured' },
      { status: 503 }
    )
  }

  try {
    const rawBody = await request.arrayBuffer()
    const contentType = request.headers.get('Content-Type') || ''

    const response = await fetch(`${fastApiUrl}/api/v1/transform/split`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: rawBody,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Split failed'
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.detail || errorJson.error || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    const blob = await response.blob()
    const headers = new Headers()

    const forwardHeaders = [
      'Content-Type',
      'Content-Disposition',
      'X-Transform-Warnings',
      'X-Split-Files',
      'X-Input-Format',
    ]

    for (const header of forwardHeaders) {
      const value = response.headers.get(header)
      if (value) {
        headers.set(header, value)
      }
    }

    return new NextResponse(blob, { status: 200, headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Split failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
