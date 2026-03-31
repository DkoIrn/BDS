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
      <div className="hidden flex-1 items-center justify-center bg-foreground lg:flex">
        <div className="text-center">
          <div className="mx-auto mb-8 flex items-center justify-center">
            <div className="rounded-2xl bg-white/95 px-6 py-4 shadow-lg">
              <img src="/logo.png" alt="DataFlow" className="h-14 w-auto" />
            </div>
          </div>

          <p className="mt-3 max-w-xs text-base text-white/60">
            Validate. Transform. Visualise.
          </p>

          <div className="mt-12 flex items-center justify-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
            <div className="h-1.5 w-8 rounded-full bg-teal-400/40" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  )
}
