"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, ChevronDown } from "lucide-react"
import type { OrgMember, OrgRole } from "@/lib/types/organisations"
import { removeMember, updateMemberRole } from "@/lib/actions/team"

const ROLE_COLORS: Record<OrgRole, string> = {
  admin: "bg-blue-50 text-blue-700 border-blue-200",
  reviewer: "bg-amber-50 text-amber-700 border-amber-200",
  viewer: "bg-gray-50 text-gray-600 border-gray-200",
}

const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Admin",
  reviewer: "Reviewer",
  viewer: "Viewer",
}

interface MemberListProps {
  members: OrgMember[]
  currentUserId: string
  isAdmin: boolean
  onMembersChange: () => void
}

export function MemberList({
  members,
  currentUserId,
  isAdmin,
  onMembersChange,
}: MemberListProps) {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleRoleChange(memberId: string, newRole: OrgRole) {
    setRoleDropdownOpen(null)
    startTransition(async () => {
      const result = await updateMemberRole(memberId, newRole)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Role updated")
        onMembersChange()
      }
    })
  }

  function handleRemove(memberId: string) {
    setConfirmRemove(null)
    startTransition(async () => {
      const result = await removeMember(memberId)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Member removed")
        onMembersChange()
      }
    })
  }

  if (members.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No team members yet.
      </p>
    )
  }

  return (
    <div className="divide-y rounded-xl border">
      {members.map((member) => {
        const isCurrentUser = member.user_id === currentUserId
        const role = member.role as OrgRole
        const name = member.profiles?.full_name || member.profiles?.email || "Unknown"
        const email = member.profiles?.email || ""

        return (
          <div
            key={member.id}
            className={`flex items-center justify-between gap-4 px-4 py-3 ${
              isCurrentUser ? "bg-muted/30" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">
                  {name}
                  {isCurrentUser && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                  )}
                </p>
              </div>
              {email && (
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Role badge / dropdown */}
              {isAdmin && !isCurrentUser ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setRoleDropdownOpen(
                        roleDropdownOpen === member.id ? null : member.id
                      )
                    }
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${ROLE_COLORS[role]}`}
                    disabled={pending}
                  >
                    {ROLE_LABELS[role]}
                    <ChevronDown className="size-3" />
                  </button>

                  {roleDropdownOpen === member.id && (
                    <div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border bg-background shadow-lg">
                      {(["admin", "reviewer", "viewer"] as OrgRole[]).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => handleRoleChange(member.id, r)}
                          className={`block w-full cursor-pointer px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted ${
                            r === role ? "font-semibold" : ""
                          }`}
                        >
                          {ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Badge
                  variant="outline"
                  className={`text-xs ${ROLE_COLORS[role]}`}
                >
                  {ROLE_LABELS[role]}
                </Badge>
              )}

              {/* Remove button (admin only, not self) */}
              {isAdmin && !isCurrentUser && (
                <div className="relative">
                  {confirmRemove === member.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 rounded-lg px-2 text-xs"
                        onClick={() => handleRemove(member.id)}
                        disabled={pending}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 rounded-lg px-2 text-xs"
                        onClick={() => setConfirmRemove(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 rounded-lg p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmRemove(member.id)}
                      disabled={pending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
