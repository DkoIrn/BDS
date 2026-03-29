import { describe, it, expect } from 'vitest'
import { getLayerColor, LAYER_COLORS } from '@/app/(public)/tools/visualize/lib/layer-colors'

describe('layer-colors', () => {
  it('returns first color for index 0', () => {
    expect(getLayerColor(0)).toBe(LAYER_COLORS[0])
  })

  it('cycles colors when index exceeds palette length', () => {
    expect(getLayerColor(LAYER_COLORS.length)).toBe(LAYER_COLORS[0])
    expect(getLayerColor(LAYER_COLORS.length + 1)).toBe(LAYER_COLORS[1])
  })

  it('has at least 8 distinct colors', () => {
    const unique = new Set(LAYER_COLORS)
    expect(unique.size).toBeGreaterThanOrEqual(8)
  })
})
