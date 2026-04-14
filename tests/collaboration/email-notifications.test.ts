import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Resend SDK - must use function keyword for constructor
const mockSend = vi.fn()

vi.mock('resend', () => ({
  Resend: function Resend() {
    return { emails: { send: mockSend } }
  },
}))

// Mock the React Email component
vi.mock('@/emails/notification-email', () => ({
  NotificationEmail: vi.fn((props: Record<string, unknown>) => `<email>${props.title}</email>`),
}))

// Set RESEND_API_KEY so the client initializes
vi.stubEnv('RESEND_API_KEY', 'test-key-123')

const { sendNotificationEmail } = await import('@/lib/email')
const { NotificationEmail } = await import('@/emails/notification-email')

describe('sendNotificationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls resend.emails.send with correct from/to/subject/react params', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'email-1' }, error: null })

    await sendNotificationEmail({
      to: 'user@example.com',
      type: 'mention',
      title: 'You were mentioned',
      body: 'Check this out',
      linkUrl: '/projects/123',
      actorName: 'Alice',
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'TruQC <notifications@truqc.co.uk>',
        to: ['user@example.com'],
        subject: 'You were mentioned',
      })
    )
    // Verify react prop was included
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        react: expect.anything(),
      })
    )
  })

  it('returns { data, error } from Resend SDK', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'email-42' }, error: null })

    const result = await sendNotificationEmail({
      to: 'user@example.com',
      type: 'validation_complete',
      title: 'Validation done',
    })

    expect(result).toEqual({ data: { id: 'email-42' }, error: null })
  })

  it('catches errors and returns { data: null, error } without throwing', async () => {
    mockSend.mockRejectedValueOnce(new Error('Network failure'))

    const result = await sendNotificationEmail({
      to: 'user@example.com',
      type: 'validation_failed',
      title: 'Validation failed',
    })

    expect(result.data).toBeNull()
    expect(result.error).toEqual({ message: 'Network failure' })
  })

  it('returns Resend error without throwing when SDK returns error', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid API key', statusCode: 403, name: 'forbidden' },
    })

    const result = await sendNotificationEmail({
      to: 'user@example.com',
      type: 'mention',
      title: 'Test',
    })

    expect(result.data).toBeNull()
    expect(result.error).toEqual({ message: 'Invalid API key' })
  })
})

describe('NotificationEmail component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is called with title, body, actorName, linkUrl props', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'email-1' }, error: null })

    await sendNotificationEmail({
      to: 'user@example.com',
      type: 'mention',
      title: 'New mention',
      body: 'Someone mentioned you',
      linkUrl: '/issues/456',
      actorName: 'Bob',
    })

    expect(NotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'mention',
        title: 'New mention',
        body: 'Someone mentioned you',
        linkUrl: '/issues/456',
        actorName: 'Bob',
      })
    )
  })
})
