export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left side: form content */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>

      {/* Right side: brand visual panel (hidden on mobile/tablet) */}
      <div className="hidden flex-1 items-center justify-center bg-gray-200 lg:flex">
        <div className="text-center">
          <div className="mx-auto mb-8 flex items-center justify-center">
            <img src="/logo.png" alt="TruQC" className="h-16 w-auto" />
          </div>

          <p className="mt-3 max-w-xs text-base text-muted-foreground">
            Validate. Transform. Visualise.
          </p>

          <div className="mt-12 flex items-center justify-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
            <div className="h-1.5 w-8 rounded-full bg-teal-400/40" />
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
          </div>
        </div>
      </div>
    </div>
  )
}
