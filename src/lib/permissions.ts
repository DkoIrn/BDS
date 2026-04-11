import type { OrgRole } from '@/lib/types/organisations'
import { ROLE_HIERARCHY } from '@/lib/types/organisations'
import type { SupabaseClient } from '@supabase/supabase-js'

// Permission actions
export type PermissionAction =
  | 'view_projects'
  | 'upload_files'
  | 'run_validation'
  | 'triage_issues'
  | 'generate_reports'
  | 'download_reports'
  | 'add_comments'
  | 'approve_datasets'
  | 'manage_team'
  | 'manage_billing'
  | 'delete_projects'

// Minimum role required for each action
const MIN_ROLE: Record<PermissionAction, OrgRole> = {
  view_projects: 'viewer',
  upload_files: 'reviewer',
  run_validation: 'reviewer',
  triage_issues: 'reviewer',
  generate_reports: 'viewer',
  download_reports: 'viewer',
  add_comments: 'viewer',
  approve_datasets: 'reviewer',
  manage_team: 'admin',
  manage_billing: 'admin',
  delete_projects: 'admin',
}

export function hasPermission(role: OrgRole, action: PermissionAction): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[MIN_ROLE[action]]
}

// Server-side helper: get user's org role and verify minimum permission
export async function requireOrgRole(
  supabase: SupabaseClient,
  userId: string,
  minRole: OrgRole = 'viewer'
): Promise<{ orgId: string; role: OrgRole } | { error: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_org_id')
    .eq('id', userId)
    .single()

  if (!profile?.default_org_id) {
    return { error: 'No organisation found' }
  }

  const { data: membership } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', profile.default_org_id)
    .eq('user_id', userId)
    .single()

  if (!membership) {
    return { error: 'Not a member of this organisation' }
  }

  const role = membership.role as OrgRole
  if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) {
    return { error: 'Insufficient permissions' }
  }

  return { orgId: profile.default_org_id, role }
}
