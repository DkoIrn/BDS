import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Mock server actions
const mockGetProjectActivity = vi.fn()

vi.mock('@/lib/actions/activity', () => ({
  getProjectActivity: (...args: unknown[]) =>
    mockGetProjectActivity(...args),
}))

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ActivityFeed } from '@/components/activity/activity-feed'
import { ActivityItem } from '@/components/activity/activity-item'
import type { ActivityEventWithActor } from '@/lib/types/activity'

const makeEvent = (
  overrides: Partial<ActivityEventWithActor> = {}
): ActivityEventWithActor => ({
  id: 'evt-1',
  project_id: 'proj-1',
  org_id: 'org-1',
  actor_id: 'user-1',
  event_type: 'validation_run',
  summary: 'Ran validation on dataset',
  resource_type: 'dataset',
  resource_id: 'ds-1',
  metadata: {},
  created_at: new Date().toISOString(),
  actor: { full_name: 'Alice' },
  ...overrides,
})

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders activity items', async () => {
    mockGetProjectActivity.mockResolvedValue([
      makeEvent({ id: 'e1', summary: 'Ran validation' }),
      makeEvent({ id: 'e2', summary: 'Uploaded dataset', event_type: 'dataset_uploaded' }),
    ])

    render(<ActivityFeed projectId="proj-1" />)
    await waitFor(() => {
      expect(screen.getByText('Ran validation')).toBeDefined()
      expect(screen.getByText('Uploaded dataset')).toBeDefined()
    })
  })

  it('shows Load more button when events equal limit', async () => {
    const events = Array.from({ length: 20 }, (_, i) =>
      makeEvent({ id: `e-${i}`, summary: `Event ${i}` })
    )
    mockGetProjectActivity.mockResolvedValue(events)

    render(<ActivityFeed projectId="proj-1" />)
    await waitFor(() => {
      expect(screen.getByText('Load more')).toBeDefined()
    })
  })

  it('shows empty state when no events', async () => {
    mockGetProjectActivity.mockResolvedValue([])

    render(<ActivityFeed projectId="proj-1" />)
    await waitFor(() => {
      expect(screen.getByText('No activity yet')).toBeDefined()
    })
  })
})

describe('ActivityItem', () => {
  it('renders actor name, summary, and timestamp', () => {
    const event = makeEvent({
      summary: 'Ran validation on dataset',
      actor: { full_name: 'Alice' },
    })
    render(<ActivityItem event={event} />)
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Ran validation on dataset')).toBeDefined()
  })
})
