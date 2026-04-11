'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Dataset, DatasetStatus } from '@/lib/types/files'
import type { ColumnMapping } from '@/lib/parsing/types'
import { TIER_LIMITS, checkUsageLimit } from '@/lib/usage'
import { requireOrgRole } from '@/lib/permissions'

export async function createFileRecord(data: {
  jobId: string
  fileName: string
  fileSize: number
  mimeType: string
  storagePath: string
}): Promise<{ success: true; id: string } | { error: string; limitReached?: boolean }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'reviewer')
  if ('error' in orgResult) return { error: orgResult.error }
  const { orgId } = orgResult

  // Verify user has access to the job (RLS handles org scoping)
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, project_id')
    .eq('id', data.jobId)
    .single()

  if (jobError || !job) {
    return { error: 'Job not found or access denied' }
  }

  // Tier enforcement: check storage limit (org-scoped)
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, billing_cycle_start')
    .eq('id', user.id)
    .single()

  const plan = profile?.plan ?? 'free'
  const limits = TIER_LIMITS[plan] ?? TIER_LIMITS['free']

  // Count storage across all org members' datasets
  const { data: orgMembers } = await supabase
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)

  const memberIds = (orgMembers ?? []).map((m: { user_id: string }) => m.user_id)

  const { data: storageRows } = await supabase
    .from('datasets')
    .select('file_size')
    .in('user_id', memberIds)

  const currentStorageBytes = (storageRows ?? []).reduce(
    (sum: number, row: { file_size: number }) => sum + (row.file_size || 0),
    0
  )

  const storageLimitResult = checkUsageLimit(
    currentStorageBytes + data.fileSize,
    limits.maxStorageBytes,
    'storage',
    plan
  )
  if (!storageLimitResult.allowed) {
    return { error: storageLimitResult.message, limitReached: true }
  }

  const { data: dataset, error } = await supabase
    .from('datasets')
    .insert({
      job_id: data.jobId,
      user_id: user.id,
      file_name: data.fileName,
      file_size: data.fileSize,
      mime_type: data.mimeType,
      storage_path: data.storagePath,
    })
    .select('id')
    .single()

  if (error || !dataset) {
    return { error: error?.message ?? 'Failed to create file record' }
  }

  revalidatePath(`/projects/${job.project_id}/jobs/${data.jobId}`)
  return { success: true, id: dataset.id }
}

export async function deleteFile(
  fileId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'admin')
  if ('error' in orgResult) return { error: orgResult.error }

  // Get file record (RLS ensures org access)
  const { data: file, error: fetchError } = await supabase
    .from('datasets')
    .select('id, job_id, storage_path')
    .eq('id', fileId)
    .single()

  if (fetchError || !file) {
    return { error: 'File not found or access denied' }
  }

  // Delete from storage first
  const { error: storageError } = await supabase.storage
    .from('datasets')
    .remove([file.storage_path])

  if (storageError) {
    return { error: `Storage deletion failed: ${storageError.message}` }
  }

  // Delete DB record
  const { error: dbError } = await supabase
    .from('datasets')
    .delete()
    .eq('id', fileId)

  if (dbError) {
    return { error: `Database deletion failed: ${dbError.message}` }
  }

  revalidatePath(`/projects`)
  return { success: true }
}

export async function getDownloadUrl(
  fileId: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in orgResult) return { error: orgResult.error }

  // Get file record (RLS ensures org access)
  const { data: file, error: fetchError } = await supabase
    .from('datasets')
    .select('storage_path')
    .eq('id', fileId)
    .single()

  if (fetchError || !file) {
    return { error: 'File not found or access denied' }
  }

  const { data, error } = await supabase.storage
    .from('datasets')
    .createSignedUrl(file.storage_path, 300)

  if (error || !data?.signedUrl) {
    return { error: error?.message ?? 'Failed to generate download URL' }
  }

  return { url: data.signedUrl }
}

export async function getJobFiles(
  jobId: string
): Promise<{ data: Dataset[] } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in orgResult) return { error: orgResult.error }

  // RLS ensures job belongs to the user's org
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    return { error: 'Job not found or access denied' }
  }

  const { data: datasets, error } = await supabase
    .from('datasets')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data: datasets as Dataset[] }
}

export async function updateDatasetStatus(
  datasetId: string,
  status: DatasetStatus,
  extra?: Partial<Pick<Dataset, 'parsed_metadata' | 'column_mappings' | 'header_row_index' | 'total_rows' | 'parse_warnings'>>
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'reviewer')
  if ('error' in orgResult) return { error: orgResult.error }

  // RLS ensures dataset belongs to the user's org
  const { error } = await supabase
    .from('datasets')
    .update({ status, ...extra })
    .eq('id', datasetId)

  if (error) {
    return { error: error.message }
  }

  // Revalidate to reflect status changes in the UI
  revalidatePath('/projects')
  return { success: true }
}

export async function getAllUserDatasets(): Promise<
  { data: { id: string; file_name: string; file_size: number; job_name: string; project_name: string; storage_path: string }[] } | { error: string }
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in orgResult) return { error: orgResult.error }
  const { orgId } = orgResult

  // Get all datasets for projects in this org
  const { data: datasets, error } = await supabase
    .from('datasets')
    .select('id, file_name, file_size, storage_path, job_id, jobs(name, project_id, projects(name, org_id))')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return { error: error.message }
  }

  // Filter to org datasets (RLS handles this, but filter client-side for safety)
  const result = (datasets || [])
    .filter((d: Record<string, unknown>) => {
      const job = d.jobs as Record<string, unknown> | null
      const project = job?.projects as Record<string, unknown> | null
      return project?.org_id === orgId
    })
    .map((d: Record<string, unknown>) => {
      const job = d.jobs as Record<string, unknown> | null
      const project = job?.projects as Record<string, unknown> | null
      return {
        id: d.id as string,
        file_name: d.file_name as string,
        file_size: d.file_size as number,
        storage_path: d.storage_path as string,
        job_name: (job?.name as string) || 'Unknown Job',
        project_name: (project?.name as string) || 'Unknown Project',
      }
    })

  return { data: result }
}

export async function getDatasetSignedUrl(
  datasetId: string
): Promise<{ url: string; fileName: string } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'viewer')
  if ('error' in orgResult) return { error: orgResult.error }

  // RLS ensures dataset belongs to the user's org
  const { data: file, error: fetchError } = await supabase
    .from('datasets')
    .select('storage_path, file_name')
    .eq('id', datasetId)
    .single()

  if (fetchError || !file) {
    return { error: 'File not found or access denied' }
  }

  const { data, error } = await supabase.storage
    .from('datasets')
    .createSignedUrl(file.storage_path, 300)

  if (error || !data?.signedUrl) {
    return { error: error?.message ?? 'Failed to generate download URL' }
  }

  return { url: data.signedUrl, fileName: file.file_name }
}

export async function saveColumnMappings(
  datasetId: string,
  mappings: ColumnMapping[]
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const orgResult = await requireOrgRole(supabase, user.id, 'reviewer')
  if ('error' in orgResult) return { error: orgResult.error }

  // RLS ensures dataset belongs to the user's org
  const { error } = await supabase
    .from('datasets')
    .update({
      column_mappings: mappings as unknown as Record<string, unknown>[],
      status: 'mapped' as DatasetStatus,
    })
    .eq('id', datasetId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects')
  return { success: true }
}
