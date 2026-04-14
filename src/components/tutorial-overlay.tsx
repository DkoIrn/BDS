"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  LayoutDashboard,
  ShieldCheck,
  FolderOpen,
  BarChart3,
  Wrench,
  Bell,
  Settings,
  User,
  Menu,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface TutorialStep {
  selector: string
  title: string
  description: string
  icon: React.ElementType
  position?: "bottom" | "bottom-left" | "bottom-right"
}

const desktopSteps: TutorialStep[] = [
  {
    selector: '[data-tutorial="dashboard"]',
    title: "Dashboard",
    description:
      "Your home base. View recent activity, job statuses, and quick stats at a glance.",
    icon: LayoutDashboard,
    position: "bottom",
  },
  {
    selector: '[data-tutorial="pipeline"]',
    title: "QC Pipeline",
    description:
      "Upload your survey data and run quality checks step by step — from file upload to final report.",
    icon: ShieldCheck,
    position: "bottom",
  },
  {
    selector: '[data-tutorial="projects"]',
    title: "Projects",
    description:
      "Organise your work into projects. Each project holds survey jobs, datasets, and reports.",
    icon: FolderOpen,
    position: "bottom",
  },
  {
    selector: '[data-tutorial="reports"]',
    title: "QC Reports",
    description:
      "View and download your completed QC reports with detailed findings and statistics.",
    icon: BarChart3,
    position: "bottom",
  },
  {
    selector: '[data-tutorial="tools"]',
    title: "Tools",
    description:
      "Utilities to convert, transform, compare, and visualise your survey data.",
    icon: Wrench,
    position: "bottom",
  },
  {
    selector: '[data-tutorial="notifications"]',
    title: "Notifications",
    description:
      "Get notified when your QC jobs complete or when issues need attention.",
    icon: Bell,
    position: "bottom-right",
  },
  {
    selector: '[data-tutorial="settings"]',
    title: "Settings",
    description: "Manage your account, preferences, and configuration.",
    icon: Settings,
    position: "bottom-right",
  },
  {
    selector: '[data-tutorial="profile"]',
    title: "Profile",
    description: "View your profile, manage your account, or log out.",
    icon: User,
    position: "bottom-right",
  },
]

const mobileSteps: TutorialStep[] = [
  {
    selector: '[data-tutorial="menu"]',
    title: "Menu",
    description:
      "Tap here to open the navigation menu. You'll find all your pages and tools inside.",
    icon: Menu,
    position: "bottom-right",
  },
  {
    selector: '[data-tutorial="menu"]',
    title: "Dashboard",
    description:
      "Your home base. View recent activity, job statuses, and quick stats at a glance.",
    icon: LayoutDashboard,
    position: "bottom-right",
  },
  {
    selector: '[data-tutorial="menu"]',
    title: "QC Pipeline",
    description:
      "Upload your survey data and run quality checks step by step — from file upload to final report.",
    icon: ShieldCheck,
    position: "bottom-right",
  },
  {
    selector: '[data-tutorial="menu"]',
    title: "Projects",
    description:
      "Organise your work into projects. Each project holds survey jobs, datasets, and reports.",
    icon: FolderOpen,
    position: "bottom-right",
  },
  {
    selector: '[data-tutorial="menu"]',
    title: "QC Reports",
    description:
      "View and download your completed QC reports with detailed findings and statistics.",
    icon: BarChart3,
    position: "bottom-right",
  },
  {
    selector: '[data-tutorial="menu"]',
    title: "Tools",
    description:
      "Utilities to convert, transform, compare, and visualise your survey data — all accessible from the menu.",
    icon: Wrench,
    position: "bottom-right",
  },
  {
    selector: '[data-tutorial="menu"]',
    title: "Settings & Profile",
    description:
      "Manage your account, preferences, and log out — all found in the menu.",
    icon: Settings,
    position: "bottom-right",
  },
]

const STORAGE_KEY = "truqc-tutorial-completed"

export function TutorialOverlay() {
  const [currentStep, setCurrentStep] = useState(0)
  const [active, setActive] = useState(false)
  const [highlight, setHighlight] = useState<DOMRect | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Check both localStorage (fast) and server flag (authoritative)
    const localCompleted = localStorage.getItem(STORAGE_KEY)
    if (localCompleted) return // Already seen on this device

    // Check server-side flag
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        const tutorialDone = user.user_metadata?.tutorial_completed
        if (tutorialDone) {
          // Sync to localStorage so we don't check again
          localStorage.setItem(STORAGE_KEY, "true")
          return
        }
        // First time — show tutorial after a short delay
        const timer = setTimeout(() => setActive(true), 800)
        return () => clearTimeout(timer)
      })
    })
  }, [])

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile((prev) => {
        if (prev !== mobile) setCurrentStep(0)
        return mobile
      })
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const steps = isMobile ? mobileSteps : desktopSteps

  const updateHighlight = useCallback(() => {
    if (!active) return
    const step = (isMobile ? mobileSteps : desktopSteps)[currentStep]
    const el = document.querySelector(step.selector)
    if (el) {
      const rect = el.getBoundingClientRect()
      setHighlight(rect)
    } else {
      setHighlight(null)
    }
  }, [active, currentStep, isMobile])

  useEffect(() => {
    updateHighlight()
    window.addEventListener("resize", updateHighlight)
    window.addEventListener("scroll", updateHighlight)
    return () => {
      window.removeEventListener("resize", updateHighlight)
      window.removeEventListener("scroll", updateHighlight)
    }
  }, [updateHighlight])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      handleClose()
    }
  }

  const handleClose = () => {
    setActive(false)
    localStorage.setItem(STORAGE_KEY, "true")
    // Persist to user metadata so it survives across devices/browsers
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.updateUser({ data: { tutorial_completed: true } })
    })
  }

  const handleSkip = () => {
    handleClose()
  }

  if (!mounted || !active) return null

  const step = steps[currentStep]
  const Icon = step.icon
  const padding = 6

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!highlight) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }

    const pos = step.position || "bottom"
    const top = highlight.bottom + 12

    const maxW = "min(320px, calc(100vw - 32px))"

    if (pos === "bottom-right") {
      return {
        position: "fixed",
        top,
        right: Math.max(16, window.innerWidth - highlight.right),
        maxWidth: maxW,
      }
    }

    if (pos === "bottom-left") {
      return {
        position: "fixed",
        top,
        left: Math.max(16, highlight.left),
        maxWidth: maxW,
      }
    }

    // bottom center
    const centerX = highlight.left + highlight.width / 2
    return {
      position: "fixed",
      top,
      left: Math.max(16, Math.min(centerX, window.innerWidth - 336)),
      maxWidth: maxW,
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999]" onClick={handleNext}>
      {/* Backdrop with spotlight cutout using CSS clip-path */}
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
          className="absolute rounded-lg ring-2 ring-teal-400 ring-offset-2 ring-offset-transparent transition-all duration-300 pointer-events-none"
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
        className="bg-background border border-border rounded-xl shadow-2xl p-4 sm:p-5 animate-in fade-in slide-in-from-top-2 duration-300"
        style={getTooltipStyle()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-teal-500/10">
              <Icon className="size-4 text-teal-500" />
            </div>
            <h3 className="font-semibold text-sm">{step.title}</h3>
          </div>
          <button
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {step.description}
        </p>

        <div className="flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === currentStep
                    ? "w-4 bg-teal-500"
                    : i < currentStep
                      ? "w-1.5 bg-teal-500/40"
                      : "w-1.5 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentStep((s) => s - 1)
                }}
              >
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handleNext()
              }}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              {currentStep === steps.length - 1
                ? "Get started"
                : isMobile
                  ? "Press to continue"
                  : "Click to continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
