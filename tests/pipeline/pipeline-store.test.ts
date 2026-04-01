import { describe, it } from 'vitest'

// Will import from '@/app/(dashboard)/pipeline/lib/pipeline-store'
// once Plan 01 creates the production module.

describe('pipeline-store', () => {
  it.todo('savePipelineState writes to sessionStorage')
  it.todo('loadPipelineState reads back saved state')
  it.todo('save then load round-trips serializable fields correctly')
  it.todo('loadPipelineState returns null when no saved state')
  it.todo('loadPipelineState returns null on corrupted JSON')
  it.todo('clearPipelineState removes state from sessionStorage')
  it.todo('omits parsedData and cleanedData from serialized state')
})
