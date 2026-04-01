import { describe, it } from 'vitest'

// Tests that stage panels dispatch correct actions.
// These are component integration tests -- stubs only until
// Plan 02 creates the stage panel components.

describe('StageImport dispatch', () => {
  it.todo('dispatches IMPORT_FILE with fileName on file drop')
  it.todo('dispatches IMPORT_EXISTING with datasetId on dataset select')
  it.todo('dispatches RESET when re-import button is clicked')
})

describe('StageInspect dispatch', () => {
  it.todo('dispatches INSPECT_COMPLETE after parsing uploaded file')
})
