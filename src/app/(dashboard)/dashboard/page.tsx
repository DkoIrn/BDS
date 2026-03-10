import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch profile for full_name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single()

  const displayName = profile?.full_name || "there"

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardContent className="pt-2">
          <h1 className="text-2xl font-bold text-primary">
            Welcome back, {displayName}!
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your survey data quality control dashboard
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
