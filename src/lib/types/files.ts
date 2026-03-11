/** Status of a dataset record in the database */
export type DatasetStatus = 'uploaded'

/** Client-side state machine for file upload progress */
export type FileUploadStatus = 'queued' | 'uploading' | 'uploaded' | 'failed' | 'cancelled'

/** Dataset record matching the datasets table schema */
export interface Dataset {
  id: string
  job_id: string
  user_id: string
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  status: DatasetStatus
  created_at: string
  updated_at: string
}

/** Client-side file queue item for tracking upload state */
export interface FileUploadItem {
  id: string
  file: File
  status: FileUploadStatus
  progress: number
  error?: string
}

/** MIME type map for react-dropzone accept prop */
export const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}

/** Maximum file size in bytes (50MB) */
export const MAX_FILE_SIZE = 50 * 1024 * 1024
