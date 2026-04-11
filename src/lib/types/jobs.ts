/**
 * Job queue types matching the job_runs table and validation progress.
 */

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled"

export type ValidationStage =
  | "starting"
  | "downloading"
  | "parsing"
  | "validating"
  | "storing_results"
  | "complete"
  | "error"

export interface ValidationProgress {
  stage: ValidationStage
  detail: string
}

export interface JobRun {
  id: string
  datasetId: string
  jobType: string
  procrastinateJobId: number | null
  status: JobStatus
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  attemptNumber: number
  maxAttempts: number
  errorSummary: string | null
  errorDetail: string | null
  configSnapshot: Record<string, unknown> | null
  resultSummary: Record<string, unknown> | null
  createdAt: string
}

/** Raw row shape from Supabase (snake_case) */
export interface JobRunRow {
  id: string
  dataset_id: string
  job_type: string
  procrastinate_job_id: number | null
  status: JobStatus
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  attempt_number: number
  max_attempts: number
  error_summary: string | null
  error_detail: string | null
  config_snapshot: Record<string, unknown> | null
  result_summary: Record<string, unknown> | null
  created_at: string
}

/** Convert a snake_case row to camelCase JobRun */
export function toJobRun(row: JobRunRow): JobRun {
  return {
    id: row.id,
    datasetId: row.dataset_id,
    jobType: row.job_type,
    procrastinateJobId: row.procrastinate_job_id,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    attemptNumber: row.attempt_number,
    maxAttempts: row.max_attempts,
    errorSummary: row.error_summary,
    errorDetail: row.error_detail,
    configSnapshot: row.config_snapshot,
    resultSummary: row.result_summary,
    createdAt: row.created_at,
  }
}

/** Map validation stage to approximate progress percentage */
export function stageToPercent(stage: ValidationStage): number {
  const map: Record<ValidationStage, number> = {
    starting: 5,
    downloading: 15,
    parsing: 30,
    validating: 60,
    storing_results: 90,
    complete: 100,
    error: 0,
  }
  return map[stage] ?? 0
}
