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
