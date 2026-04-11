import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TopNavbar } from "@/components/top-navbar"
import { RealtimeProvider } from "@/components/realtime-provider"
import { DashboardEntry } from "@/components/dashboard-entry"
import { TutorialOverlay } from "@/components/tutorial-overlay"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch profile for full_name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single()

  const userData = {
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavbar user={userData} userId={user.id} />
      <TutorialOverlay />
      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <RealtimeProvider userId={user.id}>
          <DashboardEntry>{children}</DashboardEntry>
        </RealtimeProvider>
      </main>
    </div>
  )
}
