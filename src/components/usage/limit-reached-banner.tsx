"use client"

import { AlertTriangle } from "lucide-react"
import Link from "next/link"

interface LimitReachedBannerProps {
  message: string
  onUpgrade?: () => void
}

export function LimitReachedBanner({ message, onUpgrade }: LimitReachedBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
        <AlertTriangle className="size-4 text-amber-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-900">{message}</p>
        {onUpgrade ? (
          <button
            onClick={onUpgrade}
            className="mt-1.5 text-sm font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900 cursor-pointer"
          >
            Upgrade Plan
          </button>
        ) : (
          <Link
            href="/settings"
            className="mt-1.5 inline-block text-sm font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900"
          >
            Upgrade Plan
          </Link>
        )}
      </div>
    </div>
  )
}
