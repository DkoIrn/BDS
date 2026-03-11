'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { SURVEY_TYPES } from '@/lib/types/projects'

export async function createProject(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null

  if (!name || name.length < 3 || name.length > 100) {
    return { error: 'Project name must be between 3 and 100 characters' }
  }

  const { error } = await supabase.from('projects').insert({
    user_id: user.id,
    name,
    description,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects')
  return { success: true }
}

export async function createJob(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const name = (formData.get('name') as string)?.trim()
  const surveyType = formData.get('survey_type') as string
  const description = (formData.get('description') as string)?.trim() || null
  const projectId = formData.get('project_id') as string

  if (!name || name.length < 3 || name.length > 100) {
    return { error: 'Job name must be between 3 and 100 characters' }
  }

  if (!surveyType || !SURVEY_TYPES.includes(surveyType as typeof SURVEY_TYPES[number])) {
    return { error: 'Invalid survey type' }
  }

  if (!projectId) {
    return { error: 'Project ID is required' }
  }

  const { error } = await supabase.from('jobs').insert({
    user_id: user.id,
    project_id: projectId,
    name,
    survey_type: surveyType,
    description,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects')
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Verify ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .single()

  if (!project || project.user_id !== user.id) {
    return { error: 'Project not found' }
  }

  // Delete all files from storage for jobs in this project
  const { data: datasets } = await supabase
    .from('datasets')
    .select('storage_path, job_id, jobs!inner(project_id)')
    .eq('jobs.project_id', projectId)

  if (datasets && datasets.length > 0) {
    const paths = datasets.map((d) => d.storage_path)
    await supabase.storage.from('datasets').remove(paths)
  }

  // Cascade delete handled by DB foreign keys (jobs → datasets)
  // Just delete the project
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects')
  return { success: true }
}
