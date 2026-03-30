import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { MergeTool } from "./merge-tool"

export default function MergePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="animate-fade-up">
        <Link
          href="/tools/transform"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3" />
          Transform Tools
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Merge Datasets</h1>
        <p className="mt-1 text-sm text-muted-foreground">Combine multiple survey files into one</p>
      </div>

      <div className="animate-fade-up [animation-delay:80ms] [animation-fill-mode:backwards]">
        <MergeTool />
      </div>
    </div>
  )
}
