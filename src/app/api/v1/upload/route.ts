import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveApiKey } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/api-rate-limit'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

export async function POST(request: Request) {
  // 1. API key auth
  const apiKey = await resolveApiKey(request)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Invalid or missing API key' },
      { status: 401 }
    )
  }

  // 2. Rate limiting
  const rateLimit = checkRateLimit(apiKey.keyId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'Retry-After': '60',
        },
      }
    )
  }

  // 3. Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: 'Invalid multipart/form-data request' },
      {
        status: 400,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  const file = formData.get('file') as File | null
  const projectId = formData.get('project_id') as string | null
  const jobId = formData.get('job_id') as string | null

  if (!file || !projectId || !jobId) {
    return NextResponse.json(
      { error: 'Missing required fields: file, project_id, job_id' },
      {
        status: 400,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  // 4. File size check
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
      {
        status: 413,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 5. Verify project belongs to the API key's org
  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id, org_id')
    .eq('id', projectId)
    .eq('org_id', apiKey.orgId)
    .single()

  if (projectError || !project) {
    return NextResponse.json(
      { error: 'Project not found or not in your organisation' },
      {
        status: 403,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  // 6. Verify job belongs to the project
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, project_id')
    .eq('id', jobId)
    .eq('project_id', projectId)
    .single()

  if (jobError || !job) {
    return NextResponse.json(
      { error: 'Job not found or does not belong to the specified project' },
      {
        status: 404,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  // 7. Create dataset record first to get the ID
  const { data: dataset, error: insertError } = await supabaseAdmin
    .from('datasets')
    .insert({
      job_id: jobId,
      user_id: apiKey.userId,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      storage_path: '', // placeholder, updated after upload
      status: 'uploaded',
    })
    .select('id')
    .single()

  if (insertError || !dataset) {
    return NextResponse.json(
      { error: 'Failed to create dataset record' },
      {
        status: 500,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  // 8. Upload file to Supabase Storage: {userId}/{datasetId}/{filename}
  const storagePath = `${apiKey.userId}/${dataset.id}/${file.name}`
  const fileBuffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabaseAdmin.storage
    .from('datasets')
    .upload(storagePath, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    // Clean up the dataset record on upload failure
    await supabaseAdmin.from('datasets').delete().eq('id', dataset.id)
    return NextResponse.json(
      { error: 'Failed to upload file to storage' },
      {
        status: 500,
        headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
      }
    )
  }

  // 9. Update dataset with the storage path
  await supabaseAdmin
    .from('datasets')
    .update({ storage_path: storagePath })
    .eq('id', dataset.id)

  return NextResponse.json(
    {
      dataset_id: dataset.id,
      filename: file.name,
      status: 'uploaded',
    },
    {
      status: 201,
      headers: { 'X-RateLimit-Remaining': String(rateLimit.remaining) },
    }
  )
}
