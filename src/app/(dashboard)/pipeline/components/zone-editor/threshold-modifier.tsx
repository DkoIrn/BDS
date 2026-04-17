"use client"

import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface ThresholdModifierProps {
  thresholdKey: string
  label: string
  unit: string
  defaultValue: number
  multiplier: number
  onChange: (multiplier: number) => void
  onRemove: () => void
}

/**
 * Threshold modifier input with computed result preview.
 * Shows the multiplier as a percentage change and the resulting value.
 */
export function ThresholdModifier({
  label,
  unit,
  defaultValue,
  multiplier,
  onChange,
  onRemove,
}: ThresholdModifierProps) {
  const result = defaultValue * multiplier
  const percentChange = Math.round((multiplier - 1) * 100)
  const isRelaxed = percentChange > 0
  const isTightened = percentChange < 0

  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <div className="min-w-[140px]">
        <Label className="text-sm font-medium text-slate-700">{label}</Label>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          step={0.1}
          min={0.1}
          value={multiplier}
          onChange={(e) => {
            const val = parseFloat(e.target.value)
            if (!isNaN(val) && val > 0) onChange(val)
          }}
          className="w-20 text-center text-sm"
        />
        <span className="text-xs text-slate-500">x</span>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span className="tabular-nums">
          {defaultValue}
          {unit ? ` ${unit}` : ""}
        </span>
        <span className="text-slate-400">&rarr;</span>
        <span className="font-medium tabular-nums">
          {result.toFixed(2)}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>

      {percentChange !== 0 && (
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
            isRelaxed
              ? "bg-teal-50 text-teal-700"
              : isTightened
                ? "bg-red-50 text-red-700"
                : ""
          }`}
        >
          {isRelaxed ? "+" : ""}
          {percentChange}%
        </span>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="ml-auto h-7 w-7 p-0 text-slate-400 hover:text-red-500"
        aria-label={`Remove ${label} modifier`}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
