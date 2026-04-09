# Phase 19: Client-Grade Reports - Research

**Researched:** 2026-04-09
**Domain:** PDF report generation (fpdf2 + matplotlib server-side charts)
**Confidence:** HIGH

## Summary

This phase extends the existing fpdf2 PDF report system with two report modes (Executive and Technical), server-side matplotlib charts embedded as PNG images, and a Statement of Quality section with branded certification stamp. The existing `report_builder.py` already has a well-structured `QCReport(FPDF)` subclass with branded header/footer, section methods, severity color constants, and a `_sanitize()` helper. The extension is straightforward: add a `mode` parameter to control which sections render, generate matplotlib figures to BytesIO buffers, and embed them via `pdf.image()`.

matplotlib is NOT currently in the backend requirements.txt and must be added. fpdf2 v2.8.7 is already installed and fully supports embedding images from BytesIO/PIL.Image objects. The Agg backend for matplotlib is ideal for headless server-side rendering on Railway.

**Primary recommendation:** Add matplotlib to requirements.txt, create a `chart_builder.py` service module for chart generation functions, extend `generate_pdf_report()` with `mode` and `triage_counts` parameters, and update both frontend download touchpoints (ExportButtons + StageExport) to offer Executive/Technical dropdown.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Two modes: Executive (1-2 page summary) and Technical (full multi-page detail)
- Executive: Verdict, pass rate, severity pie chart, top 3 issues, Statement of Quality
- Technical: Everything in Executive PLUS full issue breakdowns, KP density chart, column analysis, methodology details, issues table (capped at 500, note to download CSV/Excel for complete list)
- Same branded header/footer for both modes -- Executive says "QC Summary Report", Technical says "QC Technical Report"
- Both modes share the same PDF generation pipeline, controlled by a `mode` parameter
- Charts generated server-side with matplotlib in Python, embedded as images in the PDF
- No frontend chart library (no Recharts) -- keeps scope tight, PDF-only charts
- Two charts: (1) Severity breakdown pie chart, (2) Issue density along KP (scatter/bar)
- Executive report gets severity pie only; Technical gets both charts
- If no KP data exists in the dataset, omit KP density chart and add text note
- Statement of Quality: Pass/Fail verdict, checks run, thresholds, dataset scope, "Validated by TruQC" badge
- References triage decisions when available; omitted if Review stage was skipped
- Existing "Download PDF Report" button becomes a dropdown: "Executive Report" / "Technical Report"
- Reports available from both pipeline Export stage AND results dashboard ExportButtons
- No preview -- direct download on click
- Pipeline export passes triage decision counts to the report API alongside run_id
- Report API endpoint adds `?mode=executive|technical` query parameter

### Claude's Discretion
- Matplotlib chart styling (colors, fonts, sizing to match PDF brand)
- Exact layout of the "Validated by TruQC" badge/stamp
- Page breaks and section ordering within each mode
- How triage counts are formatted in the SoQ paragraph text
- Severity pie chart style (donut vs filled pie)

### Deferred Ideas (OUT OF SCOPE)
- Frontend dashboard charts (Recharts) for interactive QC visualization -- separate phase
- Report preview modal before download
- Custom report templates / configurable section ordering
- Validation certificates as standalone 1-page PDFs
- Compare reports across multiple validation runs
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fpdf2 | >=2.8 (installed: 2.8.7) | PDF generation | Already used in project, lightweight, no system deps |
| matplotlib | >=3.8 | Server-side chart rendering | Industry standard for Python static charts, Agg backend for headless |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PIL/Pillow | (transitive via matplotlib) | Image conversion for pdf.image() | Converting matplotlib canvas to embeddable image |
| numpy | >=2.1 (already installed) | Array operations for chart data | Aggregating issue data for KP density scatter |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| matplotlib | plotly + kaleido | Heavier dependency, overkill for static PDF charts |
| PIL Image route | BytesIO directly | BytesIO can have close issues with fpdf2 PNG; PIL is safer |

**Installation:**
```bash
pip install matplotlib>=3.8
# Add to backend/requirements.txt: matplotlib>=3.8
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/services/
  report_builder.py     # Extend: add mode param, SoQ section, chart embedding
  chart_builder.py      # NEW: matplotlib chart generation functions
```

### Pattern 1: Chart Generation as Pure Functions
**What:** Each chart is a standalone function returning PIL Image or bytes
**When to use:** Always -- keeps chart logic testable and decoupled from PDF layout
**Example:**
```python
# backend/app/services/chart_builder.py
import io
import matplotlib
matplotlib.use("Agg")  # MUST be before pyplot import
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
from PIL import Image
import numpy as np

# Match brand colors from report_builder.py
SEVERITY_CHART_COLORS = {
    "critical": "#EF4444",  # red-500
    "warning": "#F59E0B",   # amber-500
    "info": "#3B82F6",      # blue-500
}

def generate_severity_pie(critical: int, warning: int, info: int) -> Image.Image:
    """Generate a severity breakdown pie/donut chart as PIL Image."""
    fig = Figure(figsize=(4, 3), dpi=150)
    ax = fig.add_subplot(111)
    
    counts = []
    labels = []
    colors = []
    for label, count, color in [
        ("Critical", critical, SEVERITY_CHART_COLORS["critical"]),
        ("Warning", warning, SEVERITY_CHART_COLORS["warning"]),
        ("Info", info, SEVERITY_CHART_COLORS["info"]),
    ]:
        if count > 0:
            counts.append(count)
            labels.append(f"{label} ({count})")
            colors.append(color)
    
    if not counts:
        return None  # No issues, skip chart
    
    wedges, texts, autotexts = ax.pie(
        counts, labels=labels, colors=colors, autopct="%1.0f%%",
        wedgeprops={"width": 0.6},  # donut style
        textprops={"fontsize": 8},
    )
    ax.set_title("Issue Severity Breakdown", fontsize=10, fontweight="bold", color="#0F172A")
    fig.tight_layout()
    
    # Render to PIL Image
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", transparent=False, facecolor="white")
    buf.seek(0)
    img = Image.open(buf).copy()  # .copy() to detach from buffer
    buf.close()
    plt.close(fig)
    return img
```

### Pattern 2: Mode-Controlled Report Generation
**What:** Single function with `mode` parameter controlling section inclusion
**When to use:** The locked decision -- both modes share the pipeline
**Example:**
```python
def generate_pdf_report(
    run_data: dict,
    issues: list[dict],
    dataset_name: str,
    mode: str = "technical",  # "executive" or "technical"
    triage_counts: dict | None = None,  # {"accepted": N, "rejected": N, "deferred": N}
) -> bytes:
    ...
```

### Pattern 3: Embed Chart Image in fpdf2
**What:** Use `pdf.image(pil_image, w=width)` to embed matplotlib output
**When to use:** Whenever a chart needs to appear in the PDF
**Example:**
```python
# Source: fpdf2 official docs - Images page
from PIL import Image

chart_img = generate_severity_pie(critical, warning, info)
if chart_img:
    pdf.image(chart_img, x=pdf.l_margin, w=90)  # 90mm wide
    pdf.ln(5)
```

### Pattern 4: Statement of Quality as Text Block
**What:** Auto-generated professional paragraph with dataset metadata and triage summary
**When to use:** Both report modes include SoQ
**Example:**
```python
def _build_soq_text(run_data, dataset_name, triage_counts):
    verdict = "PASS" if run_data.get("critical_count", 0) == 0 else "FAIL"
    pass_rate = run_data.get("pass_rate", 0)
    total = run_data.get("total_issues", 0)
    
    text = (
        f"This dataset ({dataset_name}) has been validated by TruQC automated QC engine "
        f"and received an overall verdict of {verdict} with a pass rate of {pass_rate:.1f}%. "
        f"A total of {total} issues were identified across the validation checks performed."
    )
    
    if triage_counts:
        accepted = triage_counts.get("accepted", 0)
        rejected = triage_counts.get("rejected", 0)
        deferred = triage_counts.get("deferred", 0)
        text += (
            f" Following human review: {accepted} issues were accepted for remediation, "
            f"{rejected} were rejected as false positives, and {deferred} were deferred for later assessment."
        )
    
    return text
```

### Anti-Patterns to Avoid
- **Importing pyplot at module level:** Always use `matplotlib.use("Agg")` before importing pyplot, or better yet use Figure directly without pyplot to avoid threading issues in FastAPI
- **Not closing figures:** Always call `plt.close(fig)` after rendering to prevent memory leaks on the server
- **Using BytesIO directly with pdf.image():** fpdf2 may close the BytesIO on PNG processing; convert to PIL Image with `.copy()` first
- **Branching into separate generator functions per mode:** Keep one function with conditional sections -- the modes share 70%+ of their content

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pie/donut charts | Custom fpdf2 arc drawing | matplotlib pie chart | Correct label placement, percentage calc, anti-aliasing |
| Scatter/bar plots | Manual coordinate math in fpdf2 | matplotlib scatter/bar | Axis scaling, tick labels, legend handling |
| PNG image generation | Raw pixel manipulation | matplotlib Figure + Agg canvas | Professional quality, DPI control, font rendering |
| PDF branded stamp | Complex manual drawing | fpdf2 rect + set_font + styled text block | The stamp is text+border, not a graphic asset |

**Key insight:** fpdf2 is great for structured text/tables but terrible for data visualization. matplotlib handles all chart rendering; fpdf2 just embeds the resulting images.

## Common Pitfalls

### Pitfall 1: matplotlib Backend Not Set Before Import
**What goes wrong:** On Railway (headless Linux), matplotlib tries to find a GUI backend and crashes
**Why it happens:** Default backend detection fails without display server
**How to avoid:** Set `matplotlib.use("Agg")` as the FIRST matplotlib call, before any pyplot import. Better: use `Figure()` directly without pyplot.
**Warning signs:** `RuntimeError: cannot open display` or similar on deployment

### Pitfall 2: Memory Leaks from Unclosed Figures
**What goes wrong:** Each report generation leaks ~1-5MB of figure memory
**Why it happens:** matplotlib keeps figure references until explicitly closed
**How to avoid:** Always use try/finally with `plt.close(fig)` or use context manager pattern
**Warning signs:** Growing memory on Railway over time

### Pitfall 3: fpdf2 Closes BytesIO on PNG Processing
**What goes wrong:** If you pass BytesIO to `pdf.image()`, subsequent reads of the same buffer fail
**Why it happens:** fpdf2 internal PNG processing may close the stream
**How to avoid:** Convert to PIL Image with `.copy()` before passing to fpdf2, then close the BytesIO
**Warning signs:** `ValueError: I/O operation on closed file`

### Pitfall 4: Helvetica Font Limitation in Charts
**What goes wrong:** matplotlib uses its own fonts; mismatch with PDF Helvetica
**Why it happens:** matplotlib default font is DejaVu Sans, not Helvetica
**How to avoid:** Set matplotlib font to Arial/Helvetica-like: `plt.rcParams['font.family'] = 'sans-serif'` -- close enough for embedded chart images
**Warning signs:** Visual inconsistency between chart labels and PDF text

### Pitfall 5: Large Chart Images Bloating PDF
**What goes wrong:** High DPI charts make PDFs 5-10MB
**Why it happens:** 300 DPI is overkill for embedded PDF charts
**How to avoid:** Use 150 DPI for charts -- good balance of quality and file size
**Warning signs:** PDF files over 2MB for simple reports

### Pitfall 6: Header Text Not Matching Mode
**What goes wrong:** Both modes show "QC Validation Report" in header
**Why it happens:** Forgetting to pass mode to QCReport constructor
**How to avoid:** Add `report_mode` param to QCReport.__init__ and use in header()
**Warning signs:** Executive and Technical reports look identical in header bar

## Code Examples

### Existing Code to Extend

The current `report_builder.py` structure (verified from codebase):

```python
# QCReport.__init__ -- add report_mode parameter
class QCReport(FPDF):
    def __init__(self, dataset_name: str = "", report_mode: str = "technical"):
        super().__init__()
        self.set_compression(False)
        self.dataset_name = dataset_name
        self.report_mode = report_mode
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        self.set_fill_color(*BRAND_DARK)
        self.rect(0, 0, 210, 12, "F")
        self.set_y(2)
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*WHITE)
        title = "TruQC  |  QC Summary Report" if self.report_mode == "executive" else "TruQC  |  QC Technical Report"
        self.cell(0, 8, title, align="C")
        self.set_y(16)
```

### KP Density Chart Generation

```python
def generate_kp_density_chart(issues: list[dict]) -> Image.Image | None:
    """Generate KP density scatter/bar chart showing issue clusters."""
    kp_values = []
    severities = []
    for issue in issues:
        kp = issue.get("kp_value")
        if kp is not None:
            kp_values.append(float(kp))
            severities.append(issue.get("severity", "info"))
    
    if not kp_values:
        return None  # No KP data available
    
    fig = Figure(figsize=(6, 3), dpi=150)
    ax = fig.add_subplot(111)
    
    colors = [SEVERITY_CHART_COLORS.get(s, "#3B82F6") for s in severities]
    ax.scatter(kp_values, [1] * len(kp_values), c=colors, alpha=0.6, s=20)
    ax.set_xlabel("KP (km)", fontsize=8)
    ax.set_title("Issue Density Along KP", fontsize=10, fontweight="bold", color="#0F172A")
    ax.set_yticks([])
    fig.tight_layout()
    
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor="white")
    buf.seek(0)
    img = Image.open(buf).copy()
    buf.close()
    plt.close(fig)
    return img
```

### Frontend Dropdown Pattern (ExportButtons)

```tsx
// Convert single PDF button to mode dropdown
// Use a simple <select> or custom dropdown with two options
const [pdfMode, setPdfMode] = useState<"executive" | "technical" | null>(null)

// Download URL changes:
const url = `/api/reports/pdf?runId=${runId}&mode=${mode}`
```

### API Route Changes (Next.js proxy)

```typescript
// src/app/api/reports/pdf/route.ts
const mode = searchParams.get('mode') || 'technical'
const triageAccepted = searchParams.get('triage_accepted')
const triageRejected = searchParams.get('triage_rejected') 
const triageDeferred = searchParams.get('triage_deferred')

// Forward to FastAPI
const params = new URLSearchParams({ mode })
if (triageAccepted) params.set('triage_accepted', triageAccepted)
// ...
const response = await fetch(`${fastApiUrl}/api/v1/report/pdf/${runId}?${params}`)
```

### FastAPI Endpoint Changes

```python
@router.get("/report/pdf/{run_id}")
def get_pdf_report(
    run_id: str,
    mode: str = Query(default="technical", pattern="^(executive|technical)$"),
    triage_accepted: int | None = Query(default=None),
    triage_rejected: int | None = Query(default=None),
    triage_deferred: int | None = Query(default=None),
):
    # ... existing fetch logic ...
    
    triage_counts = None
    if triage_accepted is not None:
        triage_counts = {
            "accepted": triage_accepted or 0,
            "rejected": triage_rejected or 0,
            "deferred": triage_deferred or 0,
        }
    
    pdf_bytes = generate_pdf_report(run_data, issues, dataset_name, mode=mode, triage_counts=triage_counts)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WeasyPrint (HTML-to-PDF) | fpdf2 (direct PDF construction) | Phase 9 decision | No system deps, works on Railway |
| ReportLab | fpdf2 | Phase 9 decision | Simpler API, sufficient for structured reports |
| Client-side charting | Server-side matplotlib | Phase 19 decision | Charts in PDF only, no JS chart library needed |

**Current in project:**
- fpdf2 2.8.7 with compression disabled for testability
- `DataFlow` branding in header/footer (needs updating to `TruQC`)
- Existing severity bar chart (manual fpdf2 rects) -- being supplemented with matplotlib pie

**Note:** The existing header says "DataFlow | QC Validation Report" but the project is branded "TruQC" -- this phase should update branding in the header/footer text.

## Open Questions

1. **TruQC vs DataFlow branding in PDFs**
   - What we know: Header currently says "DataFlow", footer says "Generated by DataFlow QC Engine"
   - What's unclear: Whether branding update is in scope for this phase or already done
   - Recommendation: Update branding to TruQC as part of this phase since we're modifying the header anyway

2. **"Validated by TruQC" badge visual approach**
   - What we know: Needs to feel like an engineering certification stamp
   - What's unclear: Exact visual -- a bordered text box? A circular stamp? An image asset?
   - Recommendation: Use fpdf2 drawing primitives -- rounded rectangle with border, "Validated by TruQC" text inside, date and run ID. No external image asset needed. Keep it simple and professional.

3. **Triage counts from results dashboard (non-pipeline)**
   - What we know: Pipeline has triageDecisions in state; ExportButtons on results dashboard may not
   - What's unclear: Whether results dashboard reports should ever include triage data
   - Recommendation: Only pipeline export passes triage counts. Results dashboard export generates reports without triage section (SoQ says "No manual review performed" or omits triage paragraph).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 |
| Config file | backend/tests/ directory |
| Quick run command | `cd backend && python -m pytest tests/test_report_builder.py -x` |
| Full suite command | `cd backend && python -m pytest tests/ -x` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P19-01 | Executive mode generates 1-2 page PDF | unit | `pytest tests/test_report_builder.py::test_executive_mode -x` | Extend existing |
| P19-02 | Technical mode generates full multi-page PDF | unit | `pytest tests/test_report_builder.py::test_technical_mode -x` | Extend existing |
| P19-03 | Severity pie chart embedded in PDF | unit | `pytest tests/test_report_builder.py::test_severity_pie_chart -x` | Wave 0 |
| P19-04 | KP density chart embedded when KP data exists | unit | `pytest tests/test_report_builder.py::test_kp_density_chart -x` | Wave 0 |
| P19-05 | KP density chart omitted with note when no KP data | unit | `pytest tests/test_report_builder.py::test_kp_no_data -x` | Wave 0 |
| P19-06 | Statement of Quality section present | unit | `pytest tests/test_report_builder.py::test_soq_section -x` | Wave 0 |
| P19-07 | Triage counts in SoQ when provided | unit | `pytest tests/test_report_builder.py::test_soq_triage -x` | Wave 0 |
| P19-08 | Chart builder produces valid PNG images | unit | `pytest tests/test_chart_builder.py -x` | Wave 0 |
| P19-09 | API accepts mode query parameter | unit | Requires integration test setup | Manual verify |
| P19-10 | Frontend dropdown triggers correct mode download | e2e | Manual | Manual verify |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_report_builder.py tests/test_chart_builder.py -x`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_chart_builder.py` -- covers P19-03, P19-04, P19-05, P19-08
- [ ] New test cases in `backend/tests/test_report_builder.py` -- covers P19-01, P19-02, P19-06, P19-07
- [ ] `matplotlib>=3.8` added to `backend/requirements.txt`

## Sources

### Primary (HIGH confidence)
- [fpdf2 official docs - Images](https://py-pdf.github.io/fpdf2/Images.html) -- image embedding from BytesIO/PIL
- [fpdf2 official docs - Charts & Graphs](https://py-pdf.github.io/fpdf2/Maths.html) -- matplotlib integration pattern
- [matplotlib Backends docs](https://matplotlib.org/stable/users/explain/figure/backends.html) -- Agg backend for headless
- Codebase: `backend/app/services/report_builder.py` -- existing QCReport class, brand colors, section patterns
- Codebase: `backend/app/routers/reports.py` -- existing PDF endpoint structure
- Codebase: `src/components/files/export-buttons.tsx` -- existing download button pattern
- Codebase: `src/app/(dashboard)/pipeline/components/stage-export.tsx` -- existing pipeline export
- Codebase: `src/app/(dashboard)/pipeline/lib/pipeline-state.ts` -- triage decisions structure

### Secondary (MEDIUM confidence)
- [fpdf2 BytesIO issue #881](https://github.com/py-pdf/fpdf2/issues/881) -- BytesIO close behavior with PNG

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - fpdf2 already in use, matplotlib is standard for Python server-side charts
- Architecture: HIGH - straightforward extension of existing patterns, code read from codebase
- Pitfalls: HIGH - well-documented matplotlib/fpdf2 integration issues with verified sources

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable libraries, no breaking changes expected)
