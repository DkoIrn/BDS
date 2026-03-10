'use server'

import { createClient } from '@/lib/supabase/server'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const fullName = formData.get('full_name') as string

  if (!fullName || fullName.trim().length === 0) {
    return { error: 'Full name is required' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
