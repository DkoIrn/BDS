import Link from 'next/link'

export function LandingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
            SQ
          </span>
          <span className="font-medium text-foreground">SurveyQC</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <Link href="/login" className="transition-colors hover:text-foreground">
            Login
          </Link>
          <Link href="#" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="#" className="transition-colors hover:text-foreground">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  )
}
