"use client"

import { CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface OnboardingCelebrationProps {
  issueCount: number
  fixCount: number
  onFinish: () => void
}

export function OnboardingCelebration({
  issueCount,
  fixCount,
  onFinish,
}: OnboardingCelebrationProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 pt-20 backdrop-blur-sm sm:items-center sm:pt-0">
      <Card className="mx-4 w-full max-w-md rounded-2xl">
        <CardContent className="flex flex-col items-center px-6 py-8 text-center sm:px-8 sm:py-10">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50">
            <CheckCircle2 className="size-7 text-emerald-600" />
          </div>

          <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
            Pipeline Complete!
          </h2>

          <div className="mt-6 grid w-full grid-cols-3 gap-3">
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-2xl font-bold text-foreground">{issueCount}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">issues detected</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-2xl font-bold text-foreground">{fixCount}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">fixes applied</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-2xl font-bold text-foreground">&lt;3</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">minutes</p>
            </div>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            TruQC automates quality checks on your survey data. Upload your own
            files to get started.
          </p>

          <Button
            onClick={onFinish}
            className="mt-6 w-full rounded-xl bg-foreground text-background hover:bg-foreground/90"
          >
            Start Using TruQC
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
