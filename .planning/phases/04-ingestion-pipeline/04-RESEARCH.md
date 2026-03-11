# Phase 4: Ingestion Pipeline - Research

**Researched:** 2026-03-11
**Domain:** CSV/Excel parsing, column type auto-detection, mapping UI
**Confidence:** HIGH

## Summary

Phase 4 builds the ingestion pipeline: parsing uploaded CSV/Excel files, auto-detecting survey column types (KP, DOB, DOC, easting, northing, etc.), presenting a mapping interface for user confirmation, and handling messy real-world data (BOM, encodings, metadata rows). All parsing runs in Next.js API routes using Papa Parse (CSV) and SheetJS (Excel) -- no FastAPI backend needed for this phase.

The main technical challenges are: (1) robust header row detection in files with metadata preambles, (2) column type heuristics that leverage both column names and data patterns, (3) survey-type-aware detection based on the job's survey_type field, and (4) a database schema to persist column mappings. The existing codebase provides strong foundations -- the Dataset type, file list component, and job detail page are all ready for extension.

**Primary recommendation:** Use Papa Parse 5.x for CSV with `skipEmptyLines: 'greedy'` and SheetJS (from CDN tgz) for Excel. Build column detection as a pure function with name-matching + data-sampling heuristics, returning confidence scores. Store mappings in a new `column_mappings` JSONB column on the datasets table.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Table layout with dropdown selectors per column for mapping interface
- Each row shows: original column name, auto-detected type (dropdown), confidence badge (High/Medium/Low)
- Unrecognized columns shown inline with 'Unmapped' badge and dropdown to assign type or mark 'Ignore'
- Survey-type-aware detection: if job is 'DOB', system expects KP + depth columns and warns if missing
- Expected column types informed by survey type already stored on job
- Preview table below mapping table, shows first 50 rows
- Column headers show both original name and mapped type as badge
- Mapped columns displayed first, unmapped/ignored pushed to end
- Horizontal scroll for many columns
- Parsing in Next.js API routes using JS libraries (Papa Parse, SheetJS) -- no FastAPI
- Auto-detect data start row with user override
- Auto-parse after upload with loading state
- Warning banner for parsing issues (yellow, auto-fix, expandable details)
- Explicit "Confirm Mappings" button saves to DB, sets status to 'mapped'
- "Edit Mappings" button to reopen after confirmation
- File detail page at /projects/[projectId]/jobs/[jobId]/files/[fileId]
- File list shows status badges: Uploaded -> Parsed -> Mapped
- Clicking unmapped file navigates to mapping page

### Claude's Discretion
- Papa Parse vs SheetJS library choices and configuration
- Column detection algorithm and heuristics
- Database schema for storing column mappings and parsed metadata
- API route structure for parsing endpoints
- Loading states and skeleton design during parsing
- Exact confidence scoring algorithm
- Header row detection heuristics
- Error handling for completely unparseable files

### Deferred Ideas (OUT OF SCOPE)
None

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FILE-02 | System auto-detects column types (KP, DOB, DOC, TOP, easting, northing, etc.) | Column detection heuristics section covers name-matching and data-sampling algorithms with survey-type awareness |
| FILE-03 | User can manually map/override column assignments via mapping interface | Mapping UI architecture using existing Table, Select, Badge components; server action for persistence |
| FILE-04 | User can preview uploaded dataset before processing to confirm column mappings | Preview table pattern with first 50 rows, column reordering (mapped first), horizontal scroll |
| PROC-03 | Processing handles messy real-world data (mixed encodings, BOM chars, metadata rows) | Papa Parse BOM handling, encoding detection, header row detection heuristics, warning banner pattern |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| papaparse | ^5.4 | CSV parsing | De facto standard for browser/Node CSV parsing, handles BOM, streaming, malformed input |
| xlsx (SheetJS CE) | 0.20.3 | Excel (.xls, .xlsx) parsing | Only serious Excel parser for JS, handles both legacy and modern formats |
| @types/papaparse | ^5.3 | TypeScript types for Papa Parse | Type safety for parse config and results |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (existing) react-dropzone | ^15.0 | File upload trigger | Already installed, triggers auto-parse flow |
| (existing) sonner | ^2.0 | Toast notifications | Parse success/error feedback |
| (existing) @base-ui/react | ^1.2 | Select dropdowns | Column type assignment dropdowns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Papa Parse | csv-parse/csv-parser | Papa Parse has better browser support and BOM handling |
| SheetJS CE | exceljs | ExcelJS is heavier, SheetJS is faster for read-only parsing |
| JSONB column | Separate mappings table | JSONB simpler for this use case, separate table only needed if querying mappings independently |

**Installation:**
```bash
npm install papaparse @types/papaparse
npm install --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

Note: SheetJS must be installed from CDN -- the npm registry `xlsx` package is stale at 0.18.5 and has known vulnerabilities.

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    (dashboard)/
      projects/[projectId]/jobs/[jobId]/files/[fileId]/
        page.tsx                    # File detail page (server component)
    api/
      parse/
        route.ts                    # POST: parse uploaded file, return columns + preview
  components/
    files/
      column-mapping-table.tsx      # Mapping interface (client component)
      data-preview-table.tsx        # Preview table (client component)
      file-detail-view.tsx          # Orchestrator for mapping + preview (client component)
      parsing-warning-banner.tsx    # Yellow banner for parse issues
  lib/
    parsing/
      csv-parser.ts                 # Papa Parse wrapper with config
      excel-parser.ts               # SheetJS wrapper
      column-detector.ts            # Column type detection heuristics
      header-detector.ts            # Header row detection
      types.ts                      # ParseResult, ColumnMapping, DetectedColumn types
    actions/
      files.ts                      # Extended: updateDatasetStatus, saveColumnMappings
```

### Pattern 1: Parse API Route
**What:** A Next.js API route that downloads the file from Supabase Storage, parses it, detects columns, and returns structured data.
**When to use:** After file upload completes -- FileUploadZone triggers auto-parse.
**Example:**
```typescript
// src/app/api/parse/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCSV } from '@/lib/parsing/csv-parser'
import { parseExcel } from '@/lib/parsing/excel-parser'
import { detectColumns } from '@/lib/parsing/column-detector'
import { detectHeaderRow } from '@/lib/parsing/header-detector'

export async function POST(req: NextRequest) {
  const { datasetId } = await req.json()
  const supabase = await createClient()

  // Auth + ownership check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch dataset record
  const { data: dataset } = await supabase
    .from('datasets')
    .select('*')
    .eq('id', datasetId)
    .eq('user_id', user.id)
    .single()

  if (!dataset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Download file from storage
  const { data: fileData } = await supabase.storage
    .from('datasets')
    .download(dataset.storage_path)

  // Parse based on MIME type
  const isExcel = dataset.mime_type.includes('excel') || dataset.mime_type.includes('spreadsheet')
  const rawData = isExcel
    ? await parseExcel(fileData)
    : await parseCSV(await fileData.text())

  // Detect header row, then columns
  const headerRow = detectHeaderRow(rawData)
  const columns = detectColumns(rawData, headerRow, surveyType)
  const preview = rawData.slice(headerRow + 1, headerRow + 51)

  // Update dataset status to 'parsed'
  await supabase.from('datasets').update({ status: 'parsed' }).eq('id', datasetId)

  return NextResponse.json({ columns, preview, headerRow, totalRows: rawData.length })
}
```

### Pattern 2: Column Detection as Pure Function
**What:** A testable pure function that takes raw data rows + survey type and returns detected column types with confidence scores.
**When to use:** Called by the parse API route.
**Example:**
```typescript
// src/lib/parsing/column-detector.ts
export interface DetectedColumn {
  index: number
  originalName: string
  detectedType: SurveyColumnType | null
  confidence: 'high' | 'medium' | 'low'
}

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

export function detectColumns(
  rows: string[][],
  headerRowIndex: number,
  surveyType: SurveyType
): DetectedColumn[] {
  const headers = rows[headerRowIndex]
  const dataRows = rows.slice(headerRowIndex + 1, headerRowIndex + 101)

  return headers.map((header, index) => {
    const nameMatch = matchByName(header)
    const dataMatch = matchByData(dataRows.map(r => r[index]))

    // Combine name + data evidence
    return {
      index,
      originalName: header,
      detectedType: nameMatch.type ?? dataMatch.type,
      confidence: calculateConfidence(nameMatch, dataMatch, surveyType),
    }
  })
}
```

### Pattern 3: Header Row Detection
**What:** Scan first N rows to find the actual header row, skipping metadata preambles.
**When to use:** Before column detection -- real survey files often have metadata rows above headers.
**Example:**
```typescript
// src/lib/parsing/header-detector.ts
export function detectHeaderRow(rows: string[][]): number {
  // Heuristics:
  // 1. Skip rows where most cells are empty
  // 2. Skip rows that look like metadata (single cell with text, key:value pairs)
  // 3. First row where:
  //    - Most cells have text content (not numbers)
  //    - Cell count matches subsequent rows
  //    - No cell looks like a pure number
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i]
    if (isLikelyHeaderRow(row, rows.slice(i + 1, i + 5))) {
      return i
    }
  }
  return 0 // Default to first row
}
```

### Anti-Patterns to Avoid
- **Parsing on the client side:** Files can be 50MB. Parse server-side via API route to avoid browser memory issues and keep raw file data off the client.
- **Storing parsed data in the database:** Only store column mappings and metadata, not the full parsed dataset. Re-parse from storage when needed for processing (Phase 7).
- **Hardcoding column names:** Use flexible name matching with normalization (lowercase, strip whitespace/underscores). Survey companies use inconsistent naming conventions.
- **Blocking the upload flow:** Parse asynchronously after upload. Show a loading skeleton, not a blocking spinner.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom delimiter/quote handling | Papa Parse | Edge cases: escaped quotes, embedded newlines, mixed line endings, BOM |
| Excel parsing | Custom binary format parser | SheetJS | .xls is a complex binary format; .xlsx is zipped XML. Both have decades of edge cases |
| BOM stripping | Manual byte inspection | Papa Parse `skipEmptyLines: 'greedy'` | Papa Parse handles UTF-8 BOM natively since v5 |
| File encoding detection | chardet/iconv equivalent | Papa Parse encoding config | Papa Parse handles common encodings; survey data is virtually always UTF-8 or Latin-1 |

**Key insight:** CSV and Excel parsing look simple but have hundreds of edge cases. Papa Parse and SheetJS exist specifically because hand-rolling parsers produces fragile code.

## Common Pitfalls

### Pitfall 1: SheetJS npm Registry Is Stale
**What goes wrong:** Installing `npm install xlsx` gives v0.18.5 (2022) with known vulnerabilities.
**Why it happens:** SheetJS moved distribution to their own CDN.
**How to avoid:** Install from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
**Warning signs:** Version shown as 0.18.5 in package.json.

### Pitfall 2: Papa Parse BOM Handling
**What goes wrong:** First column header gets wrapped in quotes or has invisible characters when file has UTF-8 BOM.
**Why it happens:** BOM bytes (EF BB BF) appear at start of file, get included in first field.
**How to avoid:** Papa Parse v5+ handles this, but verify by checking `results.data[0]` keys don't start with `\ufeff`. Strip BOM explicitly if needed: `text.replace(/^\ufeff/, '')`.
**Warning signs:** First column name doesn't match expected value despite looking correct visually.

### Pitfall 3: Excel Multi-Sheet Files
**What goes wrong:** Parsing only reads first sheet, missing data on other sheets.
**Why it happens:** SheetJS defaults to all sheets but code often accesses only `workbook.SheetNames[0]`.
**How to avoid:** Parse all sheets, let user select which sheet to map. For MVP, default to first sheet but show sheet selector if multiple exist.
**Warning signs:** User reports "missing data" when file has multiple sheets.

### Pitfall 4: Header Row Misdetection
**What goes wrong:** Metadata rows (company name, report date, file info) get treated as data headers.
**Why it happens:** First non-empty row assumption fails for survey files with metadata preambles.
**How to avoid:** Implement header row detection heuristic + expose "start row" control to user for manual override.
**Warning signs:** Column names show as dates, company names, or other metadata.

### Pitfall 5: Large File Memory on API Route
**What goes wrong:** 50MB Excel file parsed in API route causes memory pressure or timeout.
**Why it happens:** SheetJS loads entire workbook into memory; Vercel serverless functions have limited memory.
**How to avoid:** For CSV, use Papa Parse streaming. For Excel, accept the memory cost but set appropriate Vercel function memory limits (1GB should handle 50MB files). Consider adding file size warnings for very large files.
**Warning signs:** API route timeouts or 502 errors on large files.

### Pitfall 6: Dataset Status Race Condition
**What goes wrong:** User navigates away during parsing, then status never updates from 'parsing' to 'parsed' or 'error'.
**Why it happens:** API route response isn't received.
**How to avoid:** Use a try/catch/finally pattern in the API route to always update status. Client polls or uses revalidation on mount.
**Warning signs:** Files stuck in 'parsing' status indefinitely.

## Code Examples

### CSV Parsing with Papa Parse
```typescript
// src/lib/parsing/csv-parser.ts
import Papa from 'papaparse'

export interface ParsedFileData {
  rows: string[][]
  errors: Papa.ParseError[]
  meta: { delimiter: string; linebreak: string; truncated: boolean }
}

export function parseCSV(text: string): ParsedFileData {
  // Strip BOM if present
  const cleanText = text.replace(/^\ufeff/, '')

  const result = Papa.parse<string[]>(cleanText, {
    header: false,           // Return arrays, not objects -- we detect headers ourselves
    skipEmptyLines: 'greedy', // Skip blank lines and whitespace-only lines
    dynamicTyping: false,    // Keep everything as strings for detection
    transformHeader: undefined,
  })

  return {
    rows: result.data,
    errors: result.errors,
    meta: result.meta,
  }
}
```

### Excel Parsing with SheetJS
```typescript
// src/lib/parsing/excel-parser.ts
import * as XLSX from 'xlsx'

export interface ExcelParseResult {
  rows: string[][]
  sheetNames: string[]
  activeSheet: string
}

export function parseExcel(buffer: ArrayBuffer, sheetName?: string): ExcelParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const targetSheet = sheetName ?? workbook.SheetNames[0]
  const worksheet = workbook.Sheets[targetSheet]

  // Convert to array of arrays (all as strings)
  const rows: string[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,      // Return arrays, not objects
    raw: false,      // Convert all values to strings
    defval: '',      // Empty string for empty cells
  })

  return {
    rows,
    sheetNames: workbook.SheetNames,
    activeSheet: targetSheet,
  }
}
```

### Column Name Matching Heuristics
```typescript
// src/lib/parsing/column-detector.ts (name matching portion)
const NAME_PATTERNS: Record<SurveyColumnType, RegExp[]> = {
  kp: [/^kp$/i, /^chainage$/i, /^km\s*post$/i, /^kilomet/i, /^station/i, /^dist/i],
  easting: [/^east/i, /^e$/i, /^x$/i, /^xcoord/i, /^coord.*x/i],
  northing: [/^north/i, /^n$/i, /^y$/i, /^ycoord/i, /^coord.*y/i],
  depth: [/^depth$/i, /^dep$/i, /^z$/i],
  dob: [/^dob$/i, /depth.*burial/i, /burial.*depth/i],
  doc: [/^doc$/i, /depth.*cover/i, /cover.*depth/i],
  top: [/^top$/i, /top.*pipe/i, /pipe.*top/i, /^toc$/i, /top.*cable/i],
  elevation: [/^elev/i, /^height$/i, /^alt/i],
  latitude: [/^lat/i],
  longitude: [/^lon/i, /^lng$/i],
  event: [/^event/i, /^feature/i, /^anomaly/i],
  description: [/^desc/i, /^comment/i, /^notes?$/i, /^remark/i],
  date: [/^date$/i, /^survey.*date/i, /^timestamp/i],
  time: [/^time$/i, /^survey.*time/i],
}

function matchByName(header: string): { type: SurveyColumnType | null; score: number } {
  const normalized = header.trim().replace(/[_\-\s]+/g, ' ')
  for (const [type, patterns] of Object.entries(NAME_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return { type: type as SurveyColumnType, score: 0.8 }
      }
    }
  }
  return { type: null, score: 0 }
}
```

### Database Schema Extension
```sql
-- Migration 00005_column_mappings.sql

-- Add parsed metadata columns to datasets table
ALTER TABLE public.datasets
  ADD COLUMN parsed_metadata JSONB,
  ADD COLUMN column_mappings JSONB,
  ADD COLUMN header_row_index INTEGER DEFAULT 0,
  ADD COLUMN total_rows INTEGER,
  ADD COLUMN parse_warnings TEXT[];

-- parsed_metadata shape:
-- {
--   "delimiter": ",",
--   "encoding": "utf-8",
--   "sheetName": "Sheet1",        -- Excel only
--   "sheetNames": ["Sheet1"],     -- Excel only
--   "originalColumnCount": 12,
--   "detectedStartRow": 3
-- }

-- column_mappings shape:
-- [
--   {
--     "index": 0,
--     "originalName": "KP",
--     "mappedType": "kp",
--     "confidence": "high",
--     "ignored": false
--   },
--   ...
-- ]

-- Update status CHECK (informational, not enforced via constraint to keep flexible)
-- Valid statuses: 'uploaded', 'parsing', 'parsed', 'mapped', 'error'
```

### Survey-Type-Aware Expected Columns
```typescript
// src/lib/parsing/column-detector.ts (survey type expectations)
const EXPECTED_COLUMNS: Record<SurveyType, SurveyColumnType[]> = {
  'DOB': ['kp', 'dob', 'easting', 'northing'],
  'DOC': ['kp', 'doc', 'easting', 'northing'],
  'TOP': ['kp', 'top', 'easting', 'northing'],
  'Event Listing': ['kp', 'event', 'description'],
  'Pipeline Position': ['kp', 'easting', 'northing', 'elevation'],
  'ROVV': ['kp', 'easting', 'northing', 'depth'],
}

export function getMissingExpectedColumns(
  detected: DetectedColumn[],
  surveyType: SurveyType
): SurveyColumnType[] {
  const expected = EXPECTED_COLUMNS[surveyType] ?? []
  const mappedTypes = new Set(detected.filter(d => d.detectedType).map(d => d.detectedType))
  return expected.filter(type => !mappedTypes.has(type))
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npm install xlsx` | Install from SheetJS CDN tgz | 2023 | npm registry stuck at 0.18.5; CDN has 0.20.3 |
| Papa Parse callback style | Papa Parse sync parse (small files) | Always available | For in-memory strings, sync `Papa.parse()` is simpler than streaming |
| Separate column_mappings table | JSONB column on datasets | Current recommendation | Simpler queries, atomic updates with dataset status |

## Open Questions

1. **Sheet Selection for Multi-Sheet Excel Files**
   - What we know: SheetJS can parse all sheets; we default to first sheet
   - What's unclear: Should we show a sheet selector before column mapping, or just default and let user switch?
   - Recommendation: Default to first sheet, show sheet tabs if multiple sheets exist. Low priority -- most survey data files are single-sheet.

2. **50MB File Parsing Performance on Vercel**
   - What we know: Vercel serverless functions default to 1GB memory, 10s timeout (configurable to 60s on Pro)
   - What's unclear: Whether 50MB Excel files parse within timeout on free tier
   - Recommendation: Test with representative files. If timeout is an issue, add `maxDuration` export to API route. Consider showing file size warning above 20MB.

3. **Encoding Detection Beyond UTF-8**
   - What we know: Papa Parse handles UTF-8 (with/without BOM). Survey data is overwhelmingly UTF-8 or Latin-1.
   - What's unclear: How common are other encodings in pipeline survey data?
   - Recommendation: Parse as UTF-8 first, fall back to Latin-1 if error. Flag in warning banner.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x with jsdom |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILE-02 | Column auto-detection by name patterns | unit | `npx vitest run tests/parsing/column-detector.test.ts -t "name matching"` | No - Wave 0 |
| FILE-02 | Column auto-detection by data sampling | unit | `npx vitest run tests/parsing/column-detector.test.ts -t "data sampling"` | No - Wave 0 |
| FILE-02 | Survey-type-aware expected columns | unit | `npx vitest run tests/parsing/column-detector.test.ts -t "survey type"` | No - Wave 0 |
| FILE-03 | Save column mappings server action | unit | `npx vitest run tests/actions/files.test.ts -t "save mappings"` | Partial - file exists, needs new tests |
| FILE-04 | Preview returns first 50 rows | unit | `npx vitest run tests/parsing/csv-parser.test.ts -t "preview"` | No - Wave 0 |
| PROC-03 | CSV parsing with BOM handling | unit | `npx vitest run tests/parsing/csv-parser.test.ts -t "BOM"` | No - Wave 0 |
| PROC-03 | Header row detection in messy files | unit | `npx vitest run tests/parsing/header-detector.test.ts` | No - Wave 0 |
| PROC-03 | Excel parsing basic | unit | `npx vitest run tests/parsing/excel-parser.test.ts` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/parsing/column-detector.test.ts` -- covers FILE-02 (name matching, data sampling, survey type awareness)
- [ ] `tests/parsing/csv-parser.test.ts` -- covers PROC-03, FILE-04 (BOM, encoding, preview rows)
- [ ] `tests/parsing/excel-parser.test.ts` -- covers PROC-03 (Excel parsing, multi-sheet)
- [ ] `tests/parsing/header-detector.test.ts` -- covers PROC-03 (metadata row skipping)
- [ ] `tests/fixtures/` -- sample CSV/Excel files for testing (with BOM, metadata rows, various encodings)

## Sources

### Primary (HIGH confidence)
- [Papa Parse official docs](https://www.papaparse.com/docs) - configuration options, BOM handling, parse API
- [Papa Parse npm](https://www.npmjs.com/package/papaparse) - version info, maintained status
- [SheetJS official docs](https://docs.sheetjs.com/docs/api/parse-options/) - read options, sheet_to_json API
- [SheetJS CDN](https://cdn.sheetjs.com/) - current version 0.20.3, installation method
- Existing codebase: `src/lib/types/files.ts`, `src/lib/actions/files.ts`, `supabase/migrations/00003_datasets.sql`

### Secondary (MEDIUM confidence)
- [GDAL CSV docs](https://gdal.org/en/stable/drivers/vector/csv.html) - common column naming conventions for geospatial data
- [Papa Parse GitHub issues #840](https://github.com/mholt/PapaParse/issues/840) - BOM handling specifics

### Tertiary (LOW confidence)
- SheetJS `@e965/xlsx` alternative package mentioned in web search -- could not verify, sticking with official CDN installation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Papa Parse and SheetJS are well-established, verified via npm and official docs
- Architecture: HIGH - follows existing project patterns (server components, API routes, Supabase), extends established Dataset type
- Pitfalls: HIGH - BOM handling, SheetJS npm staleness, and header detection are well-documented issues
- Column detection heuristics: MEDIUM - name-matching patterns based on GIS/survey conventions, but real-world survey file naming varies significantly

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable libraries, unlikely to change)
