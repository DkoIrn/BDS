import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { requireOrgRole } from "@/lib/permissions"
import { CertificateTable } from "./components/certificate-table"
import type { Certificate } from "@/lib/types/certificate"

export default async function CertificatesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get org role and org ID
  const orgResult = await requireOrgRole(supabase, user.id, "viewer")
  if ("error" in orgResult) {
    redirect("/login")
  }

  const { orgId, role } = orgResult
  const isAdmin = role === "admin"

  // Fetch certificates for the user's org
  const { data: certificates } = await supabase
    .from("certificates")
    .select(
      "id, dataset_name, validation_date, rules_applied, total_issues, pass_rate, hmac_hash, status, generated_by, created_at, revoked_at, revoked_by, revocation_reason"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })

  // Map to frontend Certificate type
  const mapped: Certificate[] = (certificates ?? []).map((c) => ({
    id: c.id,
    dataset_name: c.dataset_name ?? "Unknown",
    validation_date: c.validation_date ?? c.created_at,
    rules_applied: c.rules_applied ?? [],
    total_issues: c.total_issues ?? 0,
    pass_rate: c.pass_rate ?? 0,
    hmac_hash: c.hmac_hash ?? "",
    org_name: "", // not needed in registry view
    status: c.status ?? "active",
    issued_by: c.generated_by ?? "",
    created_at: c.created_at,
    revoked_at: c.revoked_at ?? undefined,
    revoked_by: c.revoked_by ?? undefined,
    revocation_reason: c.revocation_reason ?? undefined,
  }))

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
        <p className="text-sm text-muted-foreground">
          Manage QC validation certificates for your organisation
        </p>
      </div>

      <CertificateTable
        certificates={mapped}
        isAdmin={isAdmin}
        userId={user.id}
        orgId={orgId}
      />
    </div>
  )
}
