import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

// Mock server actions
const mockGetNotificationPreferences = vi.fn()
const mockUpdateNotificationPreferences = vi.fn()

vi.mock('@/lib/actions/notification-preferences', () => ({
  getNotificationPreferences: (...args: unknown[]) =>
    mockGetNotificationPreferences(...args),
  updateNotificationPreferences: (...args: unknown[]) =>
    mockUpdateNotificationPreferences(...args),
}))

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { NotificationPreferences } from '@/components/settings/notification-preferences'
import { DEFAULT_PREFERENCES } from '@/lib/types/notifications'

describe('NotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetNotificationPreferences.mockResolvedValue(DEFAULT_PREFERENCES)
    mockUpdateNotificationPreferences.mockResolvedValue({ success: true })
  })

  it('renders 4 rows with labels', async () => {
    render(<NotificationPreferences />)
    await waitFor(() => {
      expect(screen.getByText('Validation Complete')).toBeDefined()
      expect(screen.getByText('Validation Failed')).toBeDefined()
      expect(screen.getByText('Mentions')).toBeDefined()
      expect(screen.getByText('Comment Resolved')).toBeDefined()
    })
  })

  it('renders 8 toggle switches (2 per row)', async () => {
    render(<NotificationPreferences />)
    await waitFor(() => {
      const switches = screen.getAllByRole('switch')
      expect(switches).toHaveLength(8)
    })
  })

  it('calls updateNotificationPreferences when toggled', async () => {
    render(<NotificationPreferences />)
    await waitFor(() => {
      expect(screen.getAllByRole('switch')).toHaveLength(8)
    })

    const switches = screen.getAllByRole('switch')
    // Toggle the first switch (Validation Complete In-App) off
    fireEvent.click(switches[0])

    await waitFor(() => {
      expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          validation_complete: expect.objectContaining({ in_app: false }),
        })
      )
    })
  })
})
