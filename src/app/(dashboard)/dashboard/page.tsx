import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import {
  Upload,
  ClipboardCheck,
  BarChart3,
  ArrowRightLeft,
  Map,
  Wrench,
  GitCompareArrows,
  FolderOpen,
  FileSpreadsheet,
  TrendingUp,
  ArrowRight,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Percent,
  Workflow,
} from "lucide-react"

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

  // Fetch quick stats
  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id)

  const { count: fileCount } = await supabase
    .from("datasets")
    .select("*, jobs!inner(*, projects!inner(user_id))", { count: "exact", head: true })
    .eq("jobs.projects.user_id", user!.id)

  const { count: validatedCount } = await supabase
    .from("datasets")
    .select("*, jobs!inner(*, projects!inner(user_id))", { count: "exact", head: true })
    .eq("jobs.projects.user_id", user!.id)
    .eq("status", "validated")

  // Recent activity - last 5 datasets
  const { data: recentDatasets } = await supabase
    .from("datasets")
    .select("id, file_name, status, created_at, jobs!inner(id, name, projects!inner(id, name, user_id))")
    .eq("jobs.projects.user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(5)

  const displayName = profile?.full_name?.split(" ")[0] || "there"
  const totalFiles = fileCount ?? 0
  const validated = validatedCount ?? 0
  const validationRate = totalFiles > 0 ? Math.round((validated / totalFiles) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Compact greeting bar */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {displayName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Link
          href="/projects"
          className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Go to Projects
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Bento stats grid */}
      <div className="grid animate-fade-up gap-4 [animation-delay:80ms] [animation-fill-mode:backwards] grid-cols-2 lg:grid-cols-4">
        <BentoStat
          icon={FolderOpen}
          label="Projects"
          value={projectCount ?? 0}
          color="blue"
        />
        <BentoStat
          icon={FileSpreadsheet}
          label="Datasets"
          value={totalFiles}
          color="teal"
        />
        <BentoStat
          icon={CheckCircle2}
          label="Validated"
          value={validated}
          color="emerald"
        />
        {/* Featured stat - validation rate */}
        <div className="relative overflow-hidden rounded-2xl border bg-foreground p-5 text-background">
          <div className="absolute -right-6 -top-6 size-24 rounded-full bg-white/[0.06]" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-medium text-background/50">
              <Percent className="size-3.5" />
              Validation Rate
            </div>
            <p className="mt-2 text-4xl font-extrabold tracking-tighter">
              {validationRate}%
            </p>
            <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
              <div
                className="h-1.5 rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${validationRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main content: Activity + Tools */}
      <div className="grid animate-fade-up gap-4 [animation-delay:160ms] [animation-fill-mode:backwards] lg:grid-cols-5">
        {/* Recent activity - takes 3 cols */}
        <div className="rounded-2xl border bg-card p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
            </div>
            <Link href="/projects" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              View all
            </Link>
          </div>

          <div className="mt-4 space-y-1">
            {recentDatasets && recentDatasets.length > 0 ? (
              recentDatasets.map((dataset: any) => {
                const project = dataset.jobs?.projects
                const job = dataset.jobs
                return (
                  <Link
                    key={dataset.id}
                    href={`/projects/${project?.id}/jobs/${job?.id}/files/${dataset.id}`}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60"
                  >
                    <ActivityIcon status={dataset.status} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground group-hover:text-foreground/90">
                        {dataset.file_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {project?.name} / {job?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={dataset.status} />
                      <span className="text-[11px] text-muted-foreground/60">
                        {formatRelativeTime(dataset.created_at)}
                      </span>
                    </div>
                  </Link>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                  <FileSpreadsheet className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm font-medium text-muted-foreground">No activity yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Upload your first dataset to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Tools grid - takes 2 cols */}
        <div className="space-y-4 lg:col-span-2">
          {/* Quick actions */}
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Quick Actions</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <QuickAction icon={Upload} label="Upload" href="/projects" color="blue" />
              <QuickAction icon={ClipboardCheck} label="Validate" href="/projects" color="emerald" />
              <QuickAction icon={BarChart3} label="Reports" href="/reports" color="amber" />
              <QuickAction icon={Workflow} label="Pipeline" href="/pipeline" color="violet" />
            </div>
          </div>

          {/* Tools */}
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Tools</h2>
            <div className="mt-3 space-y-1.5">
              <ToolRow icon={ArrowRightLeft} title="Convert" description="File format conversion" href="/tools/convert" color="blue" live />
              <ToolRow icon={Map} title="Visualize" description="Interactive map plots" href="/tools/visualize" color="violet" live />
              <ToolRow icon={Wrench} title="Transform" description="CRS, merge & split" href="/tools/transform" color="teal" live />
              <ToolRow icon={GitCompareArrows} title="Compare" description="Dataset diff" href="/tools/compare" color="amber" live />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Sub-components ---

function BentoStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  color: "blue" | "teal" | "emerald"
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    teal: "bg-teal-50 text-teal-600",
    emerald: "bg-emerald-50 text-emerald-600",
  }

  return (
    <div className="rounded-2xl border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className={`flex size-9 items-center justify-center rounded-xl ${colorMap[color]}`}>
        <Icon className="size-4" />
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tighter text-foreground">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

const quickActionColors = {
  blue: { bg: "bg-blue-50 group-hover:bg-blue-100", icon: "text-blue-600" },
  emerald: { bg: "bg-emerald-50 group-hover:bg-emerald-100", icon: "text-emerald-600" },
  amber: { bg: "bg-amber-50 group-hover:bg-amber-100", icon: "text-amber-600" },
  violet: { bg: "bg-violet-50 group-hover:bg-violet-100", icon: "text-violet-600" },
}

function QuickAction({
  icon: Icon,
  label,
  href,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href: string
  color: keyof typeof quickActionColors
}) {
  const c = quickActionColors[color]
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 p-4 text-center transition-all hover:border-solid hover:border-border hover:bg-muted/40 hover:shadow-sm"
    >
      <div className={`flex size-9 items-center justify-center rounded-xl transition-colors ${c.bg}`}>
        <Icon className={`size-4 transition-colors ${c.icon}`} />
      </div>
      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">{label}</span>
    </Link>
  )
}

const toolRowColors = {
  blue: { bg: "bg-blue-50", icon: "text-blue-600" },
  teal: { bg: "bg-teal-50", icon: "text-teal-600" },
  amber: { bg: "bg-amber-50", icon: "text-amber-600" },
  violet: { bg: "bg-violet-50", icon: "text-violet-600" },
}

function ToolRow({
  icon: Icon,
  title,
  description,
  href,
  color,
  live,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  href: string
  color: keyof typeof toolRowColors
  live?: boolean
}) {
  const c = toolRowColors[color]
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60"
    >
      <div className={`flex size-8 items-center justify-center rounded-lg ${c.bg}`}>
        <Icon className={`size-3.5 ${c.icon}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      {!live && (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Soon
        </span>
      )}
    </Link>
  )
}

function ActivityIcon({ status }: { status: string }) {
  if (status === "validated") {
    return (
      <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50">
        <CheckCircle2 className="size-3.5 text-emerald-600" />
      </div>
    )
  }
  if (status === "validation_error") {
    return (
      <div className="flex size-8 items-center justify-center rounded-lg bg-red-50">
        <AlertTriangle className="size-3.5 text-red-500" />
      </div>
    )
  }
  return (
    <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
      <Clock className="size-3.5 text-muted-foreground" />
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "validated") {
    return <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Validated</span>
  }
  if (status === "validation_error") {
    return <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">Error</span>
  }
  if (status === "validating") {
    return <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">Running</span>
  }
  return <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Uploaded</span>
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
