/** Context zone types for zone-aware QC validation */

/** A single modifiable threshold definition */
export interface ModifiableThreshold {
  readonly key: string
  readonly label: string
  readonly unit: string
  readonly defaultValue: number
}

/** Available thresholds that can be modified by context zones (matching backend flat_config keys) */
export const MODIFIABLE_THRESHOLDS = [
  { key: "dob_max", label: "DOB Maximum", unit: "m", defaultValue: 3.0 },
  { key: "dob_min", label: "DOB Minimum", unit: "m", defaultValue: 0 },
  { key: "doc_max", label: "DOC Maximum", unit: "m", defaultValue: 3.0 },
  { key: "depth_max", label: "Depth Maximum", unit: "m", defaultValue: 100 },
  { key: "zscore_threshold", label: "Z-Score Threshold", unit: "", defaultValue: 3.0 },
  { key: "iqr_multiplier", label: "IQR Multiplier", unit: "", defaultValue: 1.5 },
  { key: "kp_gap_max", label: "KP Gap Max", unit: "km", defaultValue: 0.1 },
] as const satisfies readonly ModifiableThreshold[]

/** Union type for threshold keys */
export type ThresholdKey = (typeof MODIFIABLE_THRESHOLDS)[number]["key"]

/** A context zone definition stored in the database */
export interface ContextZone {
  id: string
  profile_id: string
  name: string
  description: string
  zone_type: "kp_range" | "event_match"
  kp_start?: number
  kp_end?: number
  event_value?: string
  threshold_modifiers: Record<string, number>
  enabled: boolean
  is_preset: boolean
  preset_id?: string
  sort_order: number
  created_at: string
  updated_at: string
}

/** Payload for creating a new context zone */
export type CreateZonePayload = Omit<ContextZone, "id" | "created_at" | "updated_at"> & {
  user_id: string
  org_id: string
}

/** Payload for updating an existing context zone */
export type UpdateZonePayload = Partial<Omit<CreateZonePayload, "user_id" | "org_id">>

/** A preset zone template for common pipeline scenarios */
export interface ContextPreset {
  id: string
  name: string
  description: string
  zone_type: "kp_range" | "event_match"
  default_kp_start?: number
  default_kp_end?: number
  default_event_value?: string
  threshold_modifiers: Record<string, number>
}
