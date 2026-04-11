export const ORG_ROLES = ['admin', 'reviewer', 'viewer'] as const
export type OrgRole = (typeof ORG_ROLES)[number]

export const ROLE_HIERARCHY: Record<OrgRole, number> = {
  viewer: 0,
  reviewer: 1,
  admin: 2,
}

export const APPROVAL_STATUSES = ['draft', 'reviewed', 'approved', 'issued'] as const
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

export const APPROVAL_TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  draft: ['reviewed'],
  reviewed: ['approved', 'draft'],
  approved: ['issued', 'reviewed'],
  issued: [],
}

export function canTransition(
  current: ApprovalStatus,
  next: ApprovalStatus
): boolean {
  return APPROVAL_TRANSITIONS[current].includes(next)
}

export interface Organisation {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: OrgRole
  invited_by: string | null
  created_at: string
  // Joined fields
  profiles?: { full_name: string | null; email?: string }
}

export interface OrgInvite {
  id: string
  org_id: string
  email: string
  role: OrgRole
  invited_by: string
  status: 'pending' | 'accepted' | 'expired'
  created_at: string
  expires_at: string
}

export interface IssueComment {
  id: string
  issue_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  // Joined fields
  profiles?: { full_name: string | null }
}
