import type { ClusterInput, IssueCluster } from './types'
import type { ValidationIssue as ServerValidationIssue } from '@/lib/types/validation'
import type { ValidationIssue as PipelineValidationIssue } from '@/app/(dashboard)/pipeline/lib/client-validate'

export function clusterIssues(_issues: ClusterInput[]): IssueCluster[] {
  throw new Error('Not implemented')
}

export function getTopBlockers(_clusters: IssueCluster[], _n?: number): IssueCluster[] {
  throw new Error('Not implemented')
}

export function adaptServerIssues(_issues: ServerValidationIssue[]): ClusterInput[] {
  throw new Error('Not implemented')
}

export function adaptPipelineIssues(_issues: PipelineValidationIssue[]): ClusterInput[] {
  throw new Error('Not implemented')
}
