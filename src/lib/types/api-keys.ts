export interface ApiKey {
  id: string
  org_id: string
  user_id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface ApiKeyCreateResult {
  key: string      // raw key, shown once
  prefix: string
  id: string
}

export interface WebhookEndpoint {
  id: string
  org_id: string
  url: string
  events: string[]
  active: boolean
  created_at: string
  updated_at: string
}

export interface WebhookDelivery {
  id: string
  endpoint_id: string
  event: string
  payload: Record<string, unknown>
  status: 'pending' | 'delivered' | 'failed'
  attempts: number
  last_attempt_at: string | null
  response_status: number | null
  created_at: string
}
