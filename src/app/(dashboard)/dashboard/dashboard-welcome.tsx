"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { OnboardingWelcome } from "@/app/(dashboard)/pipeline/components/onboarding-welcome"
import { completeOnboarding } from "@/lib/actions/onboarding"

const ONBOARDING_KEY = "truqc-onboarding-completed"

export function DashboardWelcome() {
  const router = useRouter()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Fast check: skip if localStorage says already done
    const localDone = localStorage.getItem(ONBOARDING_KEY)
    if (localDone) return
    setVisible(true)
  }, [])

  if (!visible) return null

  return (
    <OnboardingWelcome
      onStart={() => {
        router.push("/pipeline?demo=true")
      }}
      onSkip={async () => {
        try {
          await completeOnboarding()
        } catch {
          // best effort
        }
        localStorage.setItem(ONBOARDING_KEY, "true")
        setVisible(false)
      }}
    />
  )
}
