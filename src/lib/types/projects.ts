export const SURVEY_TYPES = [
  'General',
  'DOB',
  'DOC',
  'TOP',
  'Event Listing',
  'Pipeline Position',
  'ROVV',
] as const

export type SurveyType = (typeof SURVEY_TYPES)[number]

export const PROJECT_STATUSES = ['active', 'completed', 'archived'] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const JOB_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
  jobs: { count: number }[]
}

export interface Job {
  id: string
  project_id: string
  user_id: string
  name: string
  survey_type: SurveyType
  description: string | null
  status: JobStatus
  created_at: string
  updated_at: string
}
