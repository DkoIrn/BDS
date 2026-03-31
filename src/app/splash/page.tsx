"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Phase = "bg-in" | "logo" | "tagline" | "hold" | "exit"

export default function SplashPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("bg-in")

  useEffect(() => {
    router.prefetch("/dashboard")

    // Flag so dashboard layout knows to run entry animations
    sessionStorage.setItem("df-splash", "1")

    const timers = [
      setTimeout(() => setPhase("logo"), 200),
      setTimeout(() => setPhase("tagline"), 900),
      setTimeout(() => setPhase("hold"), 1400),
      setTimeout(() => setPhase("exit"), 2200),
      setTimeout(() => router.replace("/dashboard"), 2700),
    ]

    return () => timers.forEach(clearTimeout)
  }, [router])

  const past = (target: Phase) => {
    const order: Phase[] = ["bg-in", "logo", "tagline", "hold", "exit"]
    return order.indexOf(phase) >= order.indexOf(target)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ease-in-out ${
        phase === "bg-in" ? "bg-[#0F172A]/0" : "bg-[#0F172A]"
      } ${phase === "exit" ? "opacity-0 scale-[1.02]" : "opacity-100 scale-100"}`}
    >
      {/* Subtle flow lines in background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={`absolute top-[38%] -left-full h-px w-[200%] bg-gradient-to-r from-transparent via-teal-500/20 to-transparent transition-transform duration-[1200ms] ease-in-out ${
            past("logo") ? "translate-x-[25%]" : "translate-x-0"
          }`}
        />
        <div
          className={`absolute top-[62%] -left-full h-px w-[200%] bg-gradient-to-r from-transparent via-teal-500/10 to-transparent transition-transform duration-[1400ms] ease-in-out delay-200 ${
            past("logo") ? "translate-x-[30%]" : "translate-x-0"
          }`}
        />
        <div
          className={`absolute top-[50%] -left-full h-px w-[200%] bg-gradient-to-r from-transparent via-teal-500/[0.07] to-transparent transition-transform duration-[1600ms] ease-in-out delay-300 ${
            past("logo") ? "translate-x-[20%]" : "translate-x-0"
          }`}
        />
      </div>

      <div className="relative flex flex-col items-center">
        {/* Logo container with white card */}
        <div
          className={`rounded-2xl bg-white/95 px-8 py-5 shadow-2xl shadow-black/20 transition-all duration-700 ease-in-out ${
            past("logo")
              ? "opacity-100 scale-100"
              : "opacity-0 scale-[0.95]"
          } ${phase === "exit" ? "scale-[0.97]" : ""}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="DataFlow"
            className="h-14 w-auto sm:h-18"
            draggable={false}
          />
        </div>

        {/* Tagline */}
        <p
          className={`mt-6 text-sm tracking-[0.2em] text-slate-400 transition-all duration-600 ease-in-out sm:text-base ${
            past("tagline")
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-3"
          }`}
        >
          Validate. Transform. Visualise.
        </p>

        {/* Subtle teal accent line under tagline */}
        <div
          className={`mt-4 h-0.5 rounded-full bg-gradient-to-r from-transparent via-teal-500/40 to-transparent transition-all duration-700 ease-in-out ${
            past("tagline") ? "w-32 opacity-100" : "w-0 opacity-0"
          }`}
        />
      </div>
    </div>
  )
}
