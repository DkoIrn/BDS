import { CompareTool } from "./compare-tool"

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-xl font-semibold tracking-tight">Dataset Comparison</h1>
        <p className="mt-1 text-sm text-muted-foreground">Compare as-built vs as-designed survey datasets</p>
      </div>

      <div className="animate-fade-up [animation-delay:80ms] [animation-fill-mode:backwards]">
        <CompareTool />
      </div>
    </div>
  )
}
