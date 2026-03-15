# Phase 10: Landing Page & Subscription - Research

**Researched:** 2026-03-15
**Domain:** Next.js landing page with marketing sections and pricing tiers
**Confidence:** HIGH

## Summary

This phase builds a public-facing landing page and subscription tier display using the existing Next.js + shadcn/ui + Tailwind CSS v4 stack. No new libraries are needed. The current `src/app/page.tsx` is a simple redirect (auth check -> dashboard or login) that needs to become a full landing page for unauthenticated users while preserving the redirect for authenticated users.

The implementation is straightforward: a single-page marketing layout with sections (Hero, Features, How it Works, Pricing, CTA, Footer) using existing UI primitives (Card, Button, Badge from shadcn/ui, icons from lucide-react). The only technical considerations are smooth-scroll anchor navigation, a sticky landing-page navbar distinct from the app TopBar, responsive layout breakpoints, and the auth-gated routing logic.

**Primary recommendation:** Build as a (marketing) route group with a dedicated layout, converting the root page.tsx into the landing page with server-side auth check for conditional redirect.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single scrollable page (no separate /pricing route)
- Section order: Hero -> Features -> How it works -> Pricing -> Final CTA -> Footer
- No social proof/testimonials section for MVP
- Sections connected via anchor links from the navbar
- Pain-point led headline in hero
- Product screenshot/mockup as hero visual
- Primary CTA links to /signup
- 3-6 feature cards with Lucide icons (no illustrations)
- Features: auto-detection, anomaly flagging, explainable reports, validation profiles, async processing, export
- Step-by-step flow: Upload -> Auto-detect -> Validate -> Report
- 3-tier layout: Starter, Professional, Enterprise
- Placeholder monthly prices for Starter/Professional, "Contact us" for Enterprise
- Monthly pricing only -- no annual toggle
- Sticky header: Logo (left), anchor links (center), Login + Sign up buttons (right)
- All CTAs link to /signup -- no tier pre-selection
- Logged-in users redirect to /dashboard
- Minimal footer: company name, copyright, 2-3 links
- Professional & clean visual tone (Datadog/Linear style)
- Brand palette: Deep Blue primary, Teal accents, Orange CTAs
- Inter font, light mode only
- Pain-point led copywriting, technical but accessible

### Claude's Discretion
- Exact hero headline and subtext copy
- Feature card descriptions and which 3-6 features to highlight
- How-it-works visual treatment (numbered steps, timeline, icons)
- Exact placeholder price points for Starter and Professional
- Specific feature lists per tier
- Footer link selection
- Responsive breakpoint behavior
- Screenshot/mockup presentation style (browser frame, shadow, angle)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UIDE-03 | Landing page communicates value proposition to target audience | Hero section with pain-point headline, features section, how-it-works flow, CTA buttons |
| SUBS-01 | Platform defines 3 tiers -- Starter, Professional, Enterprise | Pricing section with 3-tier Card layout, feature breakdowns per tier |
| SUBS-02 | Tier structure is visible on the platform (pricing/features page) | Pricing section with anchor link from navbar, visible to all unauthenticated visitors |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | Framework, routing, server components | Already in use |
| React | 19.2.3 | UI rendering | Already in use |
| shadcn/ui | 4.0.2 | Card, Button, Badge, Separator components | Already in use |
| lucide-react | 0.577.0 | Feature section icons | Already in use |
| Tailwind CSS | 4.x | Styling, responsive breakpoints, gradients | Already in use |

### No New Dependencies Required
This phase uses only existing dependencies. No npm install needed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom CSS sections | framer-motion animations | Overkill for MVP landing page; CSS animations sufficient |
| Static hero image | next/image optimized | Use next/image for the screenshot -- already available via Next.js |

## Architecture Patterns

### Recommended Project Structure
```
src/app/
  page.tsx                          # Auth check: landing page (unauth) or redirect (auth)
  (marketing)/
    layout.tsx                      # Marketing layout with landing navbar + footer
  (auth)/                           # Existing auth routes (unchanged)
  (dashboard)/                      # Existing dashboard routes (unchanged)
src/components/
  landing/
    landing-navbar.tsx              # Sticky header with anchor links + Login/Signup
    hero-section.tsx                # Hero with headline, subtext, CTA, screenshot
    features-section.tsx            # Feature cards grid
    how-it-works-section.tsx        # Step-by-step pipeline visual
    pricing-section.tsx             # 3-tier pricing cards
    cta-section.tsx                 # Final call-to-action
    landing-footer.tsx              # Minimal footer
```

### Pattern 1: Auth-Gated Root Page
**What:** Root page.tsx checks auth state server-side. Authenticated users redirect to /dashboard. Unauthenticated users see the landing page content.
**When to use:** When the root URL serves dual purpose (marketing + app entry).
**Current behavior:** Root page.tsx currently redirects both cases (auth -> /dashboard, unauth -> /login). Change to render landing page for unauth.

```typescript
// src/app/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LandingPage from "@/components/landing/landing-page";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
```

**Key insight:** The landing page is NOT in the (marketing) route group -- it IS the root page.tsx. A (marketing) route group would only be needed if there were multiple marketing pages (about, blog, etc.). For a single landing page, keep it simple: root page.tsx renders the landing page component directly with no layout wrapper beyond the root layout. The landing navbar and footer are part of the landing page component itself.

**Revised structure (simpler):**
```
src/app/
  page.tsx                          # Auth check + render LandingPage or redirect
src/components/
  landing/
    landing-page.tsx                # Full landing page composition
    landing-navbar.tsx              # Sticky header
    hero-section.tsx                # Hero section
    features-section.tsx            # Feature cards
    how-it-works-section.tsx        # Pipeline steps
    pricing-section.tsx             # 3-tier cards
    cta-section.tsx                 # Final CTA
    landing-footer.tsx              # Footer
```

### Pattern 2: Anchor Scroll Navigation
**What:** Smooth scrolling to page sections via hash links (#features, #pricing).
**When to use:** Single-page marketing sites with section navigation.
**Implementation:**

```typescript
// In landing-navbar.tsx
const sections = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

// Each section component has an id:
<section id="features" className="scroll-mt-16"> {/* offset for sticky header */}
```

Add `scroll-behavior: smooth` to the html element via globals.css or Tailwind:
```css
html {
  scroll-behavior: smooth;
}
```

The `scroll-mt-16` class (Tailwind) offsets the scroll target by the sticky header height (h-16 = 4rem) so content isn't hidden behind it.

### Pattern 3: Pricing Tier Cards
**What:** 3 cards side by side with one highlighted (Professional as "recommended").
**When to use:** SaaS pricing displays.
**Implementation:** Use shadcn Card with a ring/border highlight on the recommended tier.

```typescript
// Pricing card with highlight
<Card className={cn(
  "relative flex flex-col",
  isPopular && "border-secondary ring-2 ring-secondary"
)}>
  {isPopular && (
    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary">
      Most Popular
    </Badge>
  )}
  {/* ... tier content */}
</Card>
```

### Anti-Patterns to Avoid
- **Don't use client-side routing for anchor links:** Standard `<a href="#section">` works perfectly for same-page scrolling. No need for `useRouter` or `scrollIntoView` JS.
- **Don't create a separate /pricing route:** Decision locked -- single scrollable page.
- **Don't use the app TopBar component:** The landing page needs its own navbar with anchor links and Login/Signup buttons (not the authenticated TopBar with Dashboard/Projects/Reports nav).
- **Don't add framer-motion or animation libraries:** CSS transitions and Tailwind animation utilities are sufficient for MVP.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive grid | Custom media queries | Tailwind grid/flex responsive classes | `grid-cols-1 md:grid-cols-3` handles it |
| Icon set | SVG files or custom icons | lucide-react | Already installed, consistent with app |
| Card components | Custom card HTML | shadcn/ui Card | Already available and styled |
| Smooth scroll | Custom JS scroll handler | CSS `scroll-behavior: smooth` + anchor hrefs | Native browser behavior, zero JS |

## Common Pitfalls

### Pitfall 1: Sticky Header Covering Anchor Targets
**What goes wrong:** Clicking a nav anchor scrolls the section behind the sticky header.
**Why it happens:** Browser scrolls element to viewport top, but the sticky header overlaps.
**How to avoid:** Add `scroll-mt-[height]` to each section (e.g., `scroll-mt-16` for a 4rem/64px header).
**Warning signs:** Section headings invisible after clicking anchor links.

### Pitfall 2: Landing Page Supabase Auth Call on Every Load
**What goes wrong:** The auth check in root page.tsx adds latency for unauthenticated visitors.
**Why it happens:** `supabase.auth.getUser()` makes a network call to verify the session.
**How to avoid:** This is acceptable for MVP. The call is fast when there's no session cookie (returns null quickly). For optimization later, could use middleware to check for cookie presence before calling getUser.
**Warning signs:** Slow initial page load for unauthenticated visitors.

### Pitfall 3: Next/Image for Hero Screenshot
**What goes wrong:** Using a raw `<img>` tag results in unoptimized images and layout shift.
**Why it happens:** Forgetting to use Next.js Image component.
**How to avoid:** Use `next/image` with width/height or fill + sizes. Store the screenshot in `/public/` directory.
**Warning signs:** Lighthouse warnings about unoptimized images.

### Pitfall 4: Landing Navbar vs App TopBar Confusion
**What goes wrong:** Accidentally importing the dashboard TopBar on the landing page.
**Why it happens:** Both are sticky headers with the SQ logo.
**How to avoid:** Landing navbar is a completely separate component in `src/components/landing/`. It has anchor links + Login/Signup, not app navigation.

### Pitfall 5: Mobile Responsive Pricing Grid
**What goes wrong:** 3 pricing cards overflow horizontally on mobile.
**Why it happens:** Fixed 3-column grid without responsive breakpoints.
**How to avoid:** Use `grid-cols-1 lg:grid-cols-3` so cards stack vertically on mobile/tablet.

## Code Examples

### Landing Navbar (Client Component for scroll state)
```typescript
"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn(
      "sticky top-0 z-50 transition-colors",
      scrolled ? "border-b bg-background/95 backdrop-blur" : "bg-transparent"
    )}>
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            SQ
          </div>
          <span className="font-semibold">SurveyQC</span>
        </a>

        {/* Center nav */}
        <nav className="ml-auto flex items-center gap-6">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}
               className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {link.label}
            </a>
          ))}
        </nav>

        {/* Auth buttons */}
        <div className="ml-6 flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-foreground hover:text-foreground/80">
            Log in
          </Link>
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
```

**Note on Button asChild:** Per project decisions, shadcn/ui v4 Button does NOT support asChild. Use a styled Link element instead:
```typescript
<Link href="/signup"
  className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-6 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors">
  Get Started
</Link>
```

### Pricing Tier Data Structure
```typescript
interface PricingTier {
  name: string;
  price: string | null; // null = "Contact us"
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

const tiers: PricingTier[] = [
  {
    name: "Starter",
    price: "$49",
    description: "For individual surveyors and small projects",
    features: [
      "5 projects",
      "10 uploads per month",
      "25MB file size limit",
      "Basic validators",
      "PDF reports",
    ],
    cta: "Get Started",
  },
  {
    name: "Professional",
    price: "$149",
    description: "For survey teams running multiple projects",
    features: [
      "Unlimited projects",
      "100 uploads per month",
      "50MB file size limit",
      "All validators + profiles",
      "PDF reports + dataset export",
      "Priority processing",
    ],
    highlighted: true,
    cta: "Get Started",
  },
  {
    name: "Enterprise",
    price: null,
    description: "For organisations with custom requirements",
    features: [
      "Everything in Professional",
      "Unlimited uploads",
      "100MB file size limit",
      "API access",
      "Custom validators",
      "Dedicated support",
      "SSO integration",
    ],
    cta: "Contact Us",
  },
];
```

### Section Container Pattern
```typescript
// Consistent section spacing and max-width
function Section({ id, children, className }: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-16 py-20 sm:py-28", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {children}
      </div>
    </section>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate /pricing page | Single-page with sections | User decision | Simpler implementation, better scroll UX |
| Animation libraries (framer-motion) | CSS scroll-behavior + Tailwind transitions | Ongoing trend | Fewer dependencies, native performance |
| Custom responsive grids | Tailwind responsive utilities | Tailwind v3+ | grid-cols-1 md:grid-cols-2 lg:grid-cols-3 |

## Open Questions

1. **Hero Screenshot/Mockup**
   - What we know: Decision is to show a product screenshot of dashboard or results view
   - What's unclear: Whether to use an actual screenshot (requires taking one) or a placeholder/illustration
   - Recommendation: Use a placeholder div styled to look like a browser window with a gradient/skeleton inside. Replace with real screenshot when available. This avoids blocking on screenshot creation.

2. **Mobile Navigation**
   - What we know: Sticky header with anchor links
   - What's unclear: Whether to use a hamburger menu on mobile or keep inline links
   - Recommendation: Hide anchor links on mobile (sm breakpoint), show hamburger/sheet menu with anchor links + Login/Signup. Use shadcn Sheet component (already installed) for the mobile menu.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/components/landing --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UIDE-03 | Landing page renders hero, features, pricing sections | unit | `npx vitest run tests/components/landing-page.test.tsx -x` | No - Wave 0 |
| SUBS-01 | Pricing section displays 3 tiers with correct names | unit | `npx vitest run tests/components/pricing-section.test.tsx -x` | No - Wave 0 |
| SUBS-02 | Tier structure shows features and prices | unit | `npx vitest run tests/components/pricing-section.test.tsx -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/components/landing --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `tests/components/landing-page.test.tsx` -- covers UIDE-03 (renders all sections)
- [ ] `tests/components/pricing-section.test.tsx` -- covers SUBS-01, SUBS-02 (tier names, features, prices)

## Sources

### Primary (HIGH confidence)
- Project codebase inspection: package.json, globals.css, page.tsx, layout.tsx, top-bar.tsx, auth layout
- CONTEXT.md: User decisions for all section layout, navigation, pricing structure
- REQUIREMENTS.md: UIDE-03, SUBS-01, SUBS-02 requirement definitions

### Secondary (MEDIUM confidence)
- Next.js scroll-behavior and anchor link patterns: standard browser behavior, well-documented
- shadcn/ui Card/Badge/Button usage: verified from existing codebase components
- Tailwind CSS v4 scroll-mt utility: standard Tailwind utility class

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all existing deps
- Architecture: HIGH - straightforward component composition, established project patterns
- Pitfalls: HIGH - well-known landing page patterns in Next.js
- Pricing structure: MEDIUM - placeholder prices are Claude's discretion, tier features are estimates

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- no fast-moving dependencies)
