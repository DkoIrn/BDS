import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Backfill entity_id on recent audit logs that were created during a pipeline
 * session (before the dataset had a DB record). Updates all null-entity logs
 * from the last 30 minutes for this user.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { datasetId, fileName } = await request.json()

    if (!datasetId) {
      return NextResponse.json({ error: "datasetId required" }, { status: 400 })
    }

    // Update all recent audit logs with null entity_id that match this file
    // Scoped to last 30 minutes and this user only
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    const { count } = await supabase
      .from("audit_logs")
      .update({ entity_id: datasetId })
      .eq("user_id", user.id)
      .eq("entity_type", "dataset")
      .is("entity_id", null)
      .gte("created_at", cutoff)
      .select("id", { count: "exact", head: true })

    return NextResponse.json({ updated: count ?? 0 })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
