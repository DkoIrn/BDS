"use client"

import { useActionState, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Mail, X, Loader2 } from "lucide-react"
import { inviteTeamMember, cancelInvite } from "@/lib/actions/team"
import type { OrgInvite, OrgRole } from "@/lib/types/organisations"

const ROLE_OPTIONS: { value: OrgRole; label: string; description: string }[] = [
  { value: "viewer", label: "Viewer", description: "Can view and download" },
  { value: "reviewer", label: "Reviewer", description: "Can run QC and triage" },
  { value: "admin", label: "Admin", description: "Full access + team management" },
]

interface InviteDialogProps {
  open: boolean
  onClose: () => void
  invites: OrgInvite[]
  onInvitesChange: () => void
}

export function InviteDialog({
  open,
  onClose,
  invites,
  onInvitesChange,
}: InviteDialogProps) {
  const [state, formAction] = useActionState(inviteTeamMember, null)
  const [selectedRole, setSelectedRole] = useState<OrgRole>("viewer")
  const [cancelPending, startCancelTransition] = useTransition()

  // Show toast on success
  if (state?.success) {
    toast.success("Invite sent successfully")
    onInvitesChange()
    // Reset state after toast
    state.success = false
  }

  function handleCancel(inviteId: string) {
    startCancelTransition(async () => {
      const result = await cancelInvite(inviteId)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Invite cancelled")
        onInvitesChange()
      }
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-2xl border bg-background p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Invite Team Member</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-lg p-0"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder="colleague@company.com"
                className="rounded-xl pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedRole(option.value)}
                  className={`cursor-pointer rounded-xl border p-2 text-center transition-colors ${
                    selectedRole === option.value
                      ? "border-foreground bg-foreground/5"
                      : "hover:border-foreground/30"
                  }`}
                >
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
            <input type="hidden" name="role" value={selectedRole} />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button
            type="submit"
            className="w-full rounded-xl bg-foreground text-background hover:bg-foreground/90"
          >
            Send Invite
          </Button>
        </form>

        {/* Pending invites */}
        {invites.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Pending Invites
            </p>
            <div className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{invite.email}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {invite.role}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        Expires{" "}
                        {new Date(invite.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 rounded-lg p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleCancel(invite.id)}
                    disabled={cancelPending}
                  >
                    {cancelPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
