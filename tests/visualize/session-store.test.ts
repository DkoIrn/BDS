import { describe, it, expect, beforeEach } from 'vitest'
import { saveLayers, loadLayers, clearLayers } from '@/app/(public)/tools/visualize/lib/session-store'
import type { MapLayer } from '@/app/(public)/tools/visualize/lib/types'

const mockLayer: MapLayer = {
  id: 'test-1',
  filename: 'test.geojson',
  geojson: { type: 'FeatureCollection', features: [] },
  color: '#3B82F6',
  visible: true,
  featureCount: 0,
}

describe('session-store', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('saves and loads layers', () => {
    saveLayers([mockLayer])
    const loaded = loadLayers()
    expect(loaded).toHaveLength(1)
    expect(loaded![0].id).toBe('test-1')
  })

  it('returns null when no data stored', () => {
    expect(loadLayers()).toBeNull()
  })

  it('clears stored layers', () => {
    saveLayers([mockLayer])
    clearLayers()
    expect(loadLayers()).toBeNull()
  })
})
