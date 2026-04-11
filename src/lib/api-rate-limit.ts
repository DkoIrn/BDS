/**
 * In-memory sliding window rate limiter.
 * Enforces 100 requests per minute per API key.
 *
 * Note: In a serverless environment (Vercel), the Map resets on cold starts.
 * This provides per-instance protection. For distributed enforcement,
 * upgrade to Upstash Redis.
 */

const windows = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMIT = 100 // requests per window
const WINDOW_MS = 60_000 // 1 minute

export function checkRateLimit(keyId: string): {
  allowed: boolean
  remaining: number
} {
  const now = Date.now()
  const window = windows.get(keyId)

  if (!window || now > window.resetAt) {
    windows.set(keyId, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT - 1 }
  }

  if (window.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 }
  }

  window.count++
  return { allowed: true, remaining: RATE_LIMIT - window.count }
}
