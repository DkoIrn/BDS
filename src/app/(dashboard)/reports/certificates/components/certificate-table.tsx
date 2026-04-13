"use client"

import { useState, useMemo } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  MoreHorizontal,
  Download,
  Link2,
  ShieldX,
  ArrowUpDown,
  ShieldCheck,
  Award,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RevokeDialog } from "./revoke-dialog"
import type { Certificate, CertificateStatus } from "@/lib/types/certificate"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | CertificateStatus

interface CertificateTableProps {
  certificates: Certificate[]
  isAdmin: boolean
  userId: string
  orgId: string
}

export function CertificateTable({
  certificates,
  isAdmin,
  userId,
  orgId,
}: CertificateTableProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortDesc, setSortDesc] = useState(true)
  const [revokeTarget, setRevokeTarget] = useState<Certificate | null>(null)

  const filtered = useMemo(() => {
    let items = certificates
    if (statusFilter !== "all") {
      items = items.filter((c) => c.status === statusFilter)
    }
    return items.sort((a, b) => {
      const dateA = new Date(a.validated_at).getTime()
      const dateB = new Date(b.validated_at).getTime()
      return sortDesc ? dateB - dateA : dateA - dateB
    })
  }, [certificates, statusFilter, sortDesc])

  const handleCopyLink = async (certId: string) => {
    const url = `https://truqc.co.uk/verify/${certId}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Verify link copied to clipboard")
    } catch {
      toast.error("Failed to copy link")
    }
  }

  const handleDownload = async (certId: string) => {
    // Certificate download via the generate endpoint re-download
    const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || ""
    if (!fastApiUrl) {
      // Use relative API route as proxy
      toast.error("PDF download not yet configured")
      return
    }
    window.open(`${fastApiUrl}/api/v1/certificate/download/${certId}`, "_blank")
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    } catch {
      return dateStr
    }
  }

  const filterTabs: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Revoked", value: "revoked" },
  ]

  return (
    <div className="mt-6 space-y-4">
      {/* Status filter tabs */}
      <div className="flex items-center gap-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              statusFilter === tab.value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-50">
            <Award className="size-6 text-violet-600" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">
            {statusFilter === "all"
              ? "No certificates issued yet"
              : `No ${statusFilter} certificates`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Certificates are generated when a dataset passes QC validation
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Dataset</th>
                <th className="px-4 py-3 font-medium">
                  <button
                    onClick={() => setSortDesc(!sortDesc)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Validation Date
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Certificate ID</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cert) => (
                <tr key={cert.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{cert.dataset_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(cert.validated_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={cert.issue_count === 0 ? "outline" : "destructive"}
                      className="rounded-md text-[10px]"
                    >
                      {cert.issue_count === 0 ? "Pass" : `${cert.issue_count} issues`}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {cert.status === "active" ? (
                      <Badge className="rounded-md bg-emerald-50 text-[10px] text-emerald-700 ring-1 ring-emerald-200">
                        <ShieldCheck className="mr-1 size-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="rounded-md text-[10px]">
                        <ShieldX className="mr-1 size-3" />
                        Revoked
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {cert.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon" className="size-8" />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDownload(cert.id)}>
                          <Download className="mr-2 size-4" />
                          Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyLink(cert.id)}>
                          <Link2 className="mr-2 size-4" />
                          Copy verify link
                        </DropdownMenuItem>
                        {isAdmin && cert.status === "active" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setRevokeTarget(cert)}
                            >
                              <ShieldX className="mr-2 size-4" />
                              Revoke
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Revoke dialog */}
      {revokeTarget && (
        <RevokeDialog
          certificate={revokeTarget}
          open={!!revokeTarget}
          onOpenChange={(open) => {
            if (!open) setRevokeTarget(null)
          }}
          userId={userId}
          orgId={orgId}
          onRevoked={() => {
            setRevokeTarget(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
