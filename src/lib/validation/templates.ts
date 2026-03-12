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
}

/** Common statistical thresholds shared by all default templates */
const COMMON_CONFIG = {
  zscore_threshold: 3.0,
  iqr_multiplier: 1.5,
  kp_gap_max: null,
  duplicate_kp_tolerance: 0.001,
  monotonicity_check: true,
  enabled_checks: { ...DEFAULT_ENABLED_CHECKS },
} as const satisfies Omit<ProfileConfig, 'ranges'>

/**
 * 4 default validation templates matching the Python backend exactly.
 * These are read-only system templates -- users cannot modify or delete them.
 */
export const DEFAULT_TEMPLATES: ValidationTemplate[] = [
  {
    id: 'dob-survey',
    name: 'DOB Survey',
    survey_type: 'DOB',
    description: 'Depth of Burial survey with DOB-specific range thresholds',
    config: {
      ...COMMON_CONFIG,
      ranges: {
        dob: { min: 0, max: 5 },
        depth: { min: 0, max: 500 },
        easting: { min: 100000, max: 900000 },
        northing: { min: 0, max: 10000000 },
      },
    },
    is_default: true,
  },
  {
    id: 'doc-survey',
    name: 'DOC Survey',
    survey_type: 'DOC',
    description: 'Depth of Cover survey with DOC-specific range thresholds',
    config: {
      ...COMMON_CONFIG,
      ranges: {
        doc: { min: 0, max: 3 },
        depth: { min: 0, max: 500 },
        easting: { min: 100000, max: 900000 },
        northing: { min: 0, max: 10000000 },
      },
    },
    is_default: true,
  },
  {
    id: 'top-survey',
    name: 'TOP Survey',
    survey_type: 'TOP',
    description: 'Top of Pipe survey with TOP-specific range thresholds',
    config: {
      ...COMMON_CONFIG,
      ranges: {
        top: { min: -200, max: 200 },
        depth: { min: 0, max: 500 },
        easting: { min: 100000, max: 900000 },
        northing: { min: 0, max: 10000000 },
      },
    },
    is_default: true,
  },
  {
    id: 'general-survey',
    name: 'General Survey',
    survey_type: 'General',
    description: 'General purpose survey with generous thresholds for all column types',
    config: {
      ...COMMON_CONFIG,
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
 * Priority: dob -> dob-survey, doc -> doc-survey, top -> top-survey, else general-survey.
 */
export function suggestProfile(mappings: ColumnMapping[]): string {
  const mappedTypes = new Set(
    mappings
      .filter((m) => !m.ignored && m.mappedType !== null)
      .map((m) => m.mappedType)
  )

  if (mappedTypes.has('dob')) return 'dob-survey'
  if (mappedTypes.has('doc')) return 'doc-survey'
  if (mappedTypes.has('top')) return 'top-survey'
  return 'general-survey'
}
