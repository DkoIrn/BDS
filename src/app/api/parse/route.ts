import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCSV } from '@/lib/parsing/csv-parser'
import { parseExcel } from '@/lib/parsing/excel-parser'
import { detectHeaderRow } from '@/lib/parsing/header-detector'
import { detectColumns, getMissingExpectedColumns } from '@/lib/parsing/column-detector'
import type { SurveyType } from '@/lib/types/projects'
import type { ParsedMetadata } from '@/lib/types/files'
import type { ColumnMapping } from '@/lib/parsing/types'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Parse request body
  const body = await request.json() as { datasetId?: string }
  const { datasetId } = body

  if (!datasetId) {
    return NextResponse.json({ error: 'datasetId is required' }, { status: 400 })
  }

  // Fetch dataset with ownership check
  const { data: dataset, error: datasetError } = await supabase
    .from('datasets')
    .select('*')
    .eq('id', datasetId)
    .eq('user_id', user.id)
    .single()

  if (datasetError || !dataset) {
    return NextResponse.json({ error: 'Dataset not found or access denied' }, { status: 404 })
  }

  // Set status to 'parsing' immediately
  await supabase
    .from('datasets')
    .update({ status: 'parsing' })
    .eq('id', datasetId)

  try {
    // Fetch the job to get survey_type
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('survey_type')
      .eq('id', dataset.job_id)
      .single()

    if (jobError || !job) {
      throw new Error('Associated job not found')
    }

    const surveyType = job.survey_type as SurveyType

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('datasets')
      .download(dataset.storage_path)

    if (downloadError || !fileData) {
      throw new Error(`File download failed: ${downloadError?.message ?? 'Unknown error'}`)
    }

    // Parse based on MIME type
    const mimeType = dataset.mime_type as string
    let rows: string[][]
    let parseWarnings: string[] = []
    let parsedMeta: ParsedMetadata

    const isCSV = mimeType === 'text/csv' || (dataset.file_name as string).endsWith('.csv')
    const isExcel =
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      (dataset.file_name as string).endsWith('.xls') ||
      (dataset.file_name as string).endsWith('.xlsx')

    if (isCSV) {
      const text = await fileData.text()
      const result = parseCSV(text)
      rows = result.rows
      parseWarnings = result.warnings.map((w) => w.message)

      parsedMeta = {
        delimiter: result.meta.delimiter,
        originalColumnCount: rows.length > 0 ? rows[0].length : 0,
        detectedStartRow: 0,
      }
    } else if (isExcel) {
      const buffer = await fileData.arrayBuffer()
      const result = parseExcel(buffer)
      rows = result.rows
      parseWarnings = []

      parsedMeta = {
        sheetName: result.activeSheet,
        sheetNames: result.sheetNames,
        originalColumnCount: rows.length > 0 ? rows[0].length : 0,
        detectedStartRow: 0,
      }
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`)
    }

    // Detect header row
    const headerRowIndex = detectHeaderRow(rows)
    parsedMeta.detectedStartRow = headerRowIndex

    // Detect columns
    const detectedColumns = detectColumns(rows, headerRowIndex, surveyType)
    const missingExpected = getMissingExpectedColumns(detectedColumns, surveyType)

    // Compute total data rows (excluding header and any rows before it)
    const totalRows = rows.length - headerRowIndex - 1

    // Compute preview: first 50 data rows after header
    const previewStart = headerRowIndex + 1
    const previewEnd = Math.min(previewStart + 50, rows.length)
    const preview = rows.slice(previewStart, previewEnd)

    // Add missing column warnings
    if (missingExpected.length > 0) {
      parseWarnings.push(
        `Missing expected columns for ${surveyType}: ${missingExpected.join(', ')}`
      )
    }

    // Build initial column mappings from detected columns
    const columnMappings: ColumnMapping[] = detectedColumns.map((col) => ({
      index: col.index,
      originalName: col.originalName,
      mappedType: col.detectedType,
      ignored: false,
    }))

    // Update dataset with parsed data
    await supabase
      .from('datasets')
      .update({
        status: 'parsed',
        header_row_index: headerRowIndex,
        total_rows: totalRows,
        parsed_metadata: parsedMeta,
        column_mappings: columnMappings,
        parse_warnings: parseWarnings.length > 0 ? parseWarnings : null,
      })
      .eq('id', datasetId)

    return NextResponse.json({
      columns: detectedColumns,
      preview,
      headerRow: headerRowIndex,
      totalRows,
      warnings: parseWarnings,
      missingExpected,
      ...(parsedMeta.sheetNames ? { sheetNames: parsedMeta.sheetNames } : {}),
    })
  } catch (err) {
    // Always update status to 'error' to prevent stuck 'parsing' state
    const errorMessage = err instanceof Error ? err.message : 'Parse failed'

    await supabase
      .from('datasets')
      .update({
        status: 'error',
        parse_warnings: [errorMessage],
      })
      .eq('id', datasetId)

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
