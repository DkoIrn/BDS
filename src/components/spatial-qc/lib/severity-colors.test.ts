import { describe, it, expect } from 'vitest'
import {
  SEVERITY_MARKER_COLORS,
  SEVERITY_HEAT_INTENSITY,
  getSeverityColor,
} from './severity-colors'

describe('SEVERITY_MARKER_COLORS', () => {
  it('maps critical to red fill and dark red stroke', () => {
    expect(SEVERITY_MARKER_COLORS.critical).toEqual({
      fill: '#ef4444',
      stroke: '#991b1b',
    })
  })

  it('maps warning to amber fill and dark amber stroke', () => {
    expect(SEVERITY_MARKER_COLORS.warning).toEqual({
      fill: '#f59e0b',
      stroke: '#b45309',
    })
  })

  it('maps info to blue fill and dark blue stroke', () => {
    expect(SEVERITY_MARKER_COLORS.info).toEqual({
      fill: '#3b82f6',
      stroke: '#1d4ed8',
    })
  })
})

describe('SEVERITY_HEAT_INTENSITY', () => {
  it('maps critical to 1.0', () => {
    expect(SEVERITY_HEAT_INTENSITY.critical).toBe(1.0)
  })

  it('maps warning to 0.6', () => {
    expect(SEVERITY_HEAT_INTENSITY.warning).toBe(0.6)
  })

  it('maps info to 0.3', () => {
    expect(SEVERITY_HEAT_INTENSITY.info).toBe(0.3)
  })
})

describe('getSeverityColor', () => {
  it('returns correct fill and stroke for critical', () => {
    expect(getSeverityColor('critical')).toEqual({
      fill: '#ef4444',
      stroke: '#991b1b',
    })
  })

  it('returns correct fill and stroke for warning', () => {
    expect(getSeverityColor('warning')).toEqual({
      fill: '#f59e0b',
      stroke: '#b45309',
    })
  })

  it('returns correct fill and stroke for info', () => {
    expect(getSeverityColor('info')).toEqual({
      fill: '#3b82f6',
      stroke: '#1d4ed8',
    })
  })
})
