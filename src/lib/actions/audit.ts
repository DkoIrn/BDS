'use server'

import { createClient } from '@/lib/supabase/server'

export type AuditAction =
  | 'validation.run'
  | 'validation.complete'
  | 'clean.auto'
  | 'clean.ai_fix'
  | 'clean.ai_reject'
  | 'export.download'
  | 'dataset.upload'
  | 'dataset.save_to_project'
  | 'dataset.delete'
  | 'project.create'
  | 'profile.update'
  | 'report.generate'

export type AuditEntityType =
  | 'dataset'
  | 'project'
  | 'job'
  | 'validation_run'
  | 'validation_profile'
  | 'report'

interface AuditEntry {
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string
  metadata?: Record<string, unknown>
}

/**
 * Write an audit log entry (server-side).
 * Silently fails — audit logging should never break the primary flow.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
    })
  } catch {
    // Never let audit logging break the primary flow
  }
}

/**
 * Write multiple audit log entries in one call (server-side).
 */
export async function logAuditBatch(entries: AuditEntry[]): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const rows = entries.map((entry) => ({
      user_id: user.id,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
    }))

    await supabase.from('audit_logs').insert(rows)
  } catch {
    // Silent fail
  }
}
