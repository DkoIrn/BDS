"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Phase = "bg-in" | "swoosh" | "text" | "tagline" | "hold" | "exit"

export default function SplashPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("bg-in")

  useEffect(() => {
    router.prefetch("/dashboard")
    sessionStorage.setItem("df-splash", "1")

    const timers = [
      setTimeout(() => setPhase("swoosh"), 200),
      setTimeout(() => setPhase("text"), 1200),
      setTimeout(() => setPhase("tagline"), 2000),
      setTimeout(() => setPhase("hold"), 2500),
      setTimeout(() => setPhase("exit"), 3200),
      setTimeout(() => router.replace("/dashboard"), 3700),
    ]

    return () => timers.forEach(clearTimeout)
  }, [router])

  const past = (target: Phase) => {
    const order: Phase[] = ["bg-in", "swoosh", "text", "tagline", "hold", "exit"]
    return order.indexOf(phase) >= order.indexOf(target)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ease-in-out ${
        phase === "bg-in" ? "bg-white/0" : "bg-white"
      } ${phase === "exit" ? "opacity-0 scale-[1.02]" : "opacity-100 scale-100"}`}
    >

      <div className="relative flex flex-col items-center">
        {/* Logo container — swoosh and text layered */}
        <div className="relative h-32 w-80 sm:h-40 sm:w-96">
          {/* Swoosh — flows in from left with rotation */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-[1000ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              past("swoosh")
                ? "opacity-100 translate-x-0 rotate-0 scale-100"
                : "opacity-0 -translate-x-16 -rotate-12 scale-75"
            } ${phase === "exit" ? "scale-[0.97]" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-swoosh.png"
              alt=""
              className="h-full w-auto"
              draggable={false}
            />
          </div>

          {/* Text — fades in and settles after swoosh */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              past("text")
                ? "opacity-100 translate-y-0 blur-0 scale-100"
                : "opacity-0 translate-y-2 blur-sm scale-95"
            } ${phase === "exit" ? "scale-[0.97]" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-text.png"
              alt="TruQC"
              className="h-24 w-auto sm:h-28"
              draggable={false}
            />
          </div>
        </div>

        {/* Tagline — flows in from left */}
        <p
          className={`mt-4 text-sm tracking-[0.2em] text-slate-500 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] sm:text-base ${
            past("tagline")
              ? "opacity-100 translate-x-0 blur-0"
              : "opacity-0 -translate-x-6 blur-[2px]"
          }`}
        >
          Catch it before the client does.
        </p>

        {/* Accent line */}
        <div
          className={`mt-4 h-0.5 rounded-full bg-gradient-to-r from-transparent via-purple-500/40 to-transparent transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] origin-left ${
            past("tagline") ? "w-32 opacity-100 scale-x-100" : "w-32 opacity-0 scale-x-0"
          }`}
        />
      </div>
    </div>
  )
}
