import Link from 'next/link'

export function CtaSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl bg-primary px-8 py-16 text-center text-primary-foreground sm:px-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to automate your survey QC?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
            Start validating your survey data in minutes. No credit card
            required.
          </p>
          <div className="mt-8">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center justify-center rounded-md bg-white px-8 text-base font-medium text-primary shadow-sm transition-colors hover:bg-white/90"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
