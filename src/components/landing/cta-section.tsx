import Link from "next/link"

export function CtaSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl bg-foreground px-8 py-16 text-center text-background sm:px-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Stop spending hours on manual QC
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-background/70">
            Upload your survey data and get a validated, client-ready report in
            minutes. No credit card required.
          </p>
          <div className="mt-8">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-background px-8 text-base font-semibold text-foreground shadow-sm transition-all hover:bg-background/90 active:scale-[0.98]"
            >
              Start Your Free QC Check
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
