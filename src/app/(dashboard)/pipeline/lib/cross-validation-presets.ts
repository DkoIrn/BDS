/**
 * Frontend-side cross-validation preset definitions.
 * Mirrors backend presets for tolerance editing UI.
 */

export interface ColumnPairConfig {
  a: string
  b: string
  check: "delta" | "a_gte_b" | "coverage"
  tolerance?: number
  description: string
}

export interface CrossValidationPresetConfig {
  id: string
  name: string
  datasetAType: string
  datasetBType: string
  columnPairs: ColumnPairConfig[]
  kpAlignmentTolerance: number
}

export const CROSS_VALIDATION_PRESETS: Record<string, CrossValidationPresetConfig> = {
  dob_vs_doc: {
    id: "dob_vs_doc",
    name: "DOB vs DOC Consistency",
    datasetAType: "DOB",
    datasetBType: "DOC",
    columnPairs: [
      { a: "kp", b: "kp", check: "coverage", description: "KP coverage alignment" },
      { a: "dob", b: "doc", check: "a_gte_b", tolerance: 0.0, description: "DOB >= DOC (burial must exceed cover)" },
      { a: "dob", b: "dob", check: "delta", tolerance: 0.1, description: "DOB agreement between surveys" },
      { a: "easting", b: "easting", check: "delta", tolerance: 1.0, description: "Easting agreement" },
      { a: "northing", b: "northing", check: "delta", tolerance: 1.0, description: "Northing agreement" },
    ],
    kpAlignmentTolerance: 0.01,
  },
  position_vs_event: {
    id: "position_vs_event",
    name: "Position vs Event Alignment",
    datasetAType: "Position",
    datasetBType: "Event Listing",
    columnPairs: [
      { a: "kp", b: "kp", check: "coverage", description: "Events have matching positions" },
      { a: "easting", b: "easting", check: "delta", tolerance: 5.0, description: "Position agreement at event KPs" },
      { a: "northing", b: "northing", check: "delta", tolerance: 5.0, description: "Position agreement at event KPs" },
    ],
    kpAlignmentTolerance: 0.05,
  },
}
