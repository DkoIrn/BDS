import { describe, it, expect } from 'vitest'
import { parseSpatialFile } from '@/app/(public)/tools/visualize/lib/parse-spatial-file'
import fs from 'fs'
import path from 'path'

describe('parseSpatialFile', () => {
  it('parses a GeoJSON file into a FeatureCollection', async () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../fixtures/sample.geojson'), 'utf-8')
    const file = new File([content], 'sample.geojson', { type: 'application/json' })
    const result = await parseSpatialFile(file)
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(3)
    expect(result.features[0].geometry.type).toBe('Point')
  })

  it('parses a KML file into a FeatureCollection', async () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../fixtures/sample.kml'), 'utf-8')
    const file = new File([content], 'sample.kml', { type: 'application/xml' })
    const result = await parseSpatialFile(file)
    expect(result.type).toBe('FeatureCollection')
    expect(result.features.length).toBeGreaterThan(0)
  })

  it('throws on unsupported file extensions', async () => {
    const file = new File(['hello'], 'data.txt', { type: 'text/plain' })
    await expect(parseSpatialFile(file)).rejects.toThrow()
  })

  it('ensures every feature has an id property', async () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { name: 'no-id' } }
      ]
    }
    const file = new File([JSON.stringify(geojson)], 'noid.geojson', { type: 'application/json' })
    const result = await parseSpatialFile(file)
    expect(result.features[0].id).toBeDefined()
  })
})
