import type { Metadata } from "next"
import type { VerifyResponse } from "@/lib/types/certificate"
import { ShieldCheck, ShieldX, ShieldQuestion, ExternalLink } from "lucide-react"
import { CopyButton } from "./copy-button"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Verify Certificate | TruQC",
  description: "Independently verify a TruQC QC Validation Certificate",
}

async function fetchVerification(id: string): Promise<VerifyResponse> {
  const backendUrl = process.env.FASTAPI_URL || "http://localhost:8000"
  try {
    const res = await fetch(`${backendUrl}/api/v1/certificates/${id}/verify`, {
      cache: "no-store",
    })
    if (!res.ok) {
      return { status: "not_found" }
    }
    return await res.json()
  } catch {
    return { status: "not_found" }
  }
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "Unknown"
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await fetchVerification(id)

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50/50 px-4 py-12">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">TruQC</h1>
        <p className="mt-1 text-xs text-muted-foreground">Certificate Verification</p>
      </div>

      {data.status === "active" && <ActiveCertificate data={data} />}
      {data.status === "revoked" && <RevokedCertificate data={data} />}
      {data.status === "not_found" && <NotFoundCertificate />}

      {/* Footer */}
      <div className="mt-12 text-center text-xs text-muted-foreground">
        <span>Powered by </span>
        <a
          href="https://truqc.co.uk"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
        >
          TruQC
          <ExternalLink className="size-3" />
        </a>
        <span> &mdash; truqc.co.uk</span>
      </div>
    </div>
  )
}

function ActiveCertificate({ data }: { data: VerifyResponse }) {
  return (
    <div className="w-full max-w-lg">
      {/* Status badge */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-emerald-700 ring-1 ring-emerald-200">
          <ShieldCheck className="size-5" />
          <span className="text-sm font-semibold">Verified</span>
        </div>
      </div>

      {/* Certificate card */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">
          QC Validation Certificate
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          This certificate confirms the dataset passed QC validation.
        </p>

        <div className="mt-6 space-y-4">
          <DetailRow label="Dataset" value={data.dataset_name ?? "Unknown"} />
          <DetailRow label="Validated" value={formatDate(data.validated_at)} />
          <DetailRow
            label="Rules Applied"
            value={data.rules_applied?.join(", ") ?? "None"}
          />
          <DetailRow
            label="Issues Found"
            value={String(data.issue_count ?? 0)}
          />
          <DetailRow
            label="Pass Rate"
            value={`${(data.pass_rate ?? 0).toFixed(1)}%`}
          />
          <DetailRow label="Organisation" value={data.org_name ?? "Unknown"} />

          <div className="flex items-start justify-between border-t pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Certificate Hash</p>
              <p className="mt-0.5 font-mono text-xs text-foreground">
                {data.hmac_hash ? truncateHash(data.hmac_hash) : "N/A"}
              </p>
            </div>
            {data.hmac_hash && <CopyButton text={data.hmac_hash} label="Copy" />}
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground">Certificate ID</p>
            <p className="mt-0.5 font-mono text-xs text-foreground">{data.id}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function RevokedCertificate({ data }: { data: VerifyResponse }) {
  return (
    <div className="w-full max-w-lg">
      {/* Status badge */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-red-700 ring-1 ring-red-200">
          <ShieldX className="size-5" />
          <span className="text-sm font-semibold">Revoked</span>
        </div>
      </div>

      {/* Revocation card */}
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">
          Certificate Revoked
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This certificate has been revoked by the issuing organisation and is no longer valid.
        </p>

        <div className="mt-6 space-y-4">
          <DetailRow label="Revoked On" value={formatDate(data.revoked_at)} />
          {data.revocation_reason && (
            <DetailRow label="Reason" value={data.revocation_reason} />
          )}
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground">Certificate ID</p>
            <p className="mt-0.5 font-mono text-xs text-foreground">{data.id}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function NotFoundCertificate() {
  return (
    <div className="w-full max-w-lg">
      {/* Status badge */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-gray-600 ring-1 ring-gray-200">
          <ShieldQuestion className="size-5" />
          <span className="text-sm font-semibold">Not Found</span>
        </div>
      </div>

      {/* Not found card */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">
          Certificate Not Found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No certificate was found with this ID. It may have been issued on a different
          platform or the ID may be incorrect.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          If you believe this is an error, please contact the organisation that issued
          the certificate.
        </p>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
    </div>
  )
}
