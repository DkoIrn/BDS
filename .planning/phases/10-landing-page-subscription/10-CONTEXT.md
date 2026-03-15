# Phase 10: Landing Page & Subscription - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Public-facing landing page that communicates the platform's value proposition to survey/engineering companies, plus a visible 3-tier subscription structure (Starter, Professional, Enterprise). No payment processing — tiers are display-only for MVP. Stripe integration is v2.

</domain>

<decisions>
## Implementation Decisions

### Page structure
- Single scrollable page (no separate /pricing route)
- Section order: Hero → Features → How it works → Pricing → Final CTA → Footer
- No social proof/testimonials section for MVP — add when real users exist
- Sections connected via anchor links from the navbar

### Hero section
- Pain-point led headline (e.g., "Stop spending hours manually checking survey data")
- Subtext explaining the value prop (automated QC, explainable flags, minutes not hours)
- Product screenshot/mockup as the hero visual (show dashboard or results view)
- Primary CTA button ("Get Started" or similar) linking to /signup

### Features section
- 3-6 feature cards highlighting key capabilities
- Lucide icons (from shadcn/ui) next to each feature — no illustrations
- Features to showcase: auto-detection, anomaly flagging, explainable reports, validation profiles, async processing, export

### How it works section
- Step-by-step flow: Upload → Auto-detect → Validate → Report
- Visual pipeline showing the simplicity of the workflow

### Pricing tiers
- 3-tier layout: Starter, Professional, Enterprise
- Placeholder monthly prices for Starter and Professional (realistic-looking, adjustable later)
- Enterprise shows "Contact us" instead of a price
- Monthly pricing only — no annual toggle for MVP
- Differentiators across tiers:
  - Upload limits (files per month / file size)
  - Project/job count
  - Feature access (basic vs all validators + profiles vs API access + priority support)

### Navigation & CTA flow
- Sticky header: Logo (left), anchor links to Features/How it works/Pricing (center), Login + Sign up buttons (right)
- All CTA buttons link to /signup — no tier pre-selection via query params
- Logged-in users visiting root URL redirect to /dashboard (keep current behavior)
- Minimal footer: company name, copyright, 2-3 links (Login, Privacy, Terms)

### Visual tone
- Professional & clean — authoritative, data-driven feel (Datadog/Linear style)
- Lots of white space, sharp typography, subtle gradients
- Brand palette: Deep Blue primary, Teal for accents/success, Orange for CTAs/attention
- Inter font, light mode only (consistent with app)

### Copywriting
- Pain-point led: lead with the problem survey engineers face
- Technical but accessible tone — engineers are the audience, not marketers

### Claude's Discretion
- Exact hero headline and subtext copy
- Feature card descriptions and which 3-6 features to highlight
- How-it-works visual treatment (numbered steps, timeline, icons)
- Exact placeholder price points for Starter and Professional
- Specific feature lists per tier
- Footer link selection
- Responsive breakpoint behavior
- Screenshot/mockup presentation style (browser frame, shadow, angle)

</decisions>

<specifics>
## Specific Ideas

- Hero visual should be a product screenshot showing the dashboard or results view — makes the product feel real
- Pain-point angle resonates with target audience: survey engineers who spend hours on manual QC
- Pricing should look realistic but is adjustable — no commitment to specific numbers yet
- Enterprise "Contact us" is standard SaaS pattern for custom pricing

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- shadcn/ui components: Card, Button, Badge, Separator — can build pricing cards and feature cards
- Lucide icons available through shadcn/ui for feature section
- Inter font already configured in root layout
- Brand color CSS variables already defined in globals.css

### Established Patterns
- Route groups: (auth), (dashboard) — add (marketing) for public landing page
- Root page.tsx currently redirects based on auth state — landing page for unauthenticated, redirect for authenticated
- Root layout.tsx has Inter font + Toaster already set up

### Integration Points
- Root page.tsx needs to become landing page (unauthenticated) or redirect (authenticated)
- Navbar links to existing /login and /signup auth routes
- Anchor links scroll within the single page (#features, #how-it-works, #pricing)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-landing-page-subscription*
*Context gathered: 2026-03-15*
