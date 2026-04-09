import type { ProfileConfig, ValidationTemplate, EnabledChecks } from '@/lib/types/validation'
import type { ColumnMapping } from '@/lib/parsing/types'

/** All checks enabled -- used for templates and reset functionality */
export const DEFAULT_ENABLED_CHECKS: EnabledChecks = {
  range_check: true,
  missing_data: true,
  duplicate_rows: true,
  near_duplicate_kp: true,
  outliers_zscore: true,
  outliers_iqr: true,
  kp_gaps: true,
  monotonicity: true,
  cross_column: true,
  spike_detection: true,
  coordinate_sanity: true,
  event_listing: true,
  position_consistency: true,
  kp_drift: true,
  segment_continuity: true,
}

/** Common statistical thresholds shared by all default templates */
const COMMON_CONFIG = {
  zscore_threshold: 3.0,
  iqr_multiplier: 1.5,
  kp_gap_max: null,
  duplicate_kp_tolerance: 0.001,
  monotonicity_check: true,
  enabled_checks: { ...DEFAULT_ENABLED_CHECKS },
  kp_drift_tolerance: 0.01,
  max_segment_distance: 100,
} as const satisfies Omit<ProfileConfig, 'ranges' | 'kp_drift_severity' | 'segment_continuity_severity'>

/**
 * 4 domain QC pack definitions matching the Python backend exactly.
 * These are read-only system templates -- users cannot modify or delete them.
 */
export const DEFAULT_TEMPLATES: ValidationTemplate[] = [
  {
    id: 'pipeline-as-laid',
    name: 'Pipeline As-Laid QC',
    survey_type: 'as-laid',
    description: 'Tight KP and depth validation for as-laid pipeline surveys',
    expectedColumns: ['kp', 'dob', 'depth', 'easting', 'northing'],
    config: {
      ...COMMON_CONFIG,
      kp_gap_max: 0.01,
      duplicate_kp_tolerance: 0.0005,
      kp_drift_tolerance: 0.01,
      max_segment_distance: 50,
      kp_drift_severity: 'critical',
      segment_continuity_severity: 'warning',
      zscore_threshold: 2.5,
      ranges: {
        dob: { min: 0, max: 3, tolerance: 0.1 },
        depth: { min: 0, max: 300 },
        easting: { min: 100000, max: 900000 },
        northing: { min: 0, max: 10000000 },
      },
    },
    is_default: true,
  },
  {
    id: 'as-built-survey',
    name: 'As-Built Survey QC',
    survey_type: 'as-built',
    description: 'DOC and cross-column focused validation for construction surveys',
    expectedColumns: ['kp', 'doc', 'dob', 'depth', 'easting', 'northing'],
    config: {
      ...COMMON_CONFIG,
      kp_gap_max: 0.05,
      duplicate_kp_tolerance: 0.001,
      kp_drift_tolerance: 0.02,
      max_segment_distance: 100,
      kp_drift_severity: 'warning',
      segment_continuity_severity: 'critical',
      zscore_threshold: 2.0,
      ranges: {
        doc: { min: 0, max: 2, tolerance: 0.05 },
        dob: { min: 0, max: 5 },
        depth: { min: 0, max: 300 },
        easting: { min: 100000, max: 900000 },
        northing: { min: 0, max: 10000000 },
      },
    },
    is_default: true,
  },
  {
    id: 'pre-commissioning',
    name: 'Pre-Commissioning QC',
    survey_type: 'pre-comm',
    description: 'Event listing and position focused validation for pre-commissioning surveys',
    expectedColumns: ['kp', 'dob', 'depth', 'easting', 'northing', 'event_listing'],
    config: {
      ...COMMON_CONFIG,
      kp_gap_max: 0.1,
      duplicate_kp_tolerance: 0.002,
      kp_drift_tolerance: 0.05,
      max_segment_distance: 200,
      kp_drift_severity: 'warning',
      segment_continuity_severity: 'warning',
      zscore_threshold: 3.0,
      ranges: {
        dob: { min: 0, max: 10 },
        doc: { min: 0, max: 10 },
        depth: { min: 0, max: 500 },
        easting: { min: 100000, max: 900000 },
        northing: { min: 0, max: 10000000 },
      },
    },
    is_default: true,
  },
  {
    id: 'general-survey',
    name: 'General Survey QC',
    survey_type: 'general',
    description: 'General purpose survey with generous thresholds for all column types',
    expectedColumns: [],
    config: {
      ...COMMON_CONFIG,
      kp_drift_tolerance: 0.03,
      max_segment_distance: 150,
      ranges: {
        dob: { min: 0, max: 10 },
        doc: { min: 0, max: 10 },
        top: { min: -500, max: 500 },
        depth: { min: 0, max: 500 },
        elevation: { min: -500, max: 500 },
        easting: { min: 100000, max: 900000 },
        northing: { min: 0, max: 10000000 },
        latitude: { min: -90, max: 90 },
        longitude: { min: -180, max: 180 },
      },
    },
    is_default: true,
  },
]

/**
 * Look up a default template by its ID.
 */
export function getTemplateById(id: string): ValidationTemplate | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.id === id)
}

/**
 * Suggest the best matching template based on column mappings.
 * Uses column overlap scoring: for each non-general pack, counts how many of its
 * expectedColumns are present in the mapped types. Returns the best match if
 * score >= 0.6, otherwise returns "general-survey".
 */
export function suggestProfile(mappings: ColumnMapping[]): string {
  const mappedTypes = new Set<string>(
    mappings
      .filter((m) => !m.ignored && m.mappedType !== null)
      .map((m) => m.mappedType as string)
  )

  let bestId = 'general-survey'
  let bestScore = 0

  for (const template of DEFAULT_TEMPLATES) {
    if (!template.expectedColumns || template.expectedColumns.length === 0) continue
    const matched = template.expectedColumns.filter((col) => mappedTypes.has(col)).length
    const score = matched / template.expectedColumns.length
    if (score > bestScore) {
      bestScore = score
      bestId = template.id
    }
  }

  return bestScore >= 0.6 ? bestId : 'general-survey'
}

/**
 * Suggest the best matching template based on raw header names.
 * Used in the pipeline workflow where ColumnMapping objects are not available.
 * Maps common header names to survey column types, then scores against packs.
 */
export function suggestProfileFromHeaders(headers: string[]): string {
  const HEADER_TYPE_MAP: Record<string, string> = {
    kp: 'kp', chainage: 'kp', 'km post': 'kp',
    dob: 'dob', 'depth of burial': 'dob',
    doc: 'doc', 'depth of cover': 'doc',
    depth: 'depth', 'water depth': 'depth',
    easting: 'easting', east: 'easting', e: 'easting',
    northing: 'northing', north: 'northing', n: 'northing',
    top: 'top', 'top of pipe': 'top',
    elevation: 'elevation', elev: 'elevation',
    latitude: 'latitude', lat: 'latitude',
    longitude: 'longitude', lon: 'longitude', lng: 'longitude',
    event: 'event_listing', 'event listing': 'event_listing', 'event_listing': 'event_listing',
  }

  const types = new Set<string>()
  for (const h of headers) {
    const normalized = h.toLowerCase().trim()
    const type = HEADER_TYPE_MAP[normalized]
    if (type) types.add(type)
  }

  let bestId = 'general-survey'
  let bestScore = 0

  for (const template of DEFAULT_TEMPLATES) {
    if (!template.expectedColumns || template.expectedColumns.length === 0) continue
    const matched = template.expectedColumns.filter((col) => types.has(col)).length
    const score = matched / template.expectedColumns.length
    if (score > bestScore) {
      bestScore = score
      bestId = template.id
    }
  }

  return bestScore >= 0.6 ? bestId : 'general-survey'
}
