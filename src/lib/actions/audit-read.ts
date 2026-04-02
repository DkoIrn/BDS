'use server'

import { createClient } from '@/lib/supabase/server'

export interface AuditLogEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

/**
 * Fetch audit logs for a specific entity (e.g., a dataset).
 */
export async function getAuditLogs(
  entityType: string,
  entityId: string
): Promise<{ data: AuditLogEntry[] } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, metadata, created_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { error: error.message }

  return { data: (data ?? []) as AuditLogEntry[] }
}

/**
 * Fetch all audit logs for a project (across all datasets/entities).
 */
export async function getProjectAuditLogs(
  projectId: string
): Promise<{ data: AuditLogEntry[] } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // Get all dataset IDs in this project
  const { data: datasets } = await supabase
    .from('datasets')
    .select('id, jobs!inner(project_id)')
    .eq('jobs.project_id', projectId)
    .eq('user_id', user.id)

  const datasetIds = (datasets ?? []).map((d: { id: string }) => d.id)

  if (datasetIds.length === 0) return { data: [] }

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, metadata, created_at')
    .eq('user_id', user.id)
    .in('entity_id', datasetIds)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return { error: error.message }

  return { data: (data ?? []) as AuditLogEntry[] }
}
