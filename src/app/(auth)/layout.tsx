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
      <div className="hidden flex-1 items-center justify-center bg-[#1E3A8A] lg:flex">
        <div className="text-center">
          {/* Decorative geometric element */}
          <div className="mx-auto mb-8 flex items-center justify-center">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-white/10" />
              <div className="absolute -right-3 -top-3 h-12 w-12 rounded-xl bg-[#14B8A6]/60" />
              <div className="absolute -bottom-2 -left-2 h-8 w-8 rounded-lg bg-[#F97316]/50" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white">SurveyQC AI</h1>
          <p className="mt-3 max-w-xs text-base text-white/70">
            Automated quality control for survey data
          </p>

          {/* Subtle decorative dots */}
          <div className="mt-12 flex items-center justify-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
            <div className="h-1.5 w-8 rounded-full bg-[#14B8A6]/40" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  )
}
