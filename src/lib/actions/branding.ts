'use server'

import { createClient } from '@/lib/supabase/server'

export async function uploadBrandingLogo(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const logo = formData.get('logo') as File | null

  if (!logo) {
    return { error: 'No file provided' }
  }

  // Validate file type
  if (!['image/png', 'image/jpeg'].includes(logo.type)) {
    return { error: 'Logo must be a PNG or JPEG image' }
  }

  // Validate file size (max 2MB)
  if (logo.size > 2 * 1024 * 1024) {
    return { error: 'Logo must be less than 2MB' }
  }

  const path = `${user.id}/branding/logo.png`

  const { error: uploadError } = await supabase.storage
    .from('datasets')
    .upload(path, logo, { upsert: true })

  if (uploadError) {
    return { error: uploadError.message }
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ logo_storage_path: path })
    .eq('id', user.id)

  if (updateError) {
    return { error: updateError.message }
  }

  return { success: true }
}

export async function saveBrandColor(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const brand_color = formData.get('brand_color') as string

  if (!brand_color || !/^#[0-9A-Fa-f]{6}$/.test(brand_color)) {
    return { error: 'Invalid hex colour format' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ brand_color })
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function getBrandingSettings() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { logoUrl: null, brandColor: '#14B8A6' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('logo_storage_path, brand_color')
    .eq('id', user.id)
    .single()

  let logoUrl: string | null = null

  if (profile?.logo_storage_path) {
    const { data: signedData } = await supabase.storage
      .from('datasets')
      .createSignedUrl(profile.logo_storage_path, 300)

    if (signedData?.signedUrl) {
      logoUrl = signedData.signedUrl
    }
  }

  return {
    logoUrl,
    brandColor: profile?.brand_color ?? '#14B8A6',
  }
}
