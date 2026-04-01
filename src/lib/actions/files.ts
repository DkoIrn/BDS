'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Dataset, DatasetStatus } from '@/lib/types/files'
import type { ColumnMapping } from '@/lib/parsing/types'

export async function createFileRecord(data: {
  jobId: string
  fileName: string
  fileSize: number
  mimeType: string
  storagePath: string
}): Promise<{ success: true; id: string } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Verify user owns the job
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, project_id')
    .eq('id', data.jobId)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) {
    return { error: 'Job not found or access denied' }
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

  // Get file record (RLS ensures ownership)
  const { data: file, error: fetchError } = await supabase
    .from('datasets')
    .select('id, job_id, storage_path')
    .eq('id', fileId)
    .eq('user_id', user.id)
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

  // Get file record with ownership check
  const { data: file, error: fetchError } = await supabase
    .from('datasets')
    .select('storage_path')
    .eq('id', fileId)
    .eq('user_id', user.id)
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

  // Verify user owns the job
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('user_id', user.id)
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

  const { error } = await supabase
    .from('datasets')
    .update({ status, ...extra })
    .eq('id', datasetId)
    .eq('user_id', user.id)

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

  const { data: datasets, error } = await supabase
    .from('datasets')
    .select('id, file_name, file_size, storage_path, job_id, jobs(name, project_id, projects(name))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return { error: error.message }
  }

  const result = (datasets || []).map((d: Record<string, unknown>) => {
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

  const { data: file, error: fetchError } = await supabase
    .from('datasets')
    .select('storage_path, file_name')
    .eq('id', datasetId)
    .eq('user_id', user.id)
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

  const { error } = await supabase
    .from('datasets')
    .update({
      column_mappings: mappings as unknown as Record<string, unknown>[],
      status: 'mapped' as DatasetStatus,
    })
    .eq('id', datasetId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects')
  return { success: true }
}
