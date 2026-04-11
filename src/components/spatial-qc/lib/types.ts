import type { ValidationIssue, ValidationSeverity } from '@/lib/types/validation'

/** A validation issue with resolved geographic coordinates */
export interface SpatialIssue {
  issue: ValidationIssue
  lat: number
  lng: number
}

/** A single data point with geographic coordinates */
export interface SpatialDataPoint {
  rowIndex: number
  lat: number
  lng: number
  kp?: number
}

/** A matched pair of points from two datasets with computed deviation */
export interface ComparisonPair {
  pointA: SpatialDataPoint
  pointB: SpatialDataPoint
  deviationMeters: number
}

/** Result of comparing two spatial datasets */
export interface ComparisonResult {
  pairs: ComparisonPair[]
  unmatchedA: SpatialDataPoint[]
  unmatchedB: SpatialDataPoint[]
}

export type { ValidationIssue, ValidationSeverity }
