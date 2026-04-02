import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const entries = Array.isArray(body) ? body : [body]

    const rows = entries.map((entry: { action: string; entityType: string; entityId?: string; metadata?: Record<string, unknown> }) => ({
      user_id: user.id,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
    }))

    await supabase.from("audit_logs").insert(rows)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // Silent fail — don't break client flows
  }
}
