import { Upload, ArrowRight } from "lucide-react"

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-xl font-semibold tracking-tight">Dataset Comparison</h1>
        <p className="mt-1 text-sm text-muted-foreground">Compare as-built vs as-designed survey datasets</p>
      </div>

      <div className="animate-fade-up [animation-delay:80ms] [animation-fill-mode:backwards]">
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <div className="mx-auto flex items-center justify-center gap-5">
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50">
                <Upload className="size-5 text-blue-400" />
              </div>
              <span className="text-[11px] text-muted-foreground">As-Designed</span>
            </div>
            <ArrowRight className="size-4 text-muted-foreground/30" />
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50">
                <Upload className="size-5 text-amber-400" />
              </div>
              <span className="text-[11px] text-muted-foreground">As-Built</span>
            </div>
          </div>
          <h2 className="mt-6 text-sm font-semibold">Coming Soon</h2>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-sm mx-auto">
            Upload two datasets and see differences highlighted row by row with tolerance thresholds.
          </p>
        </div>
      </div>
    </div>
  )
}
