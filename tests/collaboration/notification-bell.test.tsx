import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Mock server actions
const mockGetUnreadCount = vi.fn().mockResolvedValue(0)
const mockGetNotifications = vi.fn().mockResolvedValue([])
const mockMarkRead = vi.fn().mockResolvedValue({ success: true })
const mockMarkAllRead = vi.fn().mockResolvedValue({ success: true })

vi.mock('@/lib/actions/notifications', () => ({
  getUnreadCount: (...args: unknown[]) => mockGetUnreadCount(...args),
  getNotifications: (...args: unknown[]) => mockGetNotifications(...args),
  markRead: (...args: unknown[]) => mockMarkRead(...args),
  markAllRead: (...args: unknown[]) => mockMarkAllRead(...args),
}))

// Mock @base-ui/react/popover
vi.mock('@base-ui/react/popover', () => {
  const Popover = {
    Root: ({ children, open }: { children: React.ReactNode; open?: boolean; onOpenChange?: (v: boolean) => void }) => (
      <div data-testid="popover-root" data-open={open}>{children}</div>
    ),
    Trigger: ({ children, ...props }: React.ComponentProps<'button'>) => (
      <button data-testid="popover-trigger" {...props}>{children}</button>
    ),
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Positioner: ({ children }: { children: React.ReactNode; side?: string; align?: string; sideOffset?: number; className?: string }) => (
      <div data-testid="popover-positioner">{children}</div>
    ),
    Popup: ({ children }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="popover-popup">{children}</div>
    ),
  }
  return { Popover }
})

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { NotificationBell } from '@/components/notifications/notification-bell'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUnreadCount.mockResolvedValue(0)
  mockGetNotifications.mockResolvedValue([])
})

describe('NotificationBell', () => {
  it('renders bell icon', async () => {
    render(<NotificationBell userId="user-1" />)
    const trigger = screen.getByTestId('popover-trigger')
    expect(trigger).toBeDefined()
    expect(trigger.getAttribute('aria-label')).toBe('Notifications')
  })

  it('shows correct badge count', async () => {
    mockGetUnreadCount.mockResolvedValue(5)
    render(<NotificationBell userId="user-1" />)

    await waitFor(() => {
      const badge = screen.getByText('5')
      expect(badge).toBeDefined()
    })
  })

  it('shows 9+ when count exceeds 9', async () => {
    mockGetUnreadCount.mockResolvedValue(15)
    render(<NotificationBell userId="user-1" />)

    await waitFor(() => {
      const badge = screen.getByText('9+')
      expect(badge).toBeDefined()
    })
  })

  it('hides badge when count is 0', async () => {
    mockGetUnreadCount.mockResolvedValue(0)
    render(<NotificationBell userId="user-1" />)

    await waitFor(() => {
      expect(mockGetUnreadCount).toHaveBeenCalled()
    })

    // No badge element should exist
    const trigger = screen.getByTestId('popover-trigger')
    const badges = trigger.querySelectorAll('span.absolute')
    expect(badges.length).toBe(0)
  })

  it('shows empty state when no notifications', async () => {
    render(<NotificationBell userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('No notifications yet')).toBeDefined()
    })
  })

  it('renders notification items when present', async () => {
    mockGetUnreadCount.mockResolvedValue(1)
    mockGetNotifications.mockResolvedValue([
      {
        id: 'n1',
        user_id: 'user-1',
        org_id: 'org-1',
        type: 'mention',
        title: 'You were mentioned',
        body: 'In a comment',
        read: false,
        resource_type: 'issue',
        resource_id: 'issue-1',
        link_url: '/projects/p1/jobs/j1/files/f1',
        actor_id: 'user-2',
        created_at: new Date().toISOString(),
        actor_profile: { full_name: 'Jane Doe' },
      },
    ])

    render(<NotificationBell userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('You were mentioned')).toBeDefined()
      expect(screen.getByText('Jane Doe')).toBeDefined()
    })
  })
})
