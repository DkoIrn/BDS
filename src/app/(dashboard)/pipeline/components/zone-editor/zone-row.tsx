"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MODIFIABLE_THRESHOLDS } from "@/lib/types/context-zones"
import type { ContextZone } from "@/lib/types/context-zones"
import { ThresholdModifier } from "./threshold-modifier"

/** Local zone state used during editing (before save) */
export type EditableZone = Omit<ContextZone, "id" | "created_at" | "updated_at"> & {
  id?: string
}

interface ZoneRowProps {
  zone: EditableZone
  index: number
  onChange: (index: number, zone: EditableZone) => void
  onRemove: (index: number) => void
}

/**
 * A single zone definition row with name, type, conditional fields,
 * expandable threshold modifiers, and enabled toggle.
 */
export function ZoneRow({ zone, index, onChange, onRemove }: ZoneRowProps) {
  const [expanded, setExpanded] = useState(true)

  const modifierKeys = Object.keys(zone.threshold_modifiers)
  const availableThresholds = MODIFIABLE_THRESHOLDS.filter(
    (t) => !modifierKeys.includes(t.key)
  )

  function updateField<K extends keyof EditableZone>(key: K, value: EditableZone[K]) {
    onChange(index, { ...zone, [key]: value })
  }

  function updateModifier(key: string, multiplier: number) {
    onChange(index, {
      ...zone,
      threshold_modifiers: { ...zone.threshold_modifiers, [key]: multiplier },
    })
  }

  function removeModifier(key: string) {
    const next = { ...zone.threshold_modifiers }
    delete next[key]
    onChange(index, { ...zone, threshold_modifiers: next })
  }

  function addModifier(key: string) {
    const def = MODIFIABLE_THRESHOLDS.find((t) => t.key === key)
    if (!def) return
    onChange(index, {
      ...zone,
      threshold_modifiers: { ...zone.threshold_modifiers, [key]: 1.0 },
    })
  }

  return (
    <Card
      className={`rounded-2xl transition-colors ${
        zone.enabled
          ? "border-teal-200 bg-white"
          : "border-slate-200 bg-slate-50 opacity-75"
      }`}
    >
      <CardContent className="space-y-4 p-4">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />

          <Input
            placeholder="Zone name"
            value={zone.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="max-w-[200px] text-sm font-medium"
          />

          <Select
            value={zone.zone_type}
            onValueChange={(v) => updateField("zone_type", v as "kp_range" | "event_match")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kp_range">KP Range</SelectItem>
              <SelectItem value="event_match">Event Match</SelectItem>
            </SelectContent>
          </Select>

          {/* Conditional fields inline */}
          {zone.zone_type === "kp_range" ? (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500">KP</Label>
              <Input
                type="number"
                step={0.01}
                placeholder="Start"
                value={zone.kp_start ?? ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  updateField("kp_start", isNaN(val) ? undefined : val)
                }}
                className="w-24 text-sm"
              />
              <span className="text-xs text-slate-400">to</span>
              <Input
                type="number"
                step={0.01}
                placeholder="End"
                value={zone.kp_end ?? ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  updateField("kp_end", isNaN(val) ? undefined : val)
                }}
                className="w-24 text-sm"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500">Event</Label>
              <Input
                placeholder="e.g. trench crossing"
                value={zone.event_value ?? ""}
                onChange={(e) => updateField("event_value", e.target.value)}
                className="w-48 text-sm"
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Switch
              checked={zone.enabled}
              onCheckedChange={(checked) => updateField("enabled", checked)}
              aria-label={`${zone.enabled ? "Disable" : "Enable"} zone`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemove(index)}
              className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
              aria-label="Remove zone"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Threshold modifiers section */}
        <div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Threshold Modifiers ({modifierKeys.length})
          </button>

          {expanded && (
            <div className="mt-2 space-y-2">
              {modifierKeys.map((key) => {
                const def = MODIFIABLE_THRESHOLDS.find((t) => t.key === key)
                if (!def) return null
                return (
                  <ThresholdModifier
                    key={key}
                    thresholdKey={key}
                    label={def.label}
                    unit={def.unit}
                    defaultValue={def.defaultValue}
                    multiplier={zone.threshold_modifiers[key]}
                    onChange={(m) => updateModifier(key, m)}
                    onRemove={() => removeModifier(key)}
                  />
                )
              })}

              {availableThresholds.length > 0 && (
                <Select onValueChange={(v: string | null) => { if (v) addModifier(v) }}>
                  <SelectTrigger className="w-[200px] text-xs">
                    <div className="flex items-center gap-1.5">
                      <Plus className="h-3 w-3" />
                      <SelectValue placeholder="Add modifier" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {availableThresholds.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
