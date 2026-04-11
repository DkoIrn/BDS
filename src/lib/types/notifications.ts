export type NotificationType =
  | 'validation_complete'
  | 'validation_failed'
  | 'mention'
  | 'comment_resolved'

export interface Notification {
  id: string
  user_id: string
  org_id: string
  type: NotificationType
  title: string
  body: string | null
  read: boolean
  resource_type: 'dataset' | 'issue' | 'comment' | null
  resource_id: string | null
  link_url: string | null
  actor_id: string | null
  created_at: string
}

export interface NotificationWithActor extends Notification {
  actor_profile?: { full_name: string | null }
}
