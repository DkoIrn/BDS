"use client"

import { useMemo } from "react"
import { MapPin, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CONTEXT_PRESETS } from "@/lib/validation/context-presets"
import type { ContextZone } from "@/lib/types/context-zones"
import { ZoneRow } from "./zone-row"
import type { EditableZone } from "./zone-row"

interface ZoneEditorProps {
  zones: EditableZone[]
  onChange: (zones: EditableZone[]) => void
  profileId: string
}

/** Generate a temporary local ID for new zones */
function tempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Check if two KP ranges overlap */
function rangesOverlap(
  aStart: number | undefined,
  aEnd: number | undefined,
  bStart: number | undefined,
  bEnd: number | undefined
): boolean {
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false
  return aStart <= bEnd && bStart <= aEnd
}

/**
 * Main zone editor component.
 * Renders a list of zone definitions with add/remove/preset functionality.
 * Detects overlapping KP ranges and shows a warning.
 */
export function ZoneEditor({ zones, onChange, profileId }: ZoneEditorProps) {
  const hasOverlap = useMemo(() => {
    const kpZones = zones.filter((z) => z.zone_type === "kp_range" && z.enabled)
    for (let i = 0; i < kpZones.length; i++) {
      for (let j = i + 1; j < kpZones.length; j++) {
        if (
          rangesOverlap(
            kpZones[i].kp_start,
            kpZones[i].kp_end,
            kpZones[j].kp_start,
            kpZones[j].kp_end
          )
        ) {
          return true
        }
      }
    }
    return false
  }, [zones])

  function addEmptyZone() {
    const newZone: EditableZone = {
      id: tempId(),
      profile_id: profileId,
      name: "",
      description: "",
      zone_type: "kp_range",
      kp_start: undefined,
      kp_end: undefined,
      event_value: undefined,
      threshold_modifiers: {},
      enabled: true,
      is_preset: false,
      sort_order: zones.length,
    }
    onChange([...zones, newZone])
  }

  function addFromPreset(presetId: string) {
    const preset = CONTEXT_PRESETS.find((p) => p.id === presetId)
    if (!preset) return

    const newZone: EditableZone = {
      id: tempId(),
      profile_id: profileId,
      name: preset.name,
      description: preset.description,
      zone_type: preset.zone_type,
      kp_start: preset.default_kp_start,
      kp_end: preset.default_kp_end,
      event_value: preset.default_event_value,
      threshold_modifiers: { ...preset.threshold_modifiers },
      enabled: true,
      is_preset: true,
      preset_id: preset.id,
      sort_order: zones.length,
    }
    onChange([...zones, newZone])
  }

  function updateZone(index: number, zone: EditableZone) {
    const next = [...zones]
    next[index] = zone
    onChange(next)
  }

  function removeZone(index: number) {
    onChange(zones.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-teal-500" />
          <h3 className="text-base font-semibold text-slate-800" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Context Zones
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <Select onValueChange={(v: string | null) => { if (v) addFromPreset(v) }}>
            <SelectTrigger className="w-[180px] text-xs">
              <SelectValue placeholder="Add from Preset" />
            </SelectTrigger>
            <SelectContent>
              {CONTEXT_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEmptyZone}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Zone
          </Button>
        </div>
      </div>

      {/* Overlap warning */}
      {hasOverlap && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          Zones overlap &mdash; first zone takes priority
        </p>
      )}

      {/* Zone list */}
      {zones.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center">
          <MapPin className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            No context zones defined. Zones let you apply different thresholds
            based on pipeline location or events.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {zones.map((zone, i) => (
            <ZoneRow
              key={zone.id ?? i}
              zone={zone}
              index={i}
              onChange={updateZone}
              onRemove={removeZone}
            />
          ))}
        </div>
      )}
    </div>
  )
}
