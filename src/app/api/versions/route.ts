import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 30

export async function GET(request: Request) {
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
      { error: "Versions service is not configured" },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(request.url)
  const datasetId = searchParams.get("datasetId")

  if (!datasetId) {
    return NextResponse.json(
      { error: "datasetId is required" },
      { status: 400 }
    )
  }

  try {
    const response = await fetch(
      `${fastApiUrl}/api/v1/datasets/${datasetId}/versions`,
      { method: "GET" }
    )

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: errorText || "Failed to fetch versions" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Versions proxy error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
