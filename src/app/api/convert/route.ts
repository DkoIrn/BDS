import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Check FastAPI URL is configured
  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json(
      { error: 'Conversion service is not configured' },
      { status: 503 }
    )
  }

  try {
    // Forward raw request body to FastAPI to preserve multipart boundaries
    const rawBody = await request.arrayBuffer()
    const contentType = request.headers.get('Content-Type') || ''

    const response = await fetch(`${fastApiUrl}/api/v1/convert`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: rawBody,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Conversion failed'
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.detail || errorJson.error || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    // Stream successful response back with metadata headers
    const blob = await response.blob()
    const headers = new Headers()

    const forwardHeaders = [
      'Content-Type',
      'Content-Disposition',
      'X-Conversion-Warnings',
      'X-Row-Count',
      'X-Source-Format',
    ]

    for (const header of forwardHeaders) {
      const value = response.headers.get(header)
      if (value) {
        headers.set(header, value)
      }
    }

    return new NextResponse(blob, { status: 200, headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Conversion failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
