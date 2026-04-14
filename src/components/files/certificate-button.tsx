"use client"

import { useState } from "react"
import { Shield, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface CertificateButtonProps {
  runId: string
  criticalCount: number
  status: string
}

export function CertificateButton({ runId, criticalCount, status }: CertificateButtonProps) {
  const [generating, setGenerating] = useState(false)

  // Only show for completed runs with no critical issues
  if (status !== "completed" || criticalCount > 0) {
    return null
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Certificate generation failed" }))
        throw new Error(body.error || "Certificate generation failed")
      }

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl

      // Extract filename from content-disposition header
      const disposition = res.headers.get("content-disposition") ?? ""
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
      a.download = filenameMatch?.[1] ?? "TruQC-Certificate.pdf"

      a.click()
      URL.revokeObjectURL(blobUrl)
      toast.success("Certificate downloaded")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Certificate generation failed"
      toast.error(message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={generating}
      onClick={handleGenerate}
      className="border-teal-200 text-teal-700 hover:bg-teal-50"
    >
      {generating ? (
        <Loader2 className="animate-spin" />
      ) : (
        <Shield />
      )}
      {generating ? "Generating..." : "Certificate"}
    </Button>
  )
}
