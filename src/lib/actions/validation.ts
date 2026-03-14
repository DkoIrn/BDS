'use server'

import { createClient } from '@/lib/supabase/server'
import { parseCSV } from '@/lib/parsing/csv-parser'
import { parseExcel } from '@/lib/parsing/excel-parser'
import type { ValidationRun, ValidationIssue, JobDatasetSummary } from '@/lib/types/validation'

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

/**
 * Fetch surrounding rows from the original dataset file for context display.
 * Downloads the file from Supabase Storage, parses it, and extracts rows
 * around the flagged row number.
 */
export async function getIssueContext(
  datasetId: string,
  rowNumber: number,
  contextSize: number = 5
): Promise<
  | { data: { headers: string[]; rows: { rowNumber: number; cells: string[]; isFlagged: boolean }[] } }
  | { error: string }
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: dataset, error: datasetError } = await supabase
    .from('datasets')
    .select('id, storage_path, file_name, mime_type, header_row_index, user_id')
    .eq('id', datasetId)
    .eq('user_id', user.id)
    .single()

  if (datasetError || !dataset) {
    return { error: 'Dataset not found or access denied' }
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('datasets')
    .download(dataset.storage_path as string)

  if (downloadError || !fileData) {
    return { error: `File download failed: ${downloadError?.message ?? 'Unknown error'}` }
  }

  const fileName = dataset.file_name as string
  const mimeType = dataset.mime_type as string
  const isCSV = mimeType === 'text/csv' || fileName.endsWith('.csv')
  const isExcel =
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileName.endsWith('.xls') ||
    fileName.endsWith('.xlsx')

  let allRows: string[][]

  if (isCSV) {
    const text = await fileData.text()
    allRows = parseCSV(text).rows
  } else if (isExcel) {
    const buffer = await fileData.arrayBuffer()
    allRows = parseExcel(buffer).rows
  } else {
    return { error: `Unsupported file type: ${mimeType}` }
  }

  const headerRowIndex = (dataset.header_row_index as number) ?? 0
  const headers = allRows[headerRowIndex] ?? []
  const dataRows = allRows.slice(headerRowIndex + 1)

  // rowNumber is 1-based (matching validation_issues.row_number)
  const startIdx = Math.max(0, rowNumber - 1 - contextSize)
  const endIdx = Math.min(dataRows.length, rowNumber - 1 + contextSize + 1)
  const contextRows = dataRows.slice(startIdx, endIdx).map((cells, i) => ({
    rowNumber: startIdx + i + 1,
    cells,
    isFlagged: startIdx + i + 1 === rowNumber,
  }))

  return { data: { headers, rows: contextRows } }
}

/**
 * Fetch a summary of validation results for all datasets in a job.
 * Returns one entry per dataset with the latest run's stats.
 */
export async function getJobValidationSummary(
  jobId: string
): Promise<{ data: JobDatasetSummary[] } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: datasets, error: datasetsError } = await supabase
    .from('datasets')
    .select('id, file_name, status, validation_runs(id, total_issues, critical_count, pass_rate, run_at)')
    .eq('job_id', jobId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (datasetsError) {
    return { error: datasetsError.message }
  }

  const summaries: JobDatasetSummary[] = (datasets ?? []).map((ds) => {
    const runs = (ds.validation_runs as Array<{
      id: string
      total_issues: number
      critical_count: number
      pass_rate: number | null
      run_at: string
    }>) ?? []

    // Sort runs by run_at desc to get latest
    const sorted = [...runs].sort(
      (a, b) => new Date(b.run_at).getTime() - new Date(a.run_at).getTime()
    )
    const latest = sorted[0] ?? null

    return {
      id: ds.id as string,
      fileName: ds.file_name as string,
      verdict: latest ? (latest.critical_count > 0 ? 'FAIL' : 'PASS') : null,
      issueCount: latest?.total_issues ?? 0,
      passRate: latest?.pass_rate ?? null,
      lastRunAt: latest?.run_at ?? null,
      isValidated: (ds.status as string) === 'validated',
    }
  })

  return { data: summaries }
}
