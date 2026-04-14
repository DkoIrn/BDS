import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock email module (createNotification now imports this)
vi.mock('@/lib/email', () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null }),
}))

// Mock Supabase client
const mockSelect = vi.fn().mockReturnThis()
const mockInsert = vi.fn().mockReturnThis()
const mockUpdate = vi.fn().mockReturnThis()
const mockEq = vi.fn().mockReturnThis()
const mockOrder = vi.fn().mockReturnThis()
const mockLimit = vi.fn().mockReturnThis()
const mockSingle = vi.fn()
const mockMaybeSingle = vi.fn()

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  eq: mockEq,
  order: mockOrder,
  limit: mockLimit,
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
}))

// Chain properly
mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder, limit: mockLimit, single: mockSingle, maybeSingle: mockMaybeSingle })
mockEq.mockReturnValue({ eq: mockEq, order: mockOrder, limit: mockLimit, single: mockSingle, select: mockSelect, data: null, error: null })
mockOrder.mockReturnValue({ limit: mockLimit, data: [], error: null })
mockLimit.mockReturnValue({ data: [], error: null })
mockInsert.mockReturnValue({ select: mockSelect, data: null, error: null })
mockUpdate.mockReturnValue({ eq: mockEq, data: null, error: null })
mockSingle.mockReturnValue({ data: null, error: null })

const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'user-1' } },
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

vi.mock('@/lib/permissions', () => ({
  requireOrgRole: vi.fn().mockResolvedValue({ role: 'admin', orgId: 'org-1' }),
}))

// Must import after mocks
const {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  createNotification,
} = await import('@/lib/actions/notifications')

describe('getNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('queries notifications table for current user', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({ data: [], error: null }),
          }),
        }),
      }),
    })

    await getNotifications()
    expect(mockFrom).toHaveBeenCalledWith('notifications')
  })

  it('returns empty array when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await getNotifications()
    expect(result).toEqual([])
  })
})

describe('getUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns 0 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await getUnreadCount()
    expect(result).toBe(0)
  })
})

describe('markRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns error when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await markRead('notif-1')
    expect(result).toEqual({ error: 'Not authenticated' })
  })
})

describe('markAllRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns error when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await markAllRead()
    expect(result).toEqual({ error: 'Not authenticated' })
  })
})

describe('createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('calls insert on notifications table', async () => {
    // createNotification now calls from() multiple times:
    // 1. notification_preferences (select prefs)
    // 2. notifications (insert)
    // 3. profiles (get user email)
    // 4. profiles (get actor name)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }
      }
      if (table === 'notifications') {
        return { insert: vi.fn().mockReturnValue({ data: null, error: null }) }
      }
      // profiles
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { email: 'test@example.com', full_name: 'Test' },
              error: null,
            }),
          }),
        }),
      }
    })

    await createNotification({
      userId: 'user-2',
      orgId: 'org-1',
      type: 'mention',
      title: 'You were mentioned',
      actorId: 'user-1',
    })
    expect(mockFrom).toHaveBeenCalledWith('notifications')
  })
})
