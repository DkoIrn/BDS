import { describe, it, expect } from 'vitest'
import type { SpatialDataPoint } from './types'
import { matchDatasetsByKP, computeDeviations } from './dataset-comparison'

function pt(
  rowIndex: number,
  lat: number,
  lng: number,
  kp?: number
): SpatialDataPoint {
  const p: SpatialDataPoint = { rowIndex, lat, lng }
  if (kp !== undefined) p.kp = kp
  return p
}

describe('matchDatasetsByKP', () => {
  it('matches points with identical KP values', () => {
    const a = [pt(1, 56.1, -3.4, 0.0), pt(2, 56.2, -3.5, 1.0)]
    const b = [pt(1, 56.1, -3.4, 0.0), pt(2, 56.2, -3.5, 1.0)]
    const result = matchDatasetsByKP(a, b)
    expect(result.pairs).toHaveLength(2)
    expect(result.unmatchedA).toHaveLength(0)
    expect(result.unmatchedB).toHaveLength(0)
  })

  it('matched pairs with identical coordinates have ~0 deviation', () => {
    const a = [pt(1, 56.1, -3.4, 0.0)]
    const b = [pt(1, 56.1, -3.4, 0.0)]
    const result = matchDatasetsByKP(a, b)
    expect(result.pairs[0].deviationMeters).toBeCloseTo(0, 1)
  })

  it('matches nearest KP within tolerance', () => {
    const a = [pt(1, 56.1, -3.4, 0.0)]
    const b = [pt(1, 56.1, -3.4, 0.05)] // within default 0.1 tolerance
    const result = matchDatasetsByKP(a, b)
    expect(result.pairs).toHaveLength(1)
    expect(result.unmatchedA).toHaveLength(0)
    expect(result.unmatchedB).toHaveLength(0)
  })

  it('does not match points beyond KP tolerance', () => {
    const a = [pt(1, 56.1, -3.4, 0.0)]
    const b = [pt(1, 56.1, -3.4, 0.5)] // beyond 0.1 tolerance
    const result = matchDatasetsByKP(a, b)
    expect(result.pairs).toHaveLength(0)
    expect(result.unmatchedA).toHaveLength(1)
    expect(result.unmatchedB).toHaveLength(1)
  })

  it('returns all unmatched when no KP overlap', () => {
    const a = [pt(1, 56.1, -3.4, 0.0), pt(2, 56.2, -3.5, 1.0)]
    const b = [pt(1, 56.3, -3.6, 5.0), pt(2, 56.4, -3.7, 6.0)]
    const result = matchDatasetsByKP(a, b)
    expect(result.pairs).toHaveLength(0)
    expect(result.unmatchedA).toHaveLength(2)
    expect(result.unmatchedB).toHaveLength(2)
  })

  it('each B point is matched only once (greedy)', () => {
    const a = [pt(1, 56.1, -3.4, 0.0), pt(2, 56.2, -3.5, 0.05)]
    const b = [pt(1, 56.1, -3.4, 0.02)]
    const result = matchDatasetsByKP(a, b)
    // Only one pair since B has only one point
    expect(result.pairs).toHaveLength(1)
    expect(result.unmatchedA).toHaveLength(1)
  })

  it('respects custom KP tolerance', () => {
    const a = [pt(1, 56.1, -3.4, 0.0)]
    const b = [pt(1, 56.1, -3.4, 0.3)]
    // Default 0.1 would not match, but 0.5 should
    expect(matchDatasetsByKP(a, b, 0.1).pairs).toHaveLength(0)
    expect(matchDatasetsByKP(a, b, 0.5).pairs).toHaveLength(1)
  })

  it('skips points without KP values', () => {
    const a = [pt(1, 56.1, -3.4)] // no kp
    const b = [pt(1, 56.1, -3.4, 0.0)]
    const result = matchDatasetsByKP(a, b)
    expect(result.pairs).toHaveLength(0)
    expect(result.unmatchedA).toHaveLength(1)
    expect(result.unmatchedB).toHaveLength(1)
  })
})

describe('computeDeviations', () => {
  it('returns ~0 meters for co-located points', () => {
    const pairs = [{ pointA: pt(1, 56.1, -3.4), pointB: pt(2, 56.1, -3.4) }]
    const result = computeDeviations(pairs)
    expect(result).toHaveLength(1)
    expect(result[0].deviationMeters).toBeCloseTo(0, 1)
  })

  it('computes expected Haversine distance for known offset', () => {
    // ~111km per degree of latitude at equator
    // 0.001 degrees lat at 56N ~ 111.32m
    const pairs = [
      {
        pointA: pt(1, 56.0, -3.0),
        pointB: pt(2, 56.001, -3.0),
      },
    ]
    const result = computeDeviations(pairs)
    // 0.001 degrees latitude ~ 111 meters (within 1% for Haversine)
    expect(result[0].deviationMeters).toBeGreaterThan(100)
    expect(result[0].deviationMeters).toBeLessThan(120)
  })

  it('returns empty array for empty input', () => {
    expect(computeDeviations([])).toEqual([])
  })
})
