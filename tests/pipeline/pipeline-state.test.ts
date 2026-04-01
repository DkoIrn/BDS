import { describe, it } from 'vitest'

// Will import from '@/app/(dashboard)/pipeline/lib/pipeline-state'
// once Plan 01 creates the production module.

describe('pipelineReducer', () => {
  it.todo('IMPORT_FILE resets state and advances to inspect')
  it.todo('IMPORT_EXISTING sets datasetId and advances to inspect')
  it.todo('INSPECT_COMPLETE stores parsed data and advances to validate')
  it.todo('SKIP_VALIDATE marks validate as skipped and advances to clean')
  it.todo('VALIDATE_START keeps current stage as validate')
  it.todo('VALIDATE_COMPLETE stores run data and advances to clean')
  it.todo('SKIP_CLEAN marks clean as skipped and advances to export')
  it.todo('CLEAN_COMPLETE stores cleaned data and advances to export')
  it.todo('SET_EXPORT_FORMAT updates export format')
  it.todo('GO_TO_STAGE transitions when canNavigateTo returns true')
  it.todo('GO_TO_STAGE does NOT transition when canNavigateTo returns false')
  it.todo('RESET returns initial state')
})

describe('canNavigateTo', () => {
  it.todo('always allows navigation to import')
  it.todo('allows inspect only when import is completed')
  it.todo('allows validate only when inspect is completed')
  it.todo('allows clean when inspect is completed (validate can be skipped)')
  it.todo('allows export when import is completed')
  it.todo('blocks inspect when import is not completed')
  it.todo('blocks validate when inspect is not completed')
})
