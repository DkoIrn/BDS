# Phase 9: Reports & Export - Research

**Researched:** 2026-03-15
**Domain:** PDF report generation, data export (CSV/Excel), FastAPI file streaming
**Confidence:** HIGH

## Summary

Phase 9 adds two export capabilities: (1) downloadable PDF QC reports with summary, methodology, issue table, and pass/fail status, and (2) cleaned/annotated dataset export as CSV or Excel with flagged issues marked. The project already has FastAPI on Railway (Docker) for heavy processing, so PDF generation belongs in FastAPI. The frontend needs download buttons wired to new API endpoints.

The key technical decision is PDF library choice. WeasyPrint is the most capable (HTML/CSS to PDF) but requires system-level dependencies (libpango, libgobject, libcairo) that bloat the Docker image and have documented issues on Railway. Given the report structure is a structured QC document (not a complex web page), **fpdf2** is the recommended choice -- it is pure Python, zero system dependencies, has built-in table support with styling, and handles the QC report format perfectly. For dataset export, pandas already exists in the backend and can write CSV directly; openpyxl adds styled Excel export with cell highlighting for flagged issues.

**Primary recommendation:** Use fpdf2 for PDF generation (pure Python, no Docker changes needed) and openpyxl for styled Excel export with flagged-row highlighting. Both endpoints live in FastAPI. Next.js API routes proxy with auth/ownership checks, returning signed URLs or streaming responses.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-04 | User can download formatted QC report as PDF | fpdf2 generates PDF in FastAPI; Next.js API route proxies with auth check |
| DASH-05 | QC report includes summary, methodology, issue table, and pass/fail status | fpdf2 table support handles issue tables; document structure defined in report builder service |
| FILE-05 | User can download cleaned/annotated dataset as CSV or Excel | pandas to_csv for CSV; openpyxl for styled Excel with flagged rows highlighted |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fpdf2 | >=2.8 | PDF report generation | Pure Python, zero system deps, built-in tables, active development |
| openpyxl | >=3.1 | Excel export with styling | De facto Python Excel library, cell-level formatting, conditional fills |
| pandas | >=2.2 (already installed) | CSV export, DataFrame operations | Already in backend requirements |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| httpx | >=0.28 (already installed) | Supabase client calls | Already used for all backend-to-Supabase communication |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fpdf2 | WeasyPrint | Better CSS support but requires libpango, libcairo, libgobject system deps; documented Railway deployment issues (gobject-2.0-0 loading errors); bloats Docker image ~200MB+ |
| fpdf2 | ReportLab | More powerful for complex layouts but heavier API, commercial features gated behind paid license |
| openpyxl | xlsxwriter | Write-only (no read), slightly faster for large files but openpyxl is more flexible and well-known |

**Installation (backend only):**
```bash
pip install fpdf2>=2.8 openpyxl>=3.1
```

Add to `backend/requirements.txt`:
```
fpdf2>=2.8
openpyxl>=3.1
```

**No Dockerfile changes needed** -- both are pure Python packages.

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── app/
│   ├── routers/
│   │   ├── validation.py       # existing
│   │   └── reports.py          # NEW: /api/v1/report/pdf, /api/v1/export/dataset
│   ├── services/
│   │   ├── validation.py       # existing
│   │   ├── report_builder.py   # NEW: builds PDF document structure
│   │   └── dataset_export.py   # NEW: annotates + exports CSV/Excel
│   └── ...
src/
├── lib/
│   ├── actions/
│   │   └── reports.ts          # NEW: server actions for download URLs
│   └── ...
├── components/
│   └── files/
│       ├── results-dashboard.tsx    # existing -- add download buttons
│       └── export-buttons.tsx       # NEW: PDF + CSV/Excel download UI
└── app/
    └── api/
        └── reports/
            ├── pdf/route.ts         # NEW: proxy to FastAPI PDF endpoint
            └── export/route.ts      # NEW: proxy to FastAPI export endpoint
```

### Pattern 1: FastAPI Report Generation Endpoint
**What:** FastAPI generates PDF/Excel in memory, returns as streaming response
**When to use:** All report/export downloads
**Example:**
```python
# Source: fpdf2 official docs + FastAPI StreamingResponse pattern
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from fpdf import FPDF
import io

@router.get("/api/v1/report/pdf/{run_id}")
def generate_pdf_report(run_id: str):
    # Fetch run + issues from Supabase
    # Build PDF
    pdf = FPDF()
    pdf.add_page()
    # ... build report
    buffer = io.BytesIO(pdf.output())
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=qc-report-{run_id[:8]}.pdf"}
    )
```

### Pattern 2: Next.js API Route Proxy with Auth
**What:** Next.js API route verifies auth + ownership, then proxies to FastAPI
**When to use:** All report/export downloads (same pattern as validation proxy)
**Example:**
```typescript
// Source: existing validation proxy pattern in project
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership of run/dataset
  // Proxy to FastAPI
  const response = await fetch(`${FASTAPI_URL}/api/v1/report/pdf/${runId}`)
  // Stream response back to client
}
```

### Pattern 3: Annotated Dataset Export
**What:** Download original dataset file, merge flagged issues as extra columns or cell highlights
**When to use:** FILE-05 cleaned/annotated dataset export
**Example:**
```python
# CSV: Add _qc_flag and _qc_message columns
# Excel: Add columns + highlight flagged rows with red/yellow fill
import openpyxl
from openpyxl.styles import PatternFill

red_fill = PatternFill(start_color="FFCCCC", end_color="FFCCCC", fill_type="solid")
yellow_fill = PatternFill(start_color="FFFFCC", end_color="FFFFCC", fill_type="solid")

# For each flagged row, apply fill to the entire row
for issue in issues:
    fill = red_fill if issue.severity == "critical" else yellow_fill
    for col in range(1, ws.max_column + 1):
        ws.cell(row=issue.row_number + 1, column=col).fill = fill
```

### Anti-Patterns to Avoid
- **Generating PDF in Next.js/Vercel:** Vercel serverless functions have 10-second timeout (hobby) and limited memory. PDF generation can be slow for large issue sets. Keep in FastAPI.
- **Storing generated PDFs permanently:** Reports should be generated on-demand from current data, not cached. Avoids stale reports and storage costs.
- **Client-side PDF generation (jsPDF):** Loses access to server-side data, creates large client bundles, inconsistent rendering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF tables with pagination | Custom page-break logic | fpdf2 `pdf.table()` with `first_row_as_headings=True` | Handles multi-page tables, header repetition, cell wrapping |
| Excel cell styling | Manual cell-by-cell formatting | openpyxl named styles + PatternFill | Consistent styling, conditional formatting support |
| File streaming from FastAPI | Custom chunked response | `StreamingResponse` with `BytesIO` | Built-in FastAPI pattern, handles headers correctly |
| Auth proxy for downloads | Custom fetch logic | Same pattern as existing `/api/datasets/validate/route.ts` | Already proven in project, consistent auth pattern |

**Key insight:** Report generation is a solved problem. fpdf2's table API and openpyxl's styling API handle 95% of the work. The custom code is assembling the report structure (sections, content) not the rendering.

## Common Pitfalls

### Pitfall 1: Large Issue Sets Causing Memory Spikes
**What goes wrong:** A dataset with thousands of issues generates a huge PDF, exhausting memory
**Why it happens:** All issues loaded into memory at once, PDF built entirely in-memory
**How to avoid:** Paginate issues in the PDF (fpdf2 handles page breaks automatically). For very large sets, consider limiting to top N issues per severity with a note about truncation.
**Warning signs:** PDF generation taking >10 seconds, Railway memory alerts

### Pitfall 2: Missing Font Support in fpdf2
**What goes wrong:** Default fpdf2 fonts are limited (Helvetica, Times, Courier). Special characters may not render.
**Why it happens:** fpdf2 uses built-in PDF core fonts by default
**How to avoid:** Use built-in fonts (Helvetica works fine for QC reports). If Unicode support is needed later, add a TTF font via `pdf.add_font()`.
**Warning signs:** Characters rendering as squares or question marks

### Pitfall 3: Excel Row Number Off-by-One
**What goes wrong:** Flagged row highlights are shifted by one row in Excel export
**Why it happens:** validation_issues.row_number is 1-based (data rows after header), openpyxl rows are 1-based with row 1 being the header
**How to avoid:** Map issue.row_number to Excel row as `issue.row_number + 1` (accounting for header row)
**Warning signs:** Highlighted rows don't match actual flagged data

### Pitfall 4: Download Button UX
**What goes wrong:** User clicks download, nothing visible happens for seconds
**Why it happens:** PDF generation takes time, no loading indicator
**How to avoid:** Show loading spinner on button, use fetch + blob download pattern (not window.open which can be blocked by popup blockers)
**Warning signs:** Users clicking multiple times, popup blocker warnings

### Pitfall 5: CORS on File Downloads
**What goes wrong:** Direct fetch to FastAPI from browser fails with CORS
**Why it happens:** Bypassing the Next.js proxy
**How to avoid:** Always route through Next.js API routes (same pattern as validation). Never expose FastAPI URL to client.
**Warning signs:** CORS errors in browser console

## Code Examples

### QC Report PDF Structure
```python
# Source: fpdf2 docs (py-pdf.github.io/fpdf2/Tables.html)
from fpdf import FPDF

class QCReport(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 16)
        self.cell(0, 10, "QC Validation Report", new_x="LMARGIN", new_y="NEXT", align="C")
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def summary_section(self, run, dataset_name):
        self.set_font("Helvetica", "B", 14)
        self.cell(0, 10, "Summary", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 11)
        verdict = "PASS" if run["critical_count"] == 0 else "FAIL"
        # Summary table with key metrics
        with self.table(col_widths=(40, 60)) as table:
            for label, value in [
                ("Dataset", dataset_name),
                ("Overall Verdict", verdict),
                ("Total Issues", str(run["total_issues"])),
                ("Critical", str(run["critical_count"])),
                ("Warnings", str(run["warning_count"])),
                ("Info", str(run["info_count"])),
                ("Pass Rate", f"{run['pass_rate']:.1f}%"),
                ("Run Date", run["run_at"][:10]),
            ]:
                row = table.row()
                row.cell(label)
                row.cell(value)

    def methodology_section(self, config_snapshot):
        self.set_font("Helvetica", "B", 14)
        self.cell(0, 10, "Methodology", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 10)
        self.multi_cell(0, 6, (
            "This report was generated by SurveyQC AI automated validation. "
            "The following checks were performed: range validation, missing data detection, "
            "duplicate detection, statistical outlier analysis (z-score and IQR), "
            "KP gap analysis, and monotonicity verification."
        ))

    def issues_table(self, issues):
        self.set_font("Helvetica", "B", 14)
        self.cell(0, 10, "Flagged Issues", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 8)
        with self.table(
            col_widths=(8, 12, 12, 12, 56),
            first_row_as_headings=True,
        ) as table:
            # Header
            header = table.row()
            for h in ["Row", "Column", "Severity", "Rule", "Description"]:
                header.cell(h)
            # Data rows
            for issue in issues:
                row = table.row()
                row.cell(str(issue["row_number"]))
                row.cell(issue["column_name"])
                row.cell(issue["severity"].upper())
                row.cell(issue["rule_type"])
                row.cell(issue["message"])
```

### CSV Export with Annotations
```python
import pandas as pd
import io

def export_annotated_csv(df, issues, column_mappings):
    """Add QC flag columns to the original DataFrame and export as CSV."""
    # Create a flag lookup: row_number -> list of issues
    flag_map = {}
    for issue in issues:
        row = issue["row_number"] - 1  # Convert to 0-based index
        if row not in flag_map:
            flag_map[row] = []
        flag_map[row].append(issue)

    # Add annotation columns
    df["_qc_flag"] = ""
    df["_qc_severity"] = ""
    df["_qc_messages"] = ""

    for row_idx, row_issues in flag_map.items():
        if row_idx < len(df):
            worst_severity = min(row_issues, key=lambda i: {"critical": 0, "warning": 1, "info": 2}[i["severity"]])
            df.at[row_idx, "_qc_flag"] = "FLAGGED"
            df.at[row_idx, "_qc_severity"] = worst_severity["severity"]
            df.at[row_idx, "_qc_messages"] = " | ".join(i["message"] for i in row_issues)

    buffer = io.BytesIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)
    return buffer
```

### Download Button Component Pattern
```typescript
// Client-side download using fetch + blob
async function handleDownload(type: 'pdf' | 'csv' | 'xlsx') {
  setDownloading(type)
  try {
    const res = await fetch(`/api/reports/${type}?runId=${runId}&datasetId=${datasetId}`)
    if (!res.ok) throw new Error('Download failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qc-report.${type}`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    setDownloading(null)
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WeasyPrint for all PDF | fpdf2 for structured reports, WeasyPrint for complex HTML layouts | 2024-2025 | fpdf2 avoids system dependency hell, works anywhere Python runs |
| wkhtmltopdf | WeasyPrint or fpdf2 | 2023+ | wkhtmltopdf is deprecated/unmaintained |
| ReportLab for everything | fpdf2 for simple/medium, ReportLab for complex | 2024+ | fpdf2 table API makes ReportLab unnecessary for typical reports |
| xlwt for Excel | openpyxl (xlsx only) | 2020+ | xlwt only supports old .xls format |

## Open Questions

1. **Report branding/logo**
   - What we know: Brand colors are defined (Deep Blue #1E3A8A, Teal #14B8A6, Orange #F97316)
   - What's unclear: Whether a logo image should be embedded in the PDF header
   - Recommendation: Use text-only header with brand colors for now. Logo can be added later via `pdf.image()`.

2. **Maximum issue count in PDF**
   - What we know: fpdf2 handles multi-page tables well
   - What's unclear: Performance with 10,000+ issues
   - Recommendation: Cap at 500 issues in PDF with a "X additional issues not shown" note. Full export available in CSV/Excel.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | pytest >=8.0 |
| Framework (frontend) | vitest 4.x with jsdom |
| Config file (backend) | `backend/pytest.ini` or inline |
| Config file (frontend) | `vitest.config.ts` |
| Quick run (backend) | `cd backend && python -m pytest tests/ -x -q` |
| Quick run (frontend) | `npx vitest run --reporter=verbose` |
| Full suite | Both of the above |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-04 | PDF report generated with correct structure | unit (backend) | `cd backend && python -m pytest tests/test_report_builder.py -x` | No - Wave 0 |
| DASH-05 | Report includes summary, methodology, issues, pass/fail | unit (backend) | `cd backend && python -m pytest tests/test_report_builder.py::test_report_sections -x` | No - Wave 0 |
| FILE-05 | Annotated CSV/Excel export with flagged rows | unit (backend) | `cd backend && python -m pytest tests/test_dataset_export.py -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_report_builder.py tests/test_dataset_export.py -x -q`
- **Per wave merge:** Full backend + frontend test suite
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_report_builder.py` -- covers DASH-04, DASH-05 (PDF structure, sections, pass/fail)
- [ ] `backend/tests/test_dataset_export.py` -- covers FILE-05 (CSV annotation, Excel styling)
- [ ] Framework install: `pip install fpdf2>=2.8 openpyxl>=3.1` -- new dependencies

## Sources

### Primary (HIGH confidence)
- [fpdf2 official docs - Tables](https://py-pdf.github.io/fpdf2/Tables.html) - table API, styling, pagination
- [openpyxl official docs - Styles](https://openpyxl.readthedocs.io/en/3.1/styles.html) - cell formatting, PatternFill
- [FastAPI StreamingResponse](https://fastapi.tiangolo.com/advanced/custom-response/) - file download pattern

### Secondary (MEDIUM confidence)
- [WeasyPrint Railway issues](https://github.com/Kozea/WeasyPrint/issues/2221) - gobject-2.0-0 loading errors on Railway
- [WeasyPrint Railway Help Station](https://station.railway.com/questions/weasyprint-dependency-gobject-2-0-0-in-355c0bf6) - documented deployment problems
- [Python PDF comparison 2025](https://templated.io/blog/generate-pdfs-in-python-with-libraries/) - library landscape overview
- [fpdf2 PyPI](https://pypi.org/project/fpdf2/) - version and compatibility info

### Tertiary (LOW confidence)
- None -- all findings verified with official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - fpdf2 and openpyxl are well-documented, pure Python, widely used
- Architecture: HIGH - follows existing proxy pattern from validation phase, no new architectural patterns needed
- Pitfalls: HIGH - Railway/WeasyPrint issues documented in multiple GitHub issues and Railway Help Station

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable libraries, unlikely to change)
