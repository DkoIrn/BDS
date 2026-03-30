import Link from "next/link"
import { Globe, Merge, Scissors, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const capabilities = [
  { icon: Globe, title: "CRS Conversion", description: "Transform between coordinate reference systems", href: "/tools/transform/crs" },
  { icon: Merge, title: "Merge Datasets", description: "Combine multiple survey files into one", href: "/tools/transform/merge" },
  { icon: Scissors, title: "Split by Region", description: "Split by KP range or column value", href: "/tools/transform/split" },
  { icon: Sparkles, title: "Auto-Clean", description: "Fix flagged issues from QC automatically", href: null },
] as const

export default function TransformPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-xl font-semibold tracking-tight">Transform Tools</h1>
        <p className="mt-1 text-sm text-muted-foreground">Clean, merge, split, and convert coordinate systems</p>
      </div>

      <div className="animate-fade-up [animation-delay:80ms] [animation-fill-mode:backwards]">
        <h3 className="mb-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">Tools</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {capabilities.map((cap) => {
            const content = (
              <>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <cap.icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{cap.title}</p>
                    {!cap.href && (
                      <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
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
                  className="flex items-start gap-3 rounded-lg border p-3.5 transition-colors hover:border-primary/50 hover:bg-muted/30"
                >
                  {content}
                </Link>
              )
            }

            return (
              <div
                key={cap.title}
                className="flex items-start gap-3 rounded-lg border p-3.5 opacity-60"
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
