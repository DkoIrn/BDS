# Phase 24: Branded Client Reports - Research

**Researched:** 2026-04-10
**Domain:** PDF report customisation (branding, sections, commentary) + Supabase storage for logos
**Confidence:** HIGH

## Summary

Phase 24 adds user-level report branding to the existing fpdf2 PDF generation pipeline. The current `report_builder.py` uses hardcoded brand colours (BRAND_DARK, BRAND_TEAL, etc.) and a fixed section structure. This phase needs to: (1) store branding settings (logo path, primary colour) in the profiles table, (2) store a logo image in Supabase Storage, (3) pass branding + section toggles + commentary to the FastAPI report endpoint, and (4) provide a Settings UI for branding configuration plus a pre-generation dialog for section/commentary customisation.

The existing architecture is well-suited for this. fpdf2 natively supports PNG/JPEG image embedding via `pdf.image()` (already used for chart embedding via temp files). The report builder already uses colour constants that can be parameterised. The profiles table can be extended with 2 columns (logo_storage_path, brand_color). Section toggles and commentary are per-generation parameters, not persisted settings -- they should be passed as query parameters or POST body to the report endpoint.

**Primary recommendation:** Extend profiles table with branding columns, create a "branding" storage bucket for logos, parameterise report_builder colours and section visibility, and add a pre-generation config dialog on the frontend.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RPTX-01 | Company logo upload for branded reports | Supabase Storage bucket for logos + profiles.logo_storage_path column + fpdf2 image() embedding |
| RPTX-02 | Custom colour scheme on reports | profiles.brand_color column + parameterised BRAND_TEAL replacement in report_builder |
| RPTX-03 | Toggleable report sections | Section visibility flags passed as query params to FastAPI endpoint, pre-gen dialog on frontend |
| RPTX-04 | Commentary/notes on report sections | Commentary dict passed as POST body to FastAPI endpoint, rendered as italic text blocks in PDF |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fpdf2 | >=2.8 | PDF generation with image embedding | Already in use, supports PNG/JPEG via image(), colour parameterisation trivial |
| Supabase Storage | - | Logo file storage | Already used for datasets, same RLS pattern applies |
| Supabase DB | - | Branding settings persistence | profiles table already has plan/stripe columns, natural extension point |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Pillow (PIL) | Already installed | Logo image validation/resize | Validate uploaded logos, resize to max dimensions for PDF |
| react-dropzone | Already installed | Logo upload UI | Same pattern as file upload zones elsewhere in app |

### No New Dependencies Required
All needed libraries are already installed. fpdf2 handles PDF, PIL handles image processing, Supabase handles storage. No new packages needed.

## Architecture Patterns

### Recommended Approach

**Two categories of customisation with different persistence models:**

1. **Persisted branding settings** (logo + colour) -- stored in profiles table, applied to ALL reports
2. **Per-generation options** (section toggles + commentary) -- passed at generation time, NOT persisted

This separation is important because:
- Logo and colour are "set once, use forever" settings
- Section toggles and commentary change per report generation (user may want methodology for one client but not another)

### Data Flow

```
Settings Page (upload logo, pick colour)
  --> Supabase Storage (logo image)
  --> profiles table (logo_storage_path, brand_color)

Export Button click
  --> Pre-generation dialog (toggle sections, add commentary)
  --> POST /api/reports/pdf (branding from DB + sections/commentary from request)
  --> FastAPI fetches branding from profiles table
  --> FastAPI downloads logo from Supabase Storage
  --> report_builder generates PDF with custom branding
  --> PDF returned to client
```

### Database Schema Extension

```sql
-- Migration: Add branding columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#14B8A6';
```

- `logo_storage_path`: path in Supabase Storage (e.g., `{user_id}/logo.png`)
- `brand_color`: hex colour string (default teal-500 = #14B8A6, matching current BRAND_TEAL)

### Storage Bucket

Create a new `branding` bucket (or reuse `datasets` with a `branding/` prefix). A separate bucket is cleaner:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding',
  'branding',
  false,
  2097152,  -- 2MB max for logos
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml']
);
```

With the same RLS pattern as datasets (user UUID folder prefix).

**Decision: Use `datasets` bucket with `branding/` subfolder** to avoid creating a new bucket + new RLS policies. The datasets bucket already has correct RLS. Logo path would be `{user_id}/branding/logo.png`.

### Report Builder Changes

The `QCReport` class constructor and `generate_pdf_report` function need new parameters:

```python
def generate_pdf_report(
    run_data: dict,
    issues: list[dict],
    dataset_name: str,
    mode: str = "technical",
    triage_counts: dict | None = None,
    # NEW branding params
    branding: dict | None = None,
    sections: dict | None = None,
    commentary: dict | None = None,
) -> bytes:
```

Where:
- `branding = {"logo_path": "/tmp/logo.png", "brand_color": "#1E40AF"}` (logo already downloaded to temp)
- `sections = {"methodology": false, "per_column": true, "kp_density": true, ...}` (which sections to include)
- `commentary = {"executive_summary": "Client notes here...", "soq": "Additional remarks..."}` (text to insert)

### Section Toggle Map

The Technical report has these toggleable sections:
1. `executive_summary` -- always shown (cannot toggle off)
2. `severity_pie` -- severity pie chart
3. `severity_breakdown` -- severity bar breakdown
4. `issues_by_category` -- issues by check category table
5. `issues_by_column` -- per-column issue summary
6. `kp_density` -- KP density scatter chart
7. `methodology` -- methodology description
8. `soq` -- Statement of Quality
9. `detailed_issues` -- full issues table

The Executive report has:
1. `executive_summary` -- always shown
2. `severity_pie` -- pie chart
3. `top_issues` -- top 3 issues
4. `soq` -- Statement of Quality

Default: all sections enabled.

### API Contract Change

Current: `GET /api/v1/report/pdf/{run_id}?mode=technical&triage_accepted=5`

New: `POST /api/v1/report/pdf/{run_id}` with JSON body:

```json
{
  "mode": "technical",
  "triage_accepted": 5,
  "triage_rejected": 2,
  "triage_deferred": 1,
  "sections": {
    "methodology": false,
    "kp_density": true
  },
  "commentary": {
    "executive_summary": "Additional client notes..."
  }
}
```

Branding (logo + colour) is fetched server-side from the user's profile -- NOT sent from the client. This prevents spoofing and keeps logos secure.

**Important:** The FastAPI endpoint needs the user_id to fetch branding. Currently auth is handled by the Next.js proxy, not FastAPI. The proxy should fetch branding settings and pass them to FastAPI, OR FastAPI should accept a user_id parameter from the trusted proxy.

**Recommended approach:** Next.js proxy fetches branding from profiles table (it already has auth context), downloads logo from Supabase Storage, and forwards logo bytes + colour to FastAPI as part of the request. This keeps FastAPI stateless and avoids giving it Supabase credentials it may not have.

### Frontend Pre-Generation Dialog

Replace the simple dropdown menu in ExportButtons with a dialog that appears before generation:

```
[PDF Report v] --> click --> Dialog opens:
  
  Report Mode: [Executive] [Technical]
  
  Sections (Technical only):
  [x] Severity Chart
  [x] Severity Breakdown
  [x] Issues by Category
  [ ] Issues by Column        <-- toggled off
  [x] KP Density
  [ ] Methodology              <-- toggled off
  [x] Statement of Quality
  [x] Detailed Issues Table
  
  Commentary (optional):
  Executive Summary: [textarea]
  Statement of Quality: [textarea]
  
  [Cancel] [Generate Report]
```

### Anti-Patterns to Avoid
- **Sending logo from client to FastAPI on every report request:** Wasteful. Fetch from storage server-side.
- **Storing section toggles in the database:** Over-engineering. These change per report, not per account.
- **Custom font embedding in fpdf2:** Helvetica is safe. Custom fonts require TTF registration and complicate deployment.
- **SVG logos in PDF:** fpdf2 does not support SVG natively. Convert to PNG on upload or reject SVG.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Logo image validation | Custom image parsing | PIL Image.open() + verify() | Handles corrupt files, format detection |
| Logo resizing | Manual pixel math | PIL Image.thumbnail() | Maintains aspect ratio, handles edge cases |
| Colour parsing | Regex hex parsing | Simple hex validation + tuple conversion | `int(hex[1:3], 16)` etc. -- trivial but standardise |
| File upload UI | Custom drag-drop | react-dropzone (already used) | Consistent with existing upload patterns |
| Colour picker | Custom colour input | HTML native `<input type="color">` | Browser-native, works everywhere, no dependency |

## Common Pitfalls

### Pitfall 1: fpdf2 SVG Support
**What goes wrong:** User uploads SVG logo, fpdf2 cannot embed it
**Why it happens:** fpdf2 only supports PNG, JPEG, and GIF raster formats for image()
**How to avoid:** Accept only PNG and JPEG for logos. Validate on upload. If SVG support is desired later, convert with Pillow/cairosvg server-side.
**Warning signs:** "image format not supported" error from fpdf2

### Pitfall 2: Logo Aspect Ratio Distortion
**What goes wrong:** Logo appears stretched/squashed in PDF header
**Why it happens:** fpdf2 image() with only width OR only height stretches to fit
**How to avoid:** Use PIL to get original dimensions, calculate aspect ratio, pass both width and height to pdf.image() maintaining ratio. Cap at max height of ~12mm for header.
**Warning signs:** Visual inspection of generated PDF

### Pitfall 3: Large Logo Files Slowing Report Generation
**What goes wrong:** User uploads 5MB high-res logo, every report takes seconds to generate
**Why it happens:** fpdf2 embeds the full image bytes into the PDF
**How to avoid:** Resize logos on upload to max 400x200px, enforce 2MB upload limit, store the resized version
**Warning signs:** Report generation time > 3 seconds

### Pitfall 4: GET to POST Migration Breaking Existing Clients
**What goes wrong:** Changing the report endpoint from GET to POST breaks the existing fetch-based download
**Why it happens:** ExportButtons and pipeline export currently use GET requests
**How to avoid:** Support BOTH GET (backwards-compatible, no branding customisation) and POST (new, with sections/commentary). Or keep GET and pass sections as comma-separated query params.
**Alternative:** Keep GET, encode sections as query params: `?sections=severity_pie,soq,detailed_issues&commentary_summary=text`

**Recommendation:** Switch to POST for the Next.js proxy route, keep FastAPI endpoint accepting both GET and POST. The frontend is the only consumer, so migration is contained.

### Pitfall 5: Temp File Cleanup for Downloaded Logos
**What goes wrong:** Logo temp files accumulate on the server
**Why it happens:** Logo downloaded from Supabase Storage to temp file for fpdf2 image(), not cleaned up
**How to avoid:** Use `tempfile.NamedTemporaryFile` with try/finally cleanup (same pattern as `_embed_chart`)
**Warning signs:** Disk space warnings on Railway

### Pitfall 6: Colour Contrast Issues
**What goes wrong:** User picks white or very light brand colour, text becomes invisible on white PDF background
**Why it happens:** Brand colour used for header text/accents without contrast validation
**How to avoid:** Use brand colour only for accent elements (header bar fill, badge border, section underlines). Keep text in BRAND_DARK/BRAND_MID. Never use brand colour as text colour on white background.

## Code Examples

### fpdf2 Logo Embedding (verified pattern from existing codebase)
```python
# Same temp file pattern already used in _embed_chart
import tempfile
from PIL import Image

def _embed_logo(pdf: QCReport, logo_bytes: bytes, max_height: float = 10.0) -> None:
    """Embed a company logo in the PDF header area."""
    img = Image.open(io.BytesIO(logo_bytes))
    # Calculate dimensions maintaining aspect ratio
    w, h = img.size
    aspect = w / h
    logo_h = min(max_height, 10.0)  # mm
    logo_w = logo_h * aspect
    
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        img.save(tmp, format="PNG")
        tmp_path = tmp.name
    
    pdf.image(tmp_path, x=pdf.l_margin, y=2, h=logo_h)
    
    import os
    try:
        os.unlink(tmp_path)
    except OSError:
        pass
```

### Hex Colour to RGB Tuple
```python
def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert '#1E40AF' to (30, 64, 175)."""
    hex_color = hex_color.lstrip("#")
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
    )
```

### Supabase Logo Upload (server action pattern)
```typescript
// Server action for logo upload
export async function uploadBrandingLogo(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }
  
  const file = formData.get("logo") as File
  const path = `${user.id}/branding/logo.png`
  
  const { error } = await supabase.storage
    .from("datasets")
    .upload(path, file, { upsert: true })
  
  if (error) return { error: error.message }
  
  // Update profile with logo path
  await supabase
    .from("profiles")
    .update({ logo_storage_path: path })
    .eq("id", user.id)
  
  return { success: true }
}
```

### Native Colour Picker (no dependency)
```tsx
<div className="space-y-2">
  <Label htmlFor="brand_color">Brand Colour</Label>
  <div className="flex items-center gap-3">
    <input
      type="color"
      id="brand_color"
      value={brandColor}
      onChange={(e) => setBrandColor(e.target.value)}
      className="h-10 w-14 cursor-pointer rounded-lg border"
    />
    <Input
      value={brandColor}
      onChange={(e) => setBrandColor(e.target.value)}
      placeholder="#14B8A6"
      className="w-28 rounded-xl font-mono text-sm"
    />
  </div>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded BRAND_TEAL in report_builder | Parameterised brand colour from user profile | This phase | All colour references become configurable |
| Fixed section order, all sections always rendered | Section toggle flags control inclusion | This phase | Users can hide irrelevant sections |
| No logo in reports, only "TruQC" text header | User logo + "TruQC" co-branding in header | This phase | Reports look client-ready |

## Open Questions

1. **Co-branding vs replacement: Should the user logo replace "TruQC" or appear alongside it?**
   - Recommendation: Co-branding. User logo on left, "TruQC | QC Report" text on right. TruQC branding stays for product recognition. The "Validated by TruQC" badge in SoQ also stays.

2. **Should section toggles default to "all on" or remember last used?**
   - Recommendation: Default all-on. Per-generation config is transient. Persisting would add complexity with minimal value for v1.

3. **Logo in header vs title page?**
   - Recommendation: Header bar (every page). The current header bar is 12mm tall -- logo fits at ~8mm height in the left portion. This gives maximum visibility without a separate title page.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.0+ (backend), vitest (frontend -- if configured) |
| Config file | backend/pytest.ini or pyproject.toml |
| Quick run command | `cd backend && python -m pytest tests/test_report_builder.py -x` |
| Full suite command | `cd backend && python -m pytest tests/ -x` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RPTX-01 | Logo embedded in PDF header | unit | `pytest tests/test_report_builder.py::test_branding_logo -x` | Wave 0 |
| RPTX-02 | Brand colour applied to headers/accents | unit | `pytest tests/test_report_builder.py::test_branding_color -x` | Wave 0 |
| RPTX-03 | Sections toggled off are excluded from PDF | unit | `pytest tests/test_report_builder.py::test_section_toggles -x` | Wave 0 |
| RPTX-04 | Commentary text appears in relevant sections | unit | `pytest tests/test_report_builder.py::test_commentary -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_report_builder.py -x`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] New test cases in `tests/test_report_builder.py` for branding, sections, commentary
- [ ] No new test files needed -- extend existing test file

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `backend/app/services/report_builder.py` -- current PDF generation architecture
- Codebase analysis: `backend/app/services/chart_builder.py` -- image embedding pattern
- Codebase analysis: `backend/app/routers/reports.py` -- current API contract
- Codebase analysis: `src/components/files/export-buttons.tsx` -- current frontend export flow
- Codebase analysis: `supabase/migrations/00001_profiles.sql` + `00009_stripe_billing.sql` -- profiles schema
- Codebase analysis: `supabase/migrations/00004_storage_bucket.sql` -- storage RLS pattern
- fpdf2 docs: image() supports PNG, JPEG, GIF; requires file path or bytes (verified via existing _embed_chart usage)

### Secondary (MEDIUM confidence)
- fpdf2 image format limitations (no SVG) -- from library documentation and training data, consistent with codebase usage

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries needed, all patterns exist in codebase
- Architecture: HIGH - clear extension of existing report_builder + profiles table
- Pitfalls: HIGH - based on actual codebase patterns (temp file handling, image embedding)

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- no moving parts, all internal)
