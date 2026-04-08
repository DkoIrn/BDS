import { describe, it } from 'vitest'

describe('Clean Snapshots (AUDT-04)', () => {
  it.todo('auto-clean audit metadata includes changes array with row-level diffs')
  it.todo('changes array is capped at 100 entries')
  it.todo('each change entry has type, row, column, before, after, explanation')
  it.todo('totalChanges count reflects actual number even when truncated')
})
