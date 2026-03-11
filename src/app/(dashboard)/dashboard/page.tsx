import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Upload, ClipboardCheck, BarChart3 } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single()

  const displayName = profile?.full_name?.split(" ")[0] || "there"

  return (
    <div className="space-y-10">
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-secondary p-8 text-white sm:p-10">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 size-32 rounded-full bg-secondary/30 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-white/70">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome back, {displayName}
          </h1>
          <p className="mt-2 max-w-md text-base text-white/80">
            Ready to validate your survey data? Upload a dataset to get started.
          </p>
          <div className="mt-6">
            <Link
              href="/projects"
              className="group inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-primary shadow-lg transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>

      {/* Quick action cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickAction
          icon={Upload}
          title="Upload Data"
          description="Import CSV or Excel survey files"
          color="primary"
          href="/projects"
        />
        <QuickAction
          icon={ClipboardCheck}
          title="Run QC Check"
          description="Validate against rule templates"
          color="secondary"
          href="/projects"
        />
        <QuickAction
          icon={BarChart3}
          title="View Reports"
          description="Review flagged anomalies"
          color="accent"
          href="/projects"
        />
      </div>
    </div>
  )
}

function QuickAction({
  icon: Icon,
  title,
  description,
  color,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  color: "primary" | "secondary" | "accent"
  href: string
}) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    accent: "bg-accent/10 text-accent",
  }

  return (
    <Link
      href={href}
      className="group flex flex-col items-start gap-3 rounded-xl border bg-card p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
    >
      <div
        className={`rounded-lg p-2.5 transition-transform duration-200 group-hover:scale-110 ${colorMap[color]}`}
      >
        <Icon className="size-5" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  )
}
