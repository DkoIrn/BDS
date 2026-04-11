"use client"

import { ShieldCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface OnboardingWelcomeProps {
  onStart: () => void
  onSkip: () => void
}

export function OnboardingWelcome({ onStart, onSkip }: OnboardingWelcomeProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-md rounded-2xl">
        <CardContent className="flex flex-col items-center px-8 py-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-teal-50">
            <ShieldCheck className="size-7 text-teal-600" />
          </div>

          <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
            Welcome to TruQC
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            See how TruQC catches survey data issues in under 3 minutes. We'll
            walk you through a real pipeline inspection with demo data.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3">
            <Button
              onClick={onStart}
              className="w-full rounded-xl bg-foreground text-background hover:bg-foreground/90"
            >
              Start Guided Tour
            </Button>
            <Button
              variant="ghost"
              onClick={onSkip}
              className="w-full rounded-xl text-muted-foreground"
            >
              Skip and Explore
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
