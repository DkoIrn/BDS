import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  SlidersHorizontal,
  Sparkles,
  Download,
  Search,
  BarChart3,
} from "lucide-react"

const features = [
  {
    icon: ShieldCheck,
    title: "Comprehensive Validation",
    description:
      "DOB, DOC, TOP, KP, coordinates — every survey data type checked against industry rules. Missing data, tolerance violations, and format errors caught instantly.",
    color: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
  },
  {
    icon: AlertTriangle,
    title: "Anomaly Detection",
    description:
      "Statistical outlier detection, spike identification, and gap analysis. Flags suspicious values with explainable reasoning — no black-box AI.",
    color: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
  },
  {
    icon: Sparkles,
    title: "Auto-Fix QC Issues",
    description:
      "Duplicates removed, KP reordered, small gaps interpolated — automatically. Complex issues get AI-assisted suggestions you approve before applying.",
    color: "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400",
  },
  {
    icon: FileText,
    title: "Client-Ready Reports",
    description:
      "Generate annotated PDF reports with every issue documented. Context and reasoning included so clients understand exactly what was checked.",
    color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400",
  },
  {
    icon: SlidersHorizontal,
    title: "Validation Profiles",
    description:
      "Create reusable QC profiles with custom thresholds per survey type. Apply consistent standards across every project.",
    color: "bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400",
  },
  {
    icon: Search,
    title: "Column Auto-Detection",
    description:
      "Automatically identifies KP, easting, northing, DOB, depth, and other survey columns. Confidence scoring ensures correct mapping.",
    color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400",
  },
  {
    icon: BarChart3,
    title: "QC Dashboard",
    description:
      "Track pass rates, issue trends, and validation history across all projects. See your data quality at a glance.",
    color: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400",
  },
  {
    icon: Download,
    title: "Clean Data Export",
    description:
      "Export validated and corrected datasets as CSV or Excel. Flagged rows highlighted, audit trail preserved.",
    color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/30 dark:text-cyan-400",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-16 bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Every QC check your survey data needs
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Purpose-built for pipeline and seabed survey data. Catches what
            manual checking misses.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border bg-card p-5 transition-colors hover:bg-card/80"
            >
              <div className={`mb-3 flex size-10 items-center justify-center rounded-xl ${feature.color}`}>
                <feature.icon className="size-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
