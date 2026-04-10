import { describe, it, expect } from 'vitest'
import { clusterIssues, getTopBlockers, adaptServerIssues, adaptPipelineIssues } from './cluster-issues'
import type { ClusterInput } from './types'
import type { ValidationIssue as ServerValidationIssue } from '@/lib/types/validation'
import type { ValidationIssue as PipelineValidationIssue } from '@/app/(dashboard)/pipeline/lib/client-validate'

function makeIssue(overrides: Partial<ClusterInput> = {}): ClusterInput {
  return {
    id: 'test-1',
    rule_type: 'missing_data',
    severity: 'warning',
    row_number: 1,
    column_name: 'DOB',
    message: 'Missing value',
    kp_value: null,
    ...overrides,
  }
}

describe('clusterIssues', () => {
  it('groups issues with same rule_type + column_name into one cluster', () => {
    const issues: ClusterInput[] = [
      makeIssue({ id: '1', rule_type: 'kp_gaps', column_name: 'DOB', row_number: 10 }),
      makeIssue({ id: '2', rule_type: 'kp_gaps', column_name: 'DOB', row_number: 20 }),
      makeIssue({ id: '3', rule_type: 'missing_data', column_name: 'DOC', row_number: 5 }),
    ]
    const clusters = clusterIssues(issues)
    expect(clusters).toHaveLength(2)
    const kpCluster = clusters.find((c) => c.rule_type === 'kp_gaps')
    expect(kpCluster).toBeDefined()
    expect(kpCluster!.count).toBe(2)
    expect(kpCluster!.issues).toHaveLength(2)
  })

  it('returns clusters sorted by priority (critical*10 > warning*3 > info*1)', () => {
    const issues: ClusterInput[] = [
      // 2 info issues => score 2*1 = 2
      makeIssue({ id: '1', rule_type: 'missing_data', column_name: 'A', severity: 'info', row_number: 1 }),
      makeIssue({ id: '2', rule_type: 'missing_data', column_name: 'A', severity: 'info', row_number: 2 }),
      // 1 critical issue => score 1*10 = 10
      makeIssue({ id: '3', rule_type: 'outliers_zscore', column_name: 'B', severity: 'critical', row_number: 3 }),
      // 3 warning issues => score 3*3 = 9
      makeIssue({ id: '4', rule_type: 'kp_gaps', column_name: 'C', severity: 'warning', row_number: 4 }),
      makeIssue({ id: '5', rule_type: 'kp_gaps', column_name: 'C', severity: 'warning', row_number: 5 }),
      makeIssue({ id: '6', rule_type: 'kp_gaps', column_name: 'C', severity: 'warning', row_number: 6 }),
    ]
    const clusters = clusterIssues(issues)
    expect(clusters[0].rule_type).toBe('outliers_zscore') // score 10
    expect(clusters[1].rule_type).toBe('kp_gaps')         // score 9
    expect(clusters[2].rule_type).toBe('missing_data')    // score 2
  })

  it('cluster label includes count and KP range when kp_value present', () => {
    const issues: ClusterInput[] = [
      makeIssue({ id: '1', rule_type: 'kp_gaps', column_name: 'DOB', kp_value: 10, row_number: 1 }),
      makeIssue({ id: '2', rule_type: 'kp_gaps', column_name: 'DOB', kp_value: 50, row_number: 2 }),
      makeIssue({ id: '3', rule_type: 'kp_gaps', column_name: 'DOB', kp_value: 30, row_number: 3 }),
      makeIssue({ id: '4', rule_type: 'kp_gaps', column_name: 'DOB', kp_value: 20, row_number: 4 }),
      makeIssue({ id: '5', rule_type: 'kp_gaps', column_name: 'DOB', kp_value: 40, row_number: 5 }),
    ]
    const clusters = clusterIssues(issues)
    expect(clusters[0].label).toBe('5 KP gaps in "DOB" between KP 10.0-50.0')
    expect(clusters[0].kp_range).toEqual({ min: 10, max: 50 })
  })

  it('cluster label works without KP values', () => {
    const issues: ClusterInput[] = [
      makeIssue({ id: '1', rule_type: 'missing_data', column_name: 'DOC', kp_value: null, row_number: 1 }),
      makeIssue({ id: '2', rule_type: 'missing_data', column_name: 'DOC', kp_value: null, row_number: 5 }),
      makeIssue({ id: '3', rule_type: 'missing_data', column_name: 'DOC', kp_value: null, row_number: 10 }),
    ]
    const clusters = clusterIssues(issues)
    expect(clusters[0].label).toBe('3 missing data in "DOC"')
    expect(clusters[0].kp_range).toBeNull()
  })

  it('single-issue cluster has count=1 and singular label', () => {
    const issues: ClusterInput[] = [
      makeIssue({ id: '1', rule_type: 'outliers_zscore', column_name: 'Depth', kp_value: null, row_number: 42 }),
    ]
    const clusters = clusterIssues(issues)
    expect(clusters[0].count).toBe(1)
    expect(clusters[0].label).toBe('1 z-score outlier in "Depth"')
  })

  it('empty issues array returns empty clusters array', () => {
    const clusters = clusterIssues([])
    expect(clusters).toEqual([])
  })
})

describe('getTopBlockers', () => {
  it('returns first 3 clusters from sorted output', () => {
    const issues: ClusterInput[] = [
      makeIssue({ id: '1', rule_type: 'a', column_name: 'X', severity: 'critical', row_number: 1 }),
      makeIssue({ id: '2', rule_type: 'b', column_name: 'X', severity: 'critical', row_number: 2 }),
      makeIssue({ id: '3', rule_type: 'c', column_name: 'X', severity: 'warning', row_number: 3 }),
      makeIssue({ id: '4', rule_type: 'd', column_name: 'X', severity: 'info', row_number: 4 }),
    ]
    const clusters = clusterIssues(issues)
    const top = getTopBlockers(clusters)
    expect(top).toHaveLength(3)
    expect(top[0].priorityScore).toBeGreaterThanOrEqual(top[1].priorityScore)
    expect(top[1].priorityScore).toBeGreaterThanOrEqual(top[2].priorityScore)
  })

  it('returns fewer than 3 if fewer clusters exist', () => {
    const issues: ClusterInput[] = [
      makeIssue({ id: '1', rule_type: 'a', column_name: 'X', row_number: 1 }),
    ]
    const clusters = clusterIssues(issues)
    const top = getTopBlockers(clusters)
    expect(top).toHaveLength(1)
  })
})

describe('adaptServerIssues', () => {
  it('maps Supabase ValidationIssue[] to ClusterInput[]', () => {
    const serverIssues: ServerValidationIssue[] = [
      {
        id: 'abc-123',
        run_id: 'run-1',
        dataset_id: 'ds-1',
        row_number: 5,
        column_name: 'DOB',
        rule_type: 'missing_data',
        severity: 'warning',
        message: 'Missing value in DOB',
        expected: '> 0',
        actual: null,
        kp_value: 12.5,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    const result = adaptServerIssues(serverIssues)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'abc-123',
      rule_type: 'missing_data',
      severity: 'warning',
      row_number: 5,
      column_name: 'DOB',
      message: 'Missing value in DOB',
      kp_value: 12.5,
    })
  })
})

describe('adaptPipelineIssues', () => {
  it('maps pipeline ValidationIssue[] to ClusterInput[] (type->rule_type, optional row/column handled)', () => {
    const pipelineIssues: PipelineValidationIssue[] = [
      {
        type: 'kp_gap',
        severity: 'critical',
        row: 10,
        column: 'KP',
        message: 'KP gap detected',
      },
      {
        type: 'missing',
        severity: 'info',
        message: 'Missing value',
        // no row or column
      },
    ]
    const result = adaptPipelineIssues(pipelineIssues)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'pipeline-0',
      rule_type: 'kp_gap',
      severity: 'critical',
      row_number: 10,
      column_name: 'KP',
      message: 'KP gap detected',
      kp_value: null,
    })
    expect(result[1]).toEqual({
      id: 'pipeline-1',
      rule_type: 'missing',
      severity: 'info',
      row_number: 0,
      column_name: 'unknown',
      message: 'Missing value',
      kp_value: null,
    })
  })
})
