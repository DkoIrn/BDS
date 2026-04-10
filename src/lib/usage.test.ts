import { describe, it, expect } from 'vitest'
import {
  TIER_LIMITS,
  checkUsageLimit,
  getCurrentBillingPeriodStart,
  formatStorageSize,
} from './usage'
import type { TierLimits, UsageLimitResult } from './usage'

describe('TIER_LIMITS', () => {
  it('free tier has correct limits', () => {
    expect(TIER_LIMITS['free']).toEqual({
      maxProjects: 3,
      maxQcChecksPerMonth: 5,
      maxStorageBytes: 10 * 1024 * 1024,
    })
  })

  it('pro tier has correct limits', () => {
    expect(TIER_LIMITS['pro']).toEqual({
      maxProjects: 15,
      maxQcChecksPerMonth: 50,
      maxStorageBytes: 50 * 1024 * 1024,
    })
  })

  it('max tier has correct limits', () => {
    expect(TIER_LIMITS['max']).toEqual({
      maxProjects: null,
      maxQcChecksPerMonth: 500,
      maxStorageBytes: 200 * 1024 * 1024,
    })
  })

  it('enterprise tier has all null (unlimited) limits', () => {
    expect(TIER_LIMITS['enterprise']).toEqual({
      maxProjects: null,
      maxQcChecksPerMonth: null,
      maxStorageBytes: null,
    })
  })
})

describe('getCurrentBillingPeriodStart', () => {
  it('returns correct period start when current date is after anchor day', () => {
    // Anchor: Jan 15, if today is Jan 20 -> period start is Jan 15 of this month
    const result = getCurrentBillingPeriodStart('2026-01-15T00:00:00Z', new Date('2026-01-20T12:00:00Z'))
    expect(result.getUTCFullYear()).toBe(2026)
    expect(result.getUTCMonth()).toBe(0) // January
    expect(result.getUTCDate()).toBe(15)
  })

  it('returns previous month when current date is before anchor day', () => {
    // Anchor: Jan 15, if today is Feb 10 -> period start is Jan 15
    const result = getCurrentBillingPeriodStart('2026-01-15T00:00:00Z', new Date('2026-02-10T12:00:00Z'))
    expect(result.getUTCFullYear()).toBe(2026)
    expect(result.getUTCMonth()).toBe(0) // January
    expect(result.getUTCDate()).toBe(15)
  })

  it('handles month rollover: anchor day 31 in February clamps to 28', () => {
    // Anchor: Jan 31, if today is Mar 5 -> period start is Feb 28 (non-leap)
    const result = getCurrentBillingPeriodStart('2026-01-31T00:00:00Z', new Date('2026-03-05T12:00:00Z'))
    expect(result.getUTCFullYear()).toBe(2026)
    expect(result.getUTCMonth()).toBe(1) // February
    expect(result.getUTCDate()).toBe(28) // clamped
  })

  it('handles leap year February correctly', () => {
    // Anchor: Jan 31, if today is Mar 5 2028 -> period start is Feb 29 (leap year)
    const result = getCurrentBillingPeriodStart('2028-01-31T00:00:00Z', new Date('2028-03-05T12:00:00Z'))
    expect(result.getUTCFullYear()).toBe(2028)
    expect(result.getUTCMonth()).toBe(1) // February
    expect(result.getUTCDate()).toBe(29) // leap year
  })

  it('returns same day when today equals anchor day', () => {
    const result = getCurrentBillingPeriodStart('2026-03-15T00:00:00Z', new Date('2026-03-15T10:00:00Z'))
    expect(result.getUTCFullYear()).toBe(2026)
    expect(result.getUTCMonth()).toBe(2) // March
    expect(result.getUTCDate()).toBe(15)
  })
})

describe('checkUsageLimit', () => {
  it('returns allowed when under limit', () => {
    const result = checkUsageLimit(2, 5, 'projects', 'free')
    expect(result.allowed).toBe(true)
  })

  it('returns not allowed when at limit', () => {
    const result = checkUsageLimit(5, 5, 'QC checks', 'free')
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.limitType).toBe('QC checks')
      expect(result.current).toBe(5)
      expect(result.max).toBe(5)
      expect(result.message).toContain('free')
      expect(result.message).toContain('QC checks')
    }
  })

  it('returns not allowed when over limit', () => {
    const result = checkUsageLimit(10, 5, 'projects', 'pro')
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.current).toBe(10)
      expect(result.max).toBe(5)
    }
  })

  it('returns allowed when max is null (unlimited)', () => {
    const result = checkUsageLimit(999, null, 'projects', 'enterprise')
    expect(result.allowed).toBe(true)
  })

  it('message includes plan name and limit type', () => {
    const result = checkUsageLimit(3, 3, 'projects', 'Free Trial')
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.message).toContain('Free Trial')
      expect(result.message).toContain('projects')
      expect(result.message).toContain('3')
    }
  })
})

describe('formatStorageSize', () => {
  it('formats bytes to MB', () => {
    expect(formatStorageSize(8.5 * 1024 * 1024)).toBe('8.5 MB')
  })

  it('formats zero bytes', () => {
    expect(formatStorageSize(0)).toBe('0 MB')
  })

  it('formats GB range', () => {
    expect(formatStorageSize(1.5 * 1024 * 1024 * 1024)).toBe('1536 MB')
  })

  it('rounds to 1 decimal place', () => {
    expect(formatStorageSize(1234567)).toBe('1.2 MB')
  })
})
