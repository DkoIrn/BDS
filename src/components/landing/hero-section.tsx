import Link from 'next/link'

export function HeroSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Text content */}
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Stop Spending Hours Manually Checking Survey Data
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground">
              Automated QC for pipeline and seabed survey data. Upload your
              files, get explainable flags in minutes — not hours. Every issue
              annotated with context so you can act fast.
            </p>
            <div className="flex gap-4">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-8 text-base font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent/90"
              >
                Get Started Free
              </Link>
              <Link
                href="#features"
                className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-base font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                Learn More
              </Link>
            </div>
          </div>

          {/* Product mockup placeholder */}
          <div className="relative">
            <div className="overflow-hidden rounded-xl border bg-card shadow-2xl">
              {/* Browser title bar */}
              <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="ml-2 flex-1 rounded bg-muted px-3 py-1 text-xs text-muted-foreground">
                  app.surveyqc.com/dashboard
                </div>
              </div>
              {/* Skeleton content */}
              <div className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <div className="h-6 w-40 rounded bg-primary/10" />
                  <div className="h-8 w-24 rounded bg-accent/20" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-20 rounded-lg bg-primary/5" />
                  <div className="h-20 rounded-lg bg-secondary/10" />
                  <div className="h-20 rounded-lg bg-accent/10" />
                </div>
                <div className="h-40 rounded-lg bg-gradient-to-br from-primary/5 to-secondary/5" />
                <div className="flex gap-2">
                  <div className="h-4 w-16 rounded bg-destructive/20" />
                  <div className="h-4 w-20 rounded bg-yellow-500/20" />
                  <div className="h-4 w-14 rounded bg-secondary/20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
