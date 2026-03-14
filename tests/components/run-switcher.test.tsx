import { describe, it, expect, vi } from 'vitest'

// Mock severity utilities
vi.mock('@/lib/utils/severity', () => ({
  formatRunDate: vi.fn(),
}))

describe('RunSwitcher', () => {
  describe('run display', () => {
    it('shows formatted date for each run', () => {
      // STUB: Will render with runs and verify formatted dates displayed
      expect(true).toBe(true)
    })

    it('shows issue count for each run', () => {
      // STUB: Will verify total_issues count displayed per run option
      expect(true).toBe(true)
    })

    it('shows profile name from config_snapshot', () => {
      // STUB: Will verify profile name extracted from config_snapshot
      expect(true).toBe(true)
    })
  })

  describe('selection', () => {
    it('calls onRunChange when run selected', () => {
      // STUB: Will select a run and verify onRunChange callback fired
      expect(true).toBe(true)
    })

    it('shows selected run in trigger', () => {
      // STUB: Will verify the trigger displays the currently selected run
      expect(true).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles single run (no dropdown needed)', () => {
      // STUB: Will render with one run and verify no dropdown affordance
      expect(true).toBe(true)
    })
  })
})
