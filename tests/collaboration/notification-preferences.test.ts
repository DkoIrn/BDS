import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock email module
const mockSendNotificationEmail = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null })
vi.mock('@/lib/email', () => ({
  sendNotificationEmail: (...args: unknown[]) => mockSendNotificationEmail(...args),
}))

// Mock Supabase
const mockMaybeSingle = vi.fn()
const mockUpsert = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()

const mockFrom = vi.fn()

const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

vi.mock('@/lib/permissions', () => ({
  requireOrgRole: vi.fn().mockResolvedValue({ role: 'admin', orgId: 'org-1' }),
}))

const { getNotificationPreferences, updateNotificationPreferences } =
  await import('@/lib/actions/notification-preferences')
const { createNotification } = await import('@/lib/actions/notifications')
const { DEFAULT_PREFERENCES } = await import('@/lib/types/notifications')

describe('getNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns DEFAULT_PREFERENCES when no row exists for user', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })

    const result = await getNotificationPreferences('user-1')
    expect(result).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns stored preferences when row exists', async () => {
    const customPrefs = {
      validation_complete: { in_app: true, email: false },
      validation_failed: { in_app: true, email: true },
      mention: { in_app: false, email: false },
      comment_resolved: { in_app: true, email: true },
    }

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { preferences: customPrefs },
            error: null,
          }),
        }),
      }),
    })

    const result = await getNotificationPreferences('user-1')
    expect(result).toEqual(customPrefs)
  })

  it('returns DEFAULT_PREFERENCES when not authenticated and no userId passed', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await getNotificationPreferences()
    expect(result).toEqual(DEFAULT_PREFERENCES)
  })
})

describe('updateNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('upserts preferences for current user', async () => {
    const mockUpsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValueOnce({
      upsert: mockUpsertFn,
    })

    const prefs = {
      validation_complete: { in_app: true, email: false },
      validation_failed: { in_app: true, email: true },
      mention: { in_app: true, email: true },
      comment_resolved: { in_app: false, email: false },
    }

    const result = await updateNotificationPreferences(prefs)

    expect(result).toEqual({ success: true })
    expect(mockFrom).toHaveBeenCalledWith('notification_preferences')
    expect(mockUpsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        preferences: prefs,
      }),
      { onConflict: 'user_id' }
    )
  })

  it('returns error when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await updateNotificationPreferences(DEFAULT_PREFERENCES)
    expect(result).toEqual({ error: 'Not authenticated' })
  })
})

describe('createNotification email dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSendNotificationEmail.mockResolvedValue({ data: { id: 'email-1' }, error: null })
  })

  function setupMockFrom(prefsData: unknown, insertResult = { data: null, error: null }) {
    // createNotification calls from() multiple times:
    // 1. notification_preferences (select prefs)
    // 2. notifications (insert)
    // 3. profiles (get user email)
    // 4. profiles (get actor name)
    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: prefsData,
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'notifications') {
        return {
          insert: vi.fn().mockResolvedValue(insertResult),
        }
      }
      if (table === 'profiles') {
        callCount++
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: callCount <= 1
                  ? { email: 'user@example.com', full_name: 'Test User' }
                  : { full_name: 'Actor Name' },
                error: null,
              }),
            }),
          }),
        }
      }
      return { select: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis() }
    })
  }

  it('calls sendNotificationEmail when email is enabled for type', async () => {
    // No preferences row = all-on (DEFAULT_PREFERENCES)
    setupMockFrom(null)

    await createNotification({
      userId: 'user-2',
      orgId: 'org-1',
      type: 'mention',
      title: 'You were mentioned',
      actorId: 'user-1',
      linkUrl: '/issues/123',
    })

    // Wait for fire-and-forget to complete
    await new Promise((r) => setTimeout(r, 10))

    expect(mockSendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        type: 'mention',
        title: 'You were mentioned',
      })
    )
  })

  it('does NOT call sendNotificationEmail when email is disabled for type', async () => {
    setupMockFrom({
      preferences: {
        validation_complete: { in_app: true, email: true },
        validation_failed: { in_app: true, email: true },
        mention: { in_app: true, email: false },
        comment_resolved: { in_app: true, email: true },
      },
    })

    await createNotification({
      userId: 'user-2',
      orgId: 'org-1',
      type: 'mention',
      title: 'You were mentioned',
    })

    await new Promise((r) => setTimeout(r, 10))

    expect(mockSendNotificationEmail).not.toHaveBeenCalled()
  })

  it('does NOT insert notification when in_app preference is disabled', async () => {
    const mockInsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  preferences: {
                    validation_complete: { in_app: true, email: true },
                    validation_failed: { in_app: true, email: true },
                    mention: { in_app: false, email: false },
                    comment_resolved: { in_app: true, email: true },
                  },
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'notifications') {
        return { insert: mockInsertFn }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }
    })

    await createNotification({
      userId: 'user-2',
      orgId: 'org-1',
      type: 'mention',
      title: 'You were mentioned',
    })

    // Should not have called insert on notifications table
    expect(mockInsertFn).not.toHaveBeenCalled()
    // Should not have sent email either
    expect(mockSendNotificationEmail).not.toHaveBeenCalled()
  })
})
