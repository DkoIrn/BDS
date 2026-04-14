import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
const mockInsert = vi.fn()
const mockFrom = vi.fn()
const mockGetUser = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockLt = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

vi.mock('@/lib/permissions', () => ({
  requireOrgRole: vi.fn().mockResolvedValue({ role: 'admin', orgId: 'org-1' }),
}))

const { logActivity, getProjectActivity } = await import(
  '@/lib/actions/activity'
)

describe('logActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('inserts into activity_events with all required fields', async () => {
    const mockInsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValueOnce({ insert: mockInsertFn })

    await logActivity({
      projectId: 'proj-1',
      orgId: 'org-1',
      actorId: 'user-1',
      eventType: 'validation_run',
      summary: 'Ran validation on pipeline_survey.csv',
      resourceType: 'dataset',
      resourceId: 'ds-1',
    })

    expect(mockFrom).toHaveBeenCalledWith('activity_events')
    expect(mockInsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-1',
        org_id: 'org-1',
        actor_id: 'user-1',
        event_type: 'validation_run',
        summary: 'Ran validation on pipeline_survey.csv',
        resource_type: 'dataset',
        resource_id: 'ds-1',
      })
    )
  })

  it('does not throw on insert error (fire-and-forget safe)', async () => {
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      }),
    })

    // Should not throw
    await expect(
      logActivity({
        projectId: 'proj-1',
        orgId: 'org-1',
        actorId: 'user-1',
        eventType: 'comment_added',
        summary: 'Added a comment',
      })
    ).resolves.toBeUndefined()
  })
})

describe('getProjectActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns events ordered by created_at DESC with actor join, limited to 20', async () => {
    const mockEvents = [
      {
        id: 'evt-1',
        project_id: 'proj-1',
        event_type: 'validation_run',
        summary: 'Ran validation',
        actor: { full_name: 'Alice' },
        created_at: '2026-04-14T10:00:00Z',
      },
    ]

    const mockLimitFn = vi.fn().mockResolvedValue({ data: mockEvents, error: null })
    const mockOrderFn = vi.fn().mockReturnValue({ limit: mockLimitFn })
    const mockEqFn = vi.fn().mockReturnValue({
      order: mockOrderFn,
    })
    const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn })

    mockFrom.mockReturnValueOnce({ select: mockSelectFn })

    const result = await getProjectActivity('proj-1')

    expect(mockFrom).toHaveBeenCalledWith('activity_events')
    expect(mockSelectFn).toHaveBeenCalledWith('*, actor:actor_id(full_name)')
    expect(mockEqFn).toHaveBeenCalledWith('project_id', 'proj-1')
    expect(mockOrderFn).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mockLimitFn).toHaveBeenCalledWith(20)
    expect(result).toEqual(mockEvents)
  })

  it('supports cursor-based pagination via before parameter', async () => {
    const mockLtFn = vi.fn().mockResolvedValue({ data: [], error: null })
    const mockLimitFn = vi.fn().mockReturnValue({ lt: mockLtFn })
    const mockOrderFn = vi.fn().mockReturnValue({ limit: mockLimitFn })
    const mockEqFn = vi.fn().mockReturnValue({
      order: mockOrderFn,
    })
    const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn })

    mockFrom.mockReturnValueOnce({ select: mockSelectFn })

    await getProjectActivity('proj-1', {
      before: '2026-04-14T09:00:00Z',
    })

    expect(mockLtFn).toHaveBeenCalledWith('created_at', '2026-04-14T09:00:00Z')
  })

  it('returns empty array when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await getProjectActivity('proj-1')
    expect(result).toEqual([])
  })
})
