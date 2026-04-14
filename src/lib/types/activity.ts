export type ActivityEventType =
  | 'validation_run'
  | 'validation_failed'
  | 'cleaning_applied'
  | 'comment_added'
  | 'comment_resolved'
  | 'report_exported'
  | 'certificate_generated'
  | 'dataset_uploaded'

export interface ActivityEvent {
  id: string
  project_id: string
  org_id: string
  actor_id: string | null
  event_type: ActivityEventType
  summary: string
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface ActivityEventWithActor extends ActivityEvent {
  actor: { full_name: string | null } | null
}
