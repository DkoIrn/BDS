import Link from "next/link"
import { Globe, Merge, Scissors, Sparkles } from "lucide-react"

const capabilities = [
  { icon: Globe, title: "CRS Conversion", description: "Transform between coordinate reference systems", href: "/tools/transform/crs", color: "bg-blue-50 text-blue-600" },
  { icon: Merge, title: "Merge Datasets", description: "Combine multiple survey files into one", href: "/tools/transform/merge", color: "bg-teal-50 text-teal-600" },
  { icon: Scissors, title: "Split by Region", description: "Split by KP range or column value", href: "/tools/transform/split", color: "bg-violet-50 text-violet-600" },
  { icon: Sparkles, title: "Auto-Fix", description: "Resolve flagged QC issues automatically", href: null, color: "bg-amber-50 text-amber-600" },
] as const

export default function TransformPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-xl font-semibold tracking-tight">Transform Tools</h1>
        <p className="mt-1 text-sm text-muted-foreground">Clean, merge, split, and convert coordinate systems</p>
      </div>

      <div className="animate-fade-up [animation-delay:80ms] [animation-fill-mode:backwards]">
        <div className="grid gap-3 sm:grid-cols-2">
          {capabilities.map((cap) => {
            const content = (
              <>
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${cap.color}`}>
                  <cap.icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{cap.title}</p>
                    {!cap.href && (
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{cap.description}</p>
                </div>
              </>
            )

            if (cap.href) {
              return (
                <Link
                  key={cap.title}
                  href={cap.href}
                  className="group flex items-start gap-3 rounded-2xl border bg-card p-4 transition-all hover:shadow-sm hover:border-border"
                >
                  {content}
                </Link>
              )
            }

            return (
              <div
                key={cap.title}
                className="flex items-start gap-3 rounded-2xl border bg-card p-4 opacity-50"
              >
                {content}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
