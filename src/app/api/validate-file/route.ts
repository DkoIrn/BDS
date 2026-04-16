import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

/**
 * Proxy to FastAPI /api/v1/validate-file for direct file validation.
 * Used by the pipeline to validate uploaded files using the same backend
 * validators as the projects page, ensuring consistent results.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json(
      { error: "Validation service is not configured" },
      { status: 503 }
    )
  }

  try {
    // Forward the multipart form data to FastAPI
    const formData = await request.formData()

    const response = await fetch(`${fastApiUrl}/api/v1/validate-file`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[validate-file] FastAPI error:", response.status, errorText)
      return NextResponse.json(
        { error: `Validation failed: ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation service unavailable"
    console.error("[validate-file] Error:", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
