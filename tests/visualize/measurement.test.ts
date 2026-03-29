import { describe, it, expect } from 'vitest'

// This helper will be created alongside measurement-tool in plan 13-02.
// For now, test the Haversine formula directly.
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000 // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

describe('measurement distance calculation', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistance(51.5, -0.09, 51.5, -0.09)).toBe(0)
  })

  it('calculates approximate distance between known points', () => {
    // London to Paris approx 343 km
    const d = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522)
    expect(d).toBeGreaterThan(340000)
    expect(d).toBeLessThan(350000)
  })

  it('returns positive value regardless of direction', () => {
    const d1 = haversineDistance(0, 0, 1, 1)
    const d2 = haversineDistance(1, 1, 0, 0)
    expect(d1).toBeCloseTo(d2, 0)
  })
})
