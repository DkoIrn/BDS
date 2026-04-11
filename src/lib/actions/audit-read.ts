'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/permissions'

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
 * Uses org-scoped access via RLS.
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

  const orgResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in orgResult) return { error: orgResult.error }

  // RLS handles org-scoped visibility via entity chain
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, metadata, created_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { error: error.message }

  return { data: (data ?? []) as AuditLogEntry[] }
}

/**
 * Find the "after cleaning" value for a specific issue by cross-referencing
 * clean.auto and clean.ai_fix audit log entries.
 */
export async function getCleaningAuditForIssue(
  datasetId: string,
  rowNumber: number,
  columnName: string
): Promise<{ afterValue: string; changeType: string; source: string } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // RLS handles org-scoped access
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('action, metadata')
    .eq('entity_type', 'dataset')
    .eq('entity_id', datasetId)
    .in('action', ['clean.auto', 'clean.ai_fix'])
    .order('created_at', { ascending: false })
    .limit(20)

  if (!logs || logs.length === 0) return null

  // Search for a matching change in the audit logs
  for (const log of logs) {
    const meta = log.metadata as Record<string, unknown>
    if (log.action === 'clean.ai_fix') {
      if (meta.row === rowNumber && meta.column === columnName) {
        return {
          afterValue: String(meta.after ?? ''),
          changeType: String(meta.type ?? 'ai_fix'),
          source: 'AI Fix',
        }
      }
    }
    if (log.action === 'clean.auto' && Array.isArray(meta.changes)) {
      const match = (
        meta.changes as Array<{
          row: number
          column: string
          after: string
          type: string
        }>
      ).find((c) => c.row === rowNumber && c.column === columnName)
      if (match) {
        return {
          afterValue: match.after,
          changeType: match.type,
          source: 'Auto-Fix',
        }
      }
    }
  }
  return null
}

/**
 * Fetch all audit logs for a project (across all datasets/entities).
 * Uses org-scoped access via RLS.
 */
export async function getProjectAuditLogs(
  projectId: string
): Promise<{ data: AuditLogEntry[] } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const orgResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in orgResult) return { error: orgResult.error }

  // Get all dataset IDs in this project (RLS scopes to org)
  const { data: datasets } = await supabase
    .from('datasets')
    .select('id, jobs!inner(project_id)')
    .eq('jobs.project_id', projectId)

  const datasetIds = (datasets ?? []).map((d: { id: string }) => d.id)

  if (datasetIds.length === 0) return { data: [] }

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, metadata, created_at')
    .in('entity_id', datasetIds)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return { error: error.message }

  return { data: (data ?? []) as AuditLogEntry[] }
}
