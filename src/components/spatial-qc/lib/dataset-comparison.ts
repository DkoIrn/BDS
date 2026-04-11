import type { SpatialDataPoint, ComparisonPair, ComparisonResult } from './types'

const EARTH_RADIUS_M = 6_371_000

/** Convert degrees to radians */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Haversine distance between two geographic points in meters.
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_M * c
}

/**
 * Compute Haversine deviation in meters for pre-matched point pairs.
 */
export function computeDeviations(
  pairs: Array<{ pointA: SpatialDataPoint; pointB: SpatialDataPoint }>
): ComparisonPair[] {
  return pairs.map(({ pointA, pointB }) => ({
    pointA,
    pointB,
    deviationMeters: haversineDistance(pointA.lat, pointA.lng, pointB.lat, pointB.lng),
  }))
}

/**
 * Match two spatial datasets by nearest KP value within tolerance.
 * Points without KP are placed in unmatched. Each B point can only be matched once.
 */
export function matchDatasetsByKP(
  pointsA: SpatialDataPoint[],
  pointsB: SpatialDataPoint[],
  kpTolerance: number = 0.1
): ComparisonResult {
  // Separate points with and without KP
  const aWithKP = pointsA.filter((p) => p.kp !== undefined)
  const aWithoutKP = pointsA.filter((p) => p.kp === undefined)
  const bWithKP = pointsB.filter((p) => p.kp !== undefined)
  const bWithoutKP = pointsB.filter((p) => p.kp === undefined)

  // Sort by KP for efficient matching
  const sortedA = [...aWithKP].sort((a, b) => a.kp! - b.kp!)
  const sortedB = [...bWithKP].sort((a, b) => a.kp! - b.kp!)

  const matchedBIndices = new Set<number>()
  const matchedPairs: Array<{ pointA: SpatialDataPoint; pointB: SpatialDataPoint }> = []
  const unmatchedA: SpatialDataPoint[] = [...aWithoutKP]

  for (const pA of sortedA) {
    let bestIdx = -1
    let bestDelta = Infinity

    for (let j = 0; j < sortedB.length; j++) {
      if (matchedBIndices.has(j)) continue
      const delta = Math.abs(pA.kp! - sortedB[j].kp!)
      if (delta <= kpTolerance && delta < bestDelta) {
        bestDelta = delta
        bestIdx = j
      }
    }

    if (bestIdx >= 0) {
      matchedBIndices.add(bestIdx)
      matchedPairs.push({ pointA: pA, pointB: sortedB[bestIdx] })
    } else {
      unmatchedA.push(pA)
    }
  }

  const unmatchedB: SpatialDataPoint[] = [
    ...bWithoutKP,
    ...sortedB.filter((_, i) => !matchedBIndices.has(i)),
  ]

  // Compute deviations for matched pairs
  const pairs = computeDeviations(matchedPairs)

  return { pairs, unmatchedA, unmatchedB }
}
