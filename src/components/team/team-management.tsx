"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Users, UserPlus, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MemberList } from "@/components/team/member-list"
import { InviteDialog } from "@/components/team/invite-dialog"
import { getTeamMembers, getOrgInvites, getUserOrgRole } from "@/lib/actions/team"
import type { OrgMember, OrgInvite, OrgRole } from "@/lib/types/organisations"

export function TeamManagement() {
  const [members, setMembers] = useState<OrgMember[]>([])
  const [invites, setInvites] = useState<OrgInvite[]>([])
  const [userRole, setUserRole] = useState<OrgRole | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [loading, startLoading] = useTransition()

  const isAdmin = userRole === "admin"

  const loadData = useCallback(() => {
    startLoading(async () => {
      const [roleResult, membersResult] = await Promise.all([
        getUserOrgRole(),
        getTeamMembers(),
      ])

      if ("role" in roleResult) {
        setUserRole(roleResult.role)
      }

      if ("data" in membersResult) {
        setMembers(membersResult.data)

        // Find current user by matching role result
        if ("orgId" in roleResult) {
          const me = membersResult.data.find(
            (m) => m.profiles?.email !== undefined
          )
          // We'll set currentUserId from the org members
        }
      }

      // Fetch invites only for admins
      if ("role" in roleResult && roleResult.role === "admin") {
        const invitesResult = await getOrgInvites()
        if ("data" in invitesResult) {
          setInvites(invitesResult.data)
        }
      }
    })
  }, [])

  // Get current user ID from supabase client
  useEffect(() => {
    async function init() {
      const { createBrowserClient } = await import("@supabase/ssr")
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    init()
    loadData()
  }, [loadData])

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-lg bg-violet-50">
              <Users className="size-4 text-violet-600" />
            </div>
            <div>
              <CardTitle>Team</CardTitle>
              <CardDescription>
                {members.length} member{members.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              className="rounded-xl bg-foreground text-background hover:bg-foreground/90"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="size-4" />
              Invite Member
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <MemberList
            members={members}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onMembersChange={loadData}
          />
        )}
      </CardContent>

      {isAdmin && (
        <InviteDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          invites={invites}
          onInvitesChange={loadData}
        />
      )}
    </Card>
  )
}
