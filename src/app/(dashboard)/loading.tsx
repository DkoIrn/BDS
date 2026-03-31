import Image from "next/image"

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        {/* Logo with pulse animation */}
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-2xl bg-foreground/5" style={{ animationDuration: "1.5s" }} />
          <Image
            src="/logo.png"
            alt="DataFlow"
            width={48}
            height={48}
            className="relative rounded-2xl animate-logo-breathe"
          />
        </div>

        {/* Spinner bar */}
        <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-loading-slide rounded-full bg-foreground/70" />
        </div>

        <p className="text-xs font-medium text-muted-foreground/60 tracking-wide">Loading</p>
      </div>
    </div>
  )
}
