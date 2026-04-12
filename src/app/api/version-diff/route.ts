import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

export async function POST(request: Request) {
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
      { error: "Diff service is not configured" },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const { datasetId, versionA, versionB, page, pageSize } = body

    if (!datasetId || versionA == null || versionB == null) {
      return NextResponse.json(
        { error: "datasetId, versionA, and versionB are required" },
        { status: 400 }
      )
    }

    const response = await fetch(
      `${fastApiUrl}/api/v1/datasets/${datasetId}/diff`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version_a: versionA,
          version_b: versionB,
          page: page ?? 1,
          page_size: pageSize ?? 50,
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: errorText || "Failed to compute diff" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Version diff proxy error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
