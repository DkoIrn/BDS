"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Certificate } from "@/lib/types/certificate"

interface RevokeDialogProps {
  certificate: Certificate
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  orgId: string
  onRevoked: () => void
}

export function RevokeDialog({
  certificate,
  open,
  onOpenChange,
  userId,
  orgId,
  onRevoked,
}: RevokeDialogProps) {
  const [reason, setReason] = useState("")
  const [isRevoking, setIsRevoking] = useState(false)

  const handleRevoke = async () => {
    setIsRevoking(true)
    try {
      const res = await fetch("/api/certificates/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certId: certificate.id,
          reason: reason.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || "Failed to revoke certificate")
      }

      toast.success("Certificate revoked")
      onRevoked()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to revoke certificate"
      )
    } finally {
      setIsRevoking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke Certificate</DialogTitle>
          <DialogDescription>
            This action is permanent. The certificate for{" "}
            <span className="font-medium text-foreground">
              {certificate.dataset_name}
            </span>{" "}
            will be marked as revoked and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label
            htmlFor="revoke-reason"
            className="text-sm font-medium text-foreground"
          >
            Reason for revocation{" "}
            <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="revoke-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Data found to be incorrect"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRevoking}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRevoke}
            disabled={isRevoking}
          >
            {isRevoking && <Loader2 className="mr-2 size-4 animate-spin" />}
            Revoke Certificate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
