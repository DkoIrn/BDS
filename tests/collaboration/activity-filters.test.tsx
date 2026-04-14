import { describe, it, expect, vi } from 'vitest'

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActivityFilters } from '@/components/activity/activity-filters'
import type { ActivityEventType } from '@/lib/types/activity'

const ALL_TYPES: ActivityEventType[] = [
  'validation_run',
  'validation_failed',
  'cleaning_applied',
  'comment_added',
  'comment_resolved',
  'report_exported',
  'certificate_generated',
  'dataset_uploaded',
]

describe('ActivityFilters', () => {
  it('renders filter chips for each event type', () => {
    const onChange = vi.fn()
    render(
      <ActivityFilters
        activeFilters={new Set(ALL_TYPES)}
        onFilterChange={onChange}
      />
    )
    expect(screen.getByText('Validations')).toBeDefined()
    expect(screen.getByText('Failures')).toBeDefined()
    expect(screen.getByText('Fixes')).toBeDefined()
    expect(screen.getByText('Comments')).toBeDefined()
    expect(screen.getByText('Resolved')).toBeDefined()
    expect(screen.getByText('Exports')).toBeDefined()
    expect(screen.getByText('Certificates')).toBeDefined()
    expect(screen.getByText('Uploads')).toBeDefined()
  })

  it('calls onFilterChange when chip is toggled', () => {
    const onChange = vi.fn()
    render(
      <ActivityFilters
        activeFilters={new Set(ALL_TYPES)}
        onFilterChange={onChange}
      />
    )
    fireEvent.click(screen.getByText('Validations'))
    expect(onChange).toHaveBeenCalledTimes(1)
    const newSet = onChange.mock.calls[0][0] as Set<ActivityEventType>
    expect(newSet.has('validation_run')).toBe(false)
  })
})
