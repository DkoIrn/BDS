"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea")
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      title={`Copy ${label.toLowerCase()}`}
    >
      {copied ? (
        <>
          <Check className="size-3 text-emerald-600" />
          <span className="text-emerald-600">Copied</span>
        </>
      ) : (
        <>
          <Copy className="size-3" />
          {label}
        </>
      )}
    </button>
  )
}
