---
name: design-system
description: DataFlow design system — fonts, colors, layout patterns, component conventions for all pages
type: reference
---

# DataFlow Design System

## Typography
- **Headings:** Space Grotesk (400–700) via `var(--font-heading)` — techy, distinctive
- **Body:** DM Sans (400, 500, 700) via `var(--font-body)` — clean, readable
- CSS: `h1-h6` auto-use heading font via globals.css `@layer base`
- Heading style: `font-bold tracking-tight` for h1, `font-semibold` for h2/section titles
- Body: default weight, `text-sm` for most UI text, `text-xs` for labels/meta

## Color Palette
| Role | Hex | Usage |
|------|-----|-------|
| Foreground | `#0F172A` (slate-900) | Text, dark UI elements, active nav pills, featured cards |
| Background | `#FAFAFA` | Page background |
| Card | `#FFFFFF` | Card surfaces |
| Muted | `#F5F5F5` | Subtle backgrounds, inactive states |
| Muted-foreground | `#737373` | Secondary text, labels |
| Border | `#E5E5E5` | Card/section borders |
| Primary | `#1E3A8A` | Brand blue (used sparingly) |
| Accent colors (icons/badges): |
| - Blue | `bg-blue-50 text-blue-600` | Upload, Convert |
| - Emerald | `bg-emerald-50 text-emerald-600` | Validation, success states |
| - Teal | `bg-teal-50 text-teal-600` | Transform, data ops |
| - Amber | `bg-amber-50 text-amber-600` | Reports, warnings |
| - Violet | `bg-violet-50 text-violet-600` | Visualize, creative tools |
| - Red | `bg-red-50 text-red-500` | Errors, destructive |

## Layout
- **No sidebar** — top navbar with sticky positioning + backdrop blur
- **Content area:** `max-w-7xl mx-auto px-6 py-6`
- **Cards:** `rounded-2xl border bg-card` with `hover:shadow-sm` transition
- **Bento grid:** Varied card sizes using CSS grid (`grid-cols-2 lg:grid-cols-4` etc.)
- **Spacing:** `space-y-6` between major sections, `gap-4` between grid items

## Navigation (TopNavbar)
- Logo + brand name left
- Main nav links as pills: active = `bg-foreground text-background`, inactive = `text-muted-foreground hover:bg-muted/60`
- Tools in a dropdown
- Right side: notification bell (disabled), settings gear, user avatar (User icon, not initials)
- Avatar: `bg-foreground text-background` with lucide `User` icon

## Component Patterns

### Stat Cards (Bento)
- Colored icon in rounded-xl container (e.g., `bg-blue-50 text-blue-600`)
- Large number: `text-3xl font-extrabold tracking-tighter`
- Label below: `text-xs font-medium text-muted-foreground`

### Featured Card (dark)
- `bg-foreground text-background` with decorative circle overlay
- Used for key metrics (validation rate %)
- Progress bar: `bg-white/10` track, colored fill

### Activity/List Items
- Clickable rows: `rounded-xl px-3 py-2.5 hover:bg-muted/60`
- Status icons: colored circles (emerald=success, red=error, muted=pending)
- Status badges: `rounded-md px-1.5 py-0.5 text-[10px] font-semibold` with colored bg

### Quick Actions
- 2x2 grid of dashed-border cards
- Colored icon circles, label below
- `border-dashed border-border/60` → `hover:border-solid hover:shadow-sm`

### Tool Rows
- Icon in colored rounded-lg, title + description, optional "Soon" badge
- Same hover as activity items

### Buttons
- Primary CTA: `bg-foreground text-background rounded-xl font-semibold`
- Ghost/secondary: standard shadcn variants

## Loading Screen
- Centered logo with `animate-logo-breathe` (scale pulse)
- Sliding progress bar (`animate-loading-slide`)
- Minimal "Loading" text in muted color
- Used as Next.js `loading.tsx` in dashboard route group

## Animation
- `animate-fade-up`: 0.35s ease-out, translateY(8px) → 0
- Staggered delays: `[animation-delay:80ms]`, `160ms`, `240ms` with `[animation-fill-mode:backwards]`
- `dashboard-enter`: 0.5s fade+slide for splash→dashboard transition
- Hover transitions: `transition-colors`, `transition-all`, `hover:shadow-sm`

## Anti-patterns (avoid)
- No gradient hero blocks
- No sidebar navigation
- No initials in avatars — use User icon
- No "Soon" badges on live tools
- No heavy shadows — subtle `hover:shadow-sm` only
- No emoji in UI
