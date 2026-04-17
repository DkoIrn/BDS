import type { ContextPreset } from "@/lib/types/context-zones"

/**
 * Pre-configured context zone presets for common pipeline scenarios.
 * These match the backend PRESET_ZONES definitions exactly.
 * Users can apply these as templates and adjust KP ranges for their project.
 */
export const CONTEXT_PRESETS: ContextPreset[] = [
  {
    id: "shore-approach",
    name: "Shore Approach",
    description: "Relaxed depth/DOB thresholds near shore (typically KP 0-2)",
    zone_type: "kp_range",
    default_kp_start: 0.0,
    default_kp_end: 2.0,
    threshold_modifiers: {
      dob_max: 1.5,
      depth_max: 1.3,
    },
  },
  {
    id: "trench-crossing",
    name: "Trench Crossing",
    description: "Relaxed DOB thresholds during trench crossings",
    zone_type: "event_match",
    default_event_value: "trench crossing",
    threshold_modifiers: {
      dob_max: 2.0,
      depth_max: 1.5,
    },
  },
  {
    id: "j-tube",
    name: "J-Tube Entry/Exit",
    description: "Tighter DOB/DOC thresholds at J-tube transitions",
    zone_type: "event_match",
    default_event_value: "j-tube",
    threshold_modifiers: {
      dob_max: 0.7,
      doc_max: 0.7,
    },
  },
  {
    id: "span",
    name: "Free Span",
    description: "Relaxed DOB but tighter depth monitoring at spans",
    zone_type: "event_match",
    default_event_value: "span",
    threshold_modifiers: {
      dob_max: 3.0,
      depth_max: 0.9,
    },
  },
]

/**
 * Look up a context preset by its ID.
 */
export function getPresetById(id: string): ContextPreset | undefined {
  return CONTEXT_PRESETS.find((p) => p.id === id)
}
