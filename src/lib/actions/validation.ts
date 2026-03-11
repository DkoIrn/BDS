'use server'

import { createClient } from '@/lib/supabase/server'
import type { ValidationRun, ValidationIssue } from '@/lib/types/validation'

/**
 * Fetch all validation runs for a dataset, ordered by most recent first.
 * Verifies dataset ownership through the datasets table join.
 */
export async function getValidationRuns(
  datasetId: string
): Promise<{ data: ValidationRun[] } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Verify ownership
  const { data: dataset, error: datasetError } = await supabase
    .from('datasets')
    .select('id')
    .eq('id', datasetId)
    .eq('user_id', user.id)
    .single()

  if (datasetError || !dataset) {
    return { error: 'Dataset not found or access denied' }
  }

  const { data: runs, error: runsError } = await supabase
    .from('validation_runs')
    .select('*')
    .eq('dataset_id', datasetId)
    .order('run_at', { ascending: false })

  if (runsError) {
    return { error: runsError.message }
  }

  return { data: runs as ValidationRun[] }
}

/**
 * Fetch all validation issues for a specific run, ordered by severity
 * (critical first) then row number.
 * Verifies ownership through the dataset associated with the run.
 */
export async function getValidationIssues(
  runId: string
): Promise<{ data: ValidationIssue[] } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Fetch the run to get dataset_id, then verify ownership
  const { data: run, error: runError } = await supabase
    .from('validation_runs')
    .select('dataset_id')
    .eq('id', runId)
    .single()

  if (runError || !run) {
    return { error: 'Validation run not found' }
  }

  const { data: dataset, error: datasetError } = await supabase
    .from('datasets')
    .select('id')
    .eq('id', run.dataset_id)
    .eq('user_id', user.id)
    .single()

  if (datasetError || !dataset) {
    return { error: 'Access denied' }
  }

  // Custom ordering: critical > warning > info, then by row_number
  const { data: issues, error: issuesError } = await supabase
    .from('validation_issues')
    .select('*')
    .eq('run_id', runId)
    .order('row_number', { ascending: true })

  if (issuesError) {
    return { error: issuesError.message }
  }

  // Sort by severity priority (critical first), then row_number
  const severityOrder: Record<string, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  }

  const sorted = (issues as ValidationIssue[]).sort((a, b) => {
    const sevDiff = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
    if (sevDiff !== 0) return sevDiff
    return a.row_number - b.row_number
  })

  return { data: sorted }
}
