"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import type { OnboardingStep } from "../lib/onboarding-steps"

interface OnboardingTooltipProps {
  step: OnboardingStep
  currentIndex: number
  totalSteps: number
  onNext: () => void
  onSkip: () => void
}

export function OnboardingTooltip({
  step,
  currentIndex,
  totalSteps,
  onNext,
  onSkip,
}: OnboardingTooltipProps) {
  const [highlight, setHighlight] = useState<DOMRect | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updateHighlight = useCallback(() => {
    const el = document.querySelector(step.selector)
    if (el) {
      setHighlight(el.getBoundingClientRect())
    } else {
      setHighlight(null)
    }
  }, [step.selector])

  useEffect(() => {
    // Retry with increasing delays to handle stage render/animation timing
    const delays = [50, 200, 500]
    const timers = delays.map((ms) => setTimeout(updateHighlight, ms))
    return () => timers.forEach(clearTimeout)
  }, [updateHighlight])

  useEffect(() => {
    window.addEventListener("resize", updateHighlight)
    window.addEventListener("scroll", updateHighlight)
    const observer = new ResizeObserver(updateHighlight)
    observer.observe(document.body)
    return () => {
      window.removeEventListener("resize", updateHighlight)
      window.removeEventListener("scroll", updateHighlight)
      observer.disconnect()
    }
  }, [updateHighlight])

  if (!mounted) return null

  const padding = 8

  // Calculate tooltip position: prefer below the highlight, fallback to center
  const getTooltipStyle = (): React.CSSProperties => {
    if (!highlight) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
    }

    const tooltipHeight = 200
    const top = highlight.bottom + 16
    const fitsBelow = top + tooltipHeight < window.innerHeight

    const baseTop = fitsBelow ? top : Math.max(16, highlight.top - tooltipHeight - 16)
    const centerX = highlight.left + highlight.width / 2

    return {
      position: "fixed",
      top: baseTop,
      left: Math.max(16, Math.min(centerX - 180, window.innerWidth - 376)),
      maxWidth: "min(360px, calc(100vw - 32px))",
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop with spotlight cutout */}
      <div
        className="absolute inset-0 bg-black/60 transition-all duration-300"
        style={
          highlight
            ? {
                clipPath: `polygon(
                  0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                  ${highlight.left - padding}px ${highlight.top - padding}px,
                  ${highlight.left - padding}px ${highlight.bottom + padding}px,
                  ${highlight.right + padding}px ${highlight.bottom + padding}px,
                  ${highlight.right + padding}px ${highlight.top - padding}px,
                  ${highlight.left - padding}px ${highlight.top - padding}px
                )`,
              }
            : {}
        }
      />

      {/* Highlight ring */}
      {highlight && (
        <div
          className="absolute rounded-xl ring-2 ring-teal-400 ring-offset-2 ring-offset-transparent transition-all duration-300 pointer-events-none"
          style={{
            top: highlight.top - padding,
            left: highlight.left - padding,
            width: highlight.width + padding * 2,
            height: highlight.height + padding * 2,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="bg-background border border-border rounded-xl shadow-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-300"
        style={getTooltipStyle()}
      >
        <h3 className="font-semibold text-sm">{step.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {step.description}
        </p>

        <p className="mt-3 text-xs text-muted-foreground/70">
          Step {currentIndex + 1} of {totalSteps}
        </p>

        <div className="mt-4 flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === currentIndex
                    ? "w-4 bg-teal-500"
                    : i < currentIndex
                      ? "w-1.5 bg-teal-500/40"
                      : "w-1.5 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip Tour
            </button>
            <Button
              size="sm"
              onClick={onNext}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              {currentIndex === totalSteps - 1 ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
