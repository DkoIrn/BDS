import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/navigation (needed by some transitive deps)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Mock server actions
const mockGetIssueComments = vi.fn()
const mockAddComment = vi.fn().mockResolvedValue({ success: true, comment: {} })
const mockDeleteComment = vi.fn().mockResolvedValue({ success: true })
const mockResolveComment = vi.fn().mockResolvedValue({ success: true, comment: {} })
const mockReopenComment = vi.fn().mockResolvedValue({ success: true })

vi.mock('@/lib/actions/comments', () => ({
  getIssueComments: (...args: unknown[]) => mockGetIssueComments(...args),
  addComment: (...args: unknown[]) => mockAddComment(...args),
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  resolveComment: (...args: unknown[]) => mockResolveComment(...args),
  reopenComment: (...args: unknown[]) => mockReopenComment(...args),
}))

const mockGetTeamMembers = vi.fn().mockResolvedValue({ data: [] })

vi.mock('@/lib/actions/team', () => ({
  getTeamMembers: (...args: unknown[]) => mockGetTeamMembers(...args),
}))

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { IssueComments } from '@/components/comments/issue-comments'
import type { IssueComment } from '@/lib/types/organisations'

const baseComment: IssueComment = {
  id: 'c1',
  issue_id: 'issue-1',
  user_id: 'user-2',
  content: 'This looks like an issue',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  resolved_at: null,
  resolved_by: null,
  profiles: { full_name: 'Jane Doe' },
}

const resolvedComment: IssueComment = {
  id: 'c2',
  issue_id: 'issue-1',
  user_id: 'user-2',
  content: 'Fixed the problem',
  created_at: new Date(Date.now() - 3600000).toISOString(),
  updated_at: new Date().toISOString(),
  resolved_at: new Date().toISOString(),
  resolved_by: 'user-1',
  resolved_by_name: 'John Smith',
  profiles: { full_name: 'Jane Doe' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetIssueComments.mockResolvedValue([baseComment])
  mockGetTeamMembers.mockResolvedValue({ data: [] })
})

describe('Comment Resolution UI', () => {
  it('renders unresolved comments normally', async () => {
    mockGetIssueComments.mockResolvedValue([baseComment])

    render(<IssueComments issueId="issue-1" currentUserId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('This looks like an issue')).toBeDefined()
      expect(screen.getByText('Jane Doe')).toBeDefined()
    })
  })

  it('shows resolve button on hover for unresolved comments', async () => {
    mockGetIssueComments.mockResolvedValue([baseComment])

    render(<IssueComments issueId="issue-1" currentUserId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('This looks like an issue')).toBeDefined()
    })

    // Resolve button should exist (hidden via opacity until hover)
    const resolveBtn = screen.getByTitle('Resolve comment')
    expect(resolveBtn).toBeDefined()
  })

  it('shows "Show resolved" toggle when resolved comments exist', async () => {
    mockGetIssueComments.mockResolvedValue([baseComment, resolvedComment])

    render(<IssueComments issueId="issue-1" currentUserId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Show resolved (1)')).toBeDefined()
    })
  })

  it('renders resolved comments in collapsed state', async () => {
    mockGetIssueComments.mockResolvedValue([baseComment, resolvedComment])

    render(<IssueComments issueId="issue-1" currentUserId="user-1" />)

    // Toggle to show resolved
    await waitFor(() => {
      expect(screen.getByText('Show resolved (1)')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Show resolved (1)'))

    // Should show collapsed resolved comment
    await waitFor(() => {
      expect(screen.getByText(/John Smith resolved this/)).toBeDefined()
    })
  })

  it('toggle changes filter text', async () => {
    mockGetIssueComments.mockResolvedValue([baseComment, resolvedComment])

    render(<IssueComments issueId="issue-1" currentUserId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Show resolved (1)')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Show resolved (1)'))

    await waitFor(() => {
      expect(screen.getByText('Hide resolved')).toBeDefined()
    })
  })
})
