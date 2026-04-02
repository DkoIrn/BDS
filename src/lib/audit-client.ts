// Client-side audit logging helper (fire-and-forget)

interface AuditEntry {
  action: string
  entityType: string
  entityId?: string
  metadata?: Record<string, unknown>
}

/**
 * Log an audit event from client-side code.
 * Fire-and-forget — never throws or blocks the UI.
 */
export function logAuditClient(entry: AuditEntry): void {
  fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  }).catch(() => {})
}

/**
 * Log multiple audit events in one call.
 */
export function logAuditClientBatch(entries: AuditEntry[]): void {
  fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries),
  }).catch(() => {})
}
