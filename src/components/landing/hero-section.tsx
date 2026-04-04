import Link from "next/link"
import { Shield, Clock, FileCheck } from "lucide-react"

const stats = [
  { icon: Shield, label: "Rule-based validation", detail: "No black boxes" },
  { icon: Clock, label: "Minutes, not hours", detail: "Async processing" },
  { icon: FileCheck, label: "Client-ready reports", detail: "PDF & Excel export" },
]

export function HeroSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-green-500" />
            Purpose-built for subsea & pipeline survey data
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Automated QC that your
            <span className="block text-primary"> clients can trust</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Upload your survey data. Get every anomaly flagged, every issue
            explained, and a client-ready report — in minutes, not hours.
            No more manual spreadsheet checking.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-foreground px-8 text-base font-semibold text-background shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Start Free QC Check
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-xl border bg-background px-8 text-base font-medium text-foreground transition-colors hover:bg-muted"
            >
              See How It Works
            </Link>
          </div>

          {/* Trust stats */}
          <div className="mx-auto mt-16 grid max-w-xl grid-cols-3 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <stat.icon className="size-4 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">{stat.label}</p>
                <p className="text-xs text-muted-foreground">{stat.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
