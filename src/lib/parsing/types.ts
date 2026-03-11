export type SurveyColumnType =
  | 'kp'
  | 'easting'
  | 'northing'
  | 'depth'
  | 'dob'
  | 'doc'
  | 'top'
  | 'elevation'
  | 'event'
  | 'description'
  | 'date'
  | 'time'
  | 'latitude'
  | 'longitude'

export interface DetectedColumn {
  index: number
  originalName: string
  detectedType: SurveyColumnType | null
  confidence: 'high' | 'medium' | 'low'
}

export interface ColumnMapping {
  index: number
  originalName: string
  mappedType: SurveyColumnType | null
  ignored: boolean
}

export interface ParsedFileData {
  rows: string[][]
  errors: Array<{ message: string; row?: number }>
  meta: {
    delimiter: string
    linebreak: string
    truncated: boolean
  }
  warnings: ParseWarning[]
}

export interface ExcelParseResult {
  rows: string[][]
  sheetNames: string[]
  activeSheet: string
}

export interface ParseWarning {
  type:
    | 'bom_removed'
    | 'encoding_error'
    | 'empty_rows_skipped'
    | 'metadata_rows_skipped'
  message: string
  count?: number
}
