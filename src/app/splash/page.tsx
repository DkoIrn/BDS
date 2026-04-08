"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Phase = "bg-in" | "piece1" | "piece2" | "piece3" | "text" | "tagline" | "hold" | "exit"

export default function SplashPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("bg-in")

  useEffect(() => {
    router.prefetch("/dashboard")
    sessionStorage.setItem("df-splash", "1")

    const timers = [
      setTimeout(() => setPhase("piece1"), 200),
      setTimeout(() => setPhase("piece2"), 700),
      setTimeout(() => setPhase("piece3"), 1200),
      setTimeout(() => setPhase("text"), 1900),
      setTimeout(() => setPhase("tagline"), 2600),
      setTimeout(() => setPhase("hold"), 3100),
      setTimeout(() => setPhase("exit"), 3800),
      setTimeout(() => router.replace("/dashboard"), 4300),
    ]

    return () => timers.forEach(clearTimeout)
  }, [router])

  const past = (target: Phase) => {
    const order: Phase[] = ["bg-in", "piece1", "piece2", "piece3", "text", "tagline", "hold", "exit"]
    return order.indexOf(phase) >= order.indexOf(target)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ease-in-out ${
        phase === "bg-in" ? "bg-white/0" : "bg-white"
      } ${phase === "exit" ? "opacity-0 scale-[1.02]" : "opacity-100 scale-100"}`}
    >
      <div className="relative flex flex-col items-center">
        {/* All pieces + text share the same 612x408 canvas, so overlay them */}
        <div className="relative w-[420px] h-[280px] sm:w-[600px] sm:h-[400px]">
          {/* Piece 1 — top chevron */}
          <img
            src="/logo-piece-1.png"
            alt=""
            draggable={false}
            className={`absolute inset-0 w-full h-full object-contain transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              past("piece1")
                ? "opacity-100 translate-x-0 translate-y-0 scale-100"
                : "opacity-0 -translate-x-6 -translate-y-10 scale-90"
            } ${phase === "exit" ? "scale-[0.97]" : ""}`}
          />

          {/* Piece 2 — bottom-left */}
          <img
            src="/logo-piece-2.png"
            alt=""
            draggable={false}
            className={`absolute inset-0 w-full h-full object-contain transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              past("piece2")
                ? "opacity-100 translate-x-0 translate-y-0 scale-100"
                : "opacity-0 -translate-x-4 translate-y-10 scale-90"
            } ${phase === "exit" ? "scale-[0.97]" : ""}`}
          />

          {/* Piece 3 — main body */}
          <img
            src="/logo-piece-3.png"
            alt=""
            draggable={false}
            className={`absolute inset-0 w-full h-full object-contain transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              past("piece3")
                ? "opacity-100 translate-x-0 translate-y-0 scale-100"
                : "opacity-0 translate-x-10 scale-90"
            } ${phase === "exit" ? "scale-[0.97]" : ""}`}
          />

          {/* Logo text — same canvas, already positioned correctly */}
          <img
            src="/logo-letters.png"
            alt="TruQC"
            draggable={false}
            className={`absolute inset-0 w-full h-full object-contain transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              past("text")
                ? "opacity-100 translate-x-0 blur-0 scale-100"
                : "opacity-0 translate-x-6 blur-sm scale-95"
            } ${phase === "exit" ? "scale-[0.97]" : ""}`}
          />
        </div>

        {/* Tagline */}
        <p
          className={`mt-2 text-sm tracking-[0.2em] text-slate-500 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] sm:text-base ${
            past("tagline")
              ? "opacity-100 translate-x-0 blur-0"
              : "opacity-0 -translate-x-6 blur-[2px]"
          }`}
        >
          Catch it before the client does.
        </p>

        {/* Accent line */}
        <div
          className={`mt-4 h-0.5 rounded-full bg-gradient-to-r from-transparent via-teal-500/40 to-transparent transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] origin-left ${
            past("tagline") ? "w-32 opacity-100 scale-x-100" : "w-32 opacity-0 scale-x-0"
          }`}
        />
      </div>
    </div>
  )
}
