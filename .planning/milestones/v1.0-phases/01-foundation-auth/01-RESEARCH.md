# Phase 1: Foundation & Auth - Research

**Researched:** 2026-03-10
**Domain:** Next.js App Router + Supabase Auth + shadcn/ui Design System
**Confidence:** HIGH

## Summary

Phase 1 establishes the greenfield project: Next.js with App Router, Supabase Auth (email/password with email verification, session persistence, logout, password reset), a collapsible sidebar + top bar app shell using shadcn/ui, and the brand design system (Deep Blue, Teal, Orange). The technology choices are well-documented and the integration patterns between Next.js App Router and Supabase Auth via `@supabase/ssr` are mature and officially supported.

The key architectural decisions are: (1) use `@supabase/ssr` (not the deprecated `@supabase/auth-helpers-nextjs`) for cookie-based server-side auth, (2) use `getUser()` not `getSession()` for server-side auth checks (security requirement), (3) use Next.js middleware to refresh auth tokens on every request, and (4) use shadcn/ui's built-in Sidebar component for the collapsible sidebar layout.

**Primary recommendation:** Scaffold with `create-next-app` (App Router, TypeScript, Tailwind CSS, `src/` directory), initialize shadcn/ui, install `@supabase/ssr` + `@supabase/supabase-js`, then build auth flows before the app shell.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Sidebar + top bar layout: left sidebar for main navigation, top bar for breadcrumbs and actions
- Sidebar is collapsible: full labels to icon-only mode; auto-collapses on tablet
- Top bar contains: breadcrumb trail (left), notification bell (right), user avatar/dropdown (right)
- Split-screen auth pages: form on left, brand visual/tagline on right
- Separate routes: /login and /signup (distinct pages)
- Inline validation errors below fields
- Email verification required after signup
- Component library: shadcn/ui (Radix + Tailwind CSS)
- Color mapping: Deep Blue (#1E3A8A) = primary, Teal (#14B8A6) = success, Orange (#F97316) = warnings/CTAs
- Typography: Inter font
- Light mode only for MVP
- Background: #F8FAFC
- Phase 1 dashboard: welcome message only, no project UI
- Sidebar shows only: Dashboard + Settings in Phase 1
- No disabled/greyed-out future features

### Claude's Discretion
- Loading skeleton design for auth pages
- Exact spacing, padding, and typography scale
- Error state handling for auth failures (toast vs inline for server errors)
- Notification bell placeholder behavior (no notifications until Phase 7)
- Settings page content for Phase 1 (profile info, password change)
- Database schema design for users/profiles tables

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can sign up with email and password | Supabase `signUp()` with email/password, email verification via `verifyOtp()` callback route |
| AUTH-02 | User can log in and stay logged in across sessions | Supabase `signInWithPassword()` + `@supabase/ssr` cookie-based sessions + middleware token refresh |
| AUTH-03 | User can log out from any page | Supabase `signOut()` + redirect to /login, available via user dropdown in top bar |
| AUTH-04 | User can reset password via email link | Supabase `resetPasswordForEmail()` with `redirectTo` + `updateUser()` for new password |
| UIDE-01 | Platform has vibrant professional design (Deep Blue, Teal, Orange) | shadcn/ui with custom Tailwind theme tokens, Inter font via next/font |
| UIDE-02 | Responsive layout on desktop and tablet | shadcn/ui Sidebar with `collapsible="icon"` mode, auto-collapse on tablet breakpoints |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.x (latest stable, >= 15.2.3) | React framework with App Router | Official Supabase SSR support, Vercel deployment target. Use 15.x not 16.x for stability -- 16 is very new (Dec 2025) |
| react / react-dom | 19.x | UI library | Ships with Next.js 15 |
| @supabase/supabase-js | latest | Supabase client SDK | Required for all Supabase operations |
| @supabase/ssr | latest | SSR cookie-based auth | Official replacement for deprecated @supabase/auth-helpers-nextjs |
| tailwindcss | 4.x | Utility-first CSS | Ships with create-next-app, shadcn/ui requires it |
| typescript | 5.x | Type safety | Ships with create-next-app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui (CLI) | latest | Component primitives (Radix + Tailwind) | All UI components -- not installed as dependency, components are copied into project |
| lucide-react | latest | Icon library | shadcn/ui default icon library, used in sidebar, buttons, nav |
| next/font | (built-in) | Font optimization | Inter font loading with display swap |
| clsx + tailwind-merge | latest | Conditional class names | shadcn/ui installs these via its `cn()` utility |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next.js 15 | Next.js 16 | 16 released Dec 2025, very new. 15.x is battle-tested and has identical App Router/auth patterns. Upgrade to 16 later if needed |
| @supabase/ssr | @supabase/auth-helpers-nextjs | auth-helpers is DEPRECATED. Do not use. @supabase/ssr is the official replacement |
| shadcn/ui | Chakra UI, MUI | User decision locked: shadcn/ui chosen. Correct choice for Tailwind-first apps |

**Installation:**
```bash
npx create-next-app@latest surveyqc --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd surveyqc
npx shadcn@latest init
npm install @supabase/supabase-js @supabase/ssr
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (auth)/              # Route group for auth pages (no layout nesting with dashboard)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   ├── update-password/
│   │   │   └── page.tsx
│   │   └── layout.tsx       # Split-screen auth layout (form left, brand right)
│   ├── (dashboard)/         # Route group for authenticated pages
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── layout.tsx       # App shell layout (sidebar + top bar + content)
│   ├── auth/
│   │   ├── callback/
│   │   │   └── route.ts     # Email verification + password reset callback handler
│   │   └── error/
│   │       └── page.tsx     # Auth error display page
│   ├── layout.tsx           # Root layout (html, body, Inter font, metadata)
│   └── page.tsx             # Root redirect (to /dashboard if authed, /login if not)
├── components/
│   ├── ui/                  # shadcn/ui generated components (Button, Input, etc.)
│   ├── app-sidebar.tsx      # Sidebar configuration (nav items, user menu)
│   ├── top-bar.tsx          # Top bar (breadcrumbs, notification bell, user avatar)
│   └── auth/                # Auth-specific components (login form, signup form)
├── lib/
│   ├── supabase/
│   │   ├── client.ts        # Browser client (createBrowserClient)
│   │   └── server.ts        # Server client (createServerClient)
│   └── utils.ts             # cn() utility (installed by shadcn/ui)
├── hooks/                   # Custom React hooks
└── types/                   # TypeScript type definitions
middleware.ts                # Auth token refresh middleware (MUST be at src root or project root)
```

### Pattern 1: Supabase Client Creation (Browser)
**What:** Singleton browser client for Client Components
**When to use:** Any Client Component that needs Supabase
**Example:**
```typescript
// src/lib/supabase/client.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Pattern 2: Supabase Client Creation (Server)
**What:** Per-request server client for Server Components, Server Actions, Route Handlers
**When to use:** Any server-side code that needs Supabase
**Example:**
```typescript
// src/lib/supabase/server.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}
```

### Pattern 3: Middleware for Session Refresh
**What:** Refreshes auth tokens on every request via middleware
**When to use:** REQUIRED -- without this, sessions expire and Server Components get stale tokens
**Example:**
```typescript
// src/middleware.ts (or middleware.ts at project root)
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: use getUser() not getSession() for security
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from protected routes
  if (!user && !request.nextUrl.pathname.startsWith('/login')
      && !request.nextUrl.pathname.startsWith('/signup')
      && !request.nextUrl.pathname.startsWith('/forgot-password')
      && !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && (request.nextUrl.pathname.startsWith('/login')
      || request.nextUrl.pathname.startsWith('/signup'))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Pattern 4: Email Verification Callback Route
**What:** Handles the link users click in verification/reset emails
**When to use:** Required for email verification and password reset flows
**Example:**
```typescript
// src/app/auth/callback/route.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      redirect(next)
    }
  }

  redirect('/auth/error')
}
```

### Pattern 5: Password Reset Flow
**What:** Two-step process: request reset email, then update password
**When to use:** AUTH-04 requirement
**Example:**
```typescript
// Step 1: Request password reset (on forgot-password page)
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
})

// Step 2: Update password (on update-password page, user arrives via callback)
const { error } = await supabase.auth.updateUser({
  password: newPassword,
})
```

### Pattern 6: App Shell Layout with shadcn/ui Sidebar
**What:** Dashboard layout with collapsible sidebar
**When to use:** All authenticated pages
**Example:**
```tsx
// src/app/(dashboard)/layout.tsx
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { TopBar } from "@/components/top-bar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <TopBar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

### Anti-Patterns to Avoid
- **Using `getSession()` on the server:** Security risk. The JWT is not revalidated. Always use `getUser()` which makes a round-trip to the Supabase Auth server.
- **Using `@supabase/auth-helpers-nextjs`:** Deprecated package. Use `@supabase/ssr` instead.
- **Skipping middleware:** Without middleware, auth tokens are not refreshed per-request. Server Components will get stale/expired tokens.
- **Putting auth logic only in layouts:** Layouts don't re-render on navigation in App Router. Use middleware for route protection, not layout-level checks alone.
- **Storing auth state in React context:** Supabase handles session state via cookies. Don't duplicate it in React state/context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth session management | Custom cookie/JWT handling | `@supabase/ssr` middleware pattern | Token refresh, cookie sync between server/client, PKCE flow are complex |
| Form validation | Custom validation logic | HTML5 validation + Supabase error responses | Auth forms are simple (email + password); inline errors from Supabase suffice |
| Sidebar navigation | Custom sidebar from scratch | shadcn/ui `Sidebar` component | Built-in collapsible modes, mobile sheet, sticky header/footer, accessible |
| Icon system | Custom SVG management | `lucide-react` | shadcn/ui default, tree-shakeable, consistent sizing |
| CSS utility merging | Manual className concatenation | `cn()` from shadcn/ui (clsx + tailwind-merge) | Handles Tailwind class conflicts correctly |
| User profile sync | Manual profile creation after signup | PostgreSQL trigger on auth.users INSERT | Trigger fires atomically; client-side creation can fail/orphan |

**Key insight:** Supabase + shadcn/ui handle 90% of this phase's complexity. The main engineering work is wiring them together correctly, not building from scratch.

## Common Pitfalls

### Pitfall 1: getSession() on Server
**What goes wrong:** Using `getSession()` in Server Components or middleware gives you unvalidated JWT data. An attacker could forge a session.
**Why it happens:** `getSession()` only checks JWT format/expiry, does not verify with the auth server.
**How to avoid:** Always use `getUser()` for any server-side auth check. `getSession()` is only acceptable on the client.
**Warning signs:** Supabase logs a warning if you use `getSession()` in server contexts.

### Pitfall 2: Missing Middleware
**What goes wrong:** Auth tokens expire, Server Components fail silently or return null user.
**Why it happens:** Without middleware calling `getUser()`, the auth cookie isn't refreshed between requests.
**How to avoid:** Always include the middleware with the matcher pattern that covers all routes except static assets.
**Warning signs:** Users get randomly logged out, or server-side auth checks fail intermittently.

### Pitfall 3: Cookie setAll Errors in Server Components
**What goes wrong:** Error when Supabase tries to set cookies in a Server Component (read-only context).
**Why it happens:** Server Components cannot modify cookies. Only middleware and Route Handlers can.
**How to avoid:** The `try/catch` in the server client's `setAll` is intentional. The middleware handles the actual cookie writing.
**Warning signs:** Console errors about cookie setting -- these are expected and handled by the pattern.

### Pitfall 4: Redirect URL Not Configured in Supabase Dashboard
**What goes wrong:** Email verification and password reset links don't work or redirect to wrong URL.
**Why it happens:** Supabase requires explicit Redirect URL allowlisting in the dashboard.
**How to avoid:** Add `http://localhost:3000/auth/callback` (dev) and your production URL to Supabase > Auth > URL Configuration > Redirect URLs.
**Warning signs:** Email links lead to "invalid redirect" errors.

### Pitfall 5: Email Templates Not Customized
**What goes wrong:** Default Supabase email templates use `{{ .ConfirmationURL }}` which may not route through your app's callback handler correctly.
**Why it happens:** Default templates use a direct Supabase URL; for PKCE flow with Next.js, you need `token_hash` based templates.
**How to avoid:** Customize email templates in Supabase Dashboard > Auth > Email Templates to use `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup` (and similar for recovery).
**Warning signs:** Verification clicks don't land on your app, or land without valid tokens.

### Pitfall 6: Next.js Middleware Security (CVE-2025-29927)
**What goes wrong:** Middleware auth bypass via `x-middleware-subrequest` header.
**Why it happens:** Vulnerability in Next.js versions before 15.2.3.
**How to avoid:** Use Next.js >= 15.2.3. This is patched in all current versions.
**Warning signs:** N/A if using current version.

### Pitfall 7: Font Loading with Tailwind v4
**What goes wrong:** Inter font not applying to Tailwind utility classes.
**Why it happens:** Tailwind v4 uses CSS-based `@theme` configuration instead of JavaScript config. Font CSS variables need to be mapped in CSS, not tailwind.config.js.
**How to avoid:** Use `next/font/google` to load Inter with `variable: '--font-sans'`, then map it in your CSS with `@theme { --font-sans: var(--font-sans); }`.
**Warning signs:** Font shows as system default despite importing Inter.

## Code Examples

### Supabase Signup with Email Verification
```typescript
// Source: https://supabase.com/docs/guides/auth/passwords
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })
  if (error) {
    return { error: error.message }
  }
  // User created -- show "check your email" message
  redirect('/login?message=Check your email to verify your account')
}
```

### Supabase Login
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) {
    return { error: error.message }
  }
  redirect('/dashboard')
}
```

### Supabase Logout
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

### Database Schema: Profiles Table with Trigger
```sql
-- Source: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
-- Create profiles table in public schema
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### Tailwind Theme Configuration (CSS-based for v4)
```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  --color-primary: #1E3A8A;        /* Deep Blue */
  --color-primary-foreground: #FFFFFF;
  --color-secondary: #14B8A6;      /* Teal */
  --color-secondary-foreground: #FFFFFF;
  --color-accent: #F97316;         /* Orange */
  --color-accent-foreground: #FFFFFF;
  --color-background: #F8FAFC;
  --color-foreground: #0F172A;
  --font-sans: var(--font-inter);
}
```

### shadcn/ui Components to Install
```bash
# Core components needed for Phase 1
npx shadcn@latest add button input label card sidebar
npx shadcn@latest add dropdown-menu avatar separator breadcrumb
npx shadcn@latest add form                    # If using react-hook-form (optional)
npx shadcn@latest add sonner                  # Toast notifications for server errors
npx shadcn@latest add skeleton                # Loading states
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | auth-helpers deprecated; ssr is the only supported path |
| `getSession()` for server auth | `getUser()` for server auth | 2024 | Security fix; getSession doesn't validate JWT authenticity |
| Tailwind config in JS (v3) | CSS-based @theme (v4) | 2025 | Font/color config moves from tailwind.config.js to globals.css |
| Pages Router | App Router | Next.js 13+ | App Router is default; all Supabase docs target it |
| Manual sidebar | shadcn/ui Sidebar component | 2024 | Full-featured sidebar with collapsible modes, mobile support |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`. No future updates.
- `tailwind.config.js` theme extensions: Still works in v4 but CSS @theme is preferred.
- `supabase.auth.getSession()` on server: Still works but logs security warnings. Use `getUser()`.

## Open Questions

1. **Tailwind v3 vs v4 with shadcn/ui**
   - What we know: Next.js 15 ships with Tailwind v4. shadcn/ui supports both v3 and v4.
   - What's unclear: shadcn/ui init may default to v3 config style. Need to verify during setup whether `shadcn@latest init` generates v4-compatible CSS or v3-style tailwind.config.
   - Recommendation: Accept whatever shadcn/ui generates during init. If it generates v3-style config, that still works fine. Don't fight the tooling.

2. **Supabase Email Rate Limits in Development**
   - What we know: Supabase free tier has email sending limits (4 emails/hour for new projects).
   - What's unclear: Exact current limits may have changed.
   - Recommendation: Use Supabase Dashboard > Auth > Users to manually confirm users during development if rate-limited. Or use Inbucket (Supabase local dev).

3. **`getClaims()` vs `getUser()`**
   - What we know: Supabase recently introduced `getClaims()` as a faster alternative to `getUser()` that validates JWT claims without a network round-trip.
   - What's unclear: Whether this is stable/recommended for production in Next.js middleware.
   - Recommendation: Stick with `getUser()` for now. It's documented, battle-tested, and the minor latency is acceptable. Revisit `getClaims()` if performance becomes an issue.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (recommended for Next.js) or Jest |
| Config file | None -- Wave 0 must create |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Signup creates user and sends verification email | integration | `npx vitest run tests/auth/signup.test.ts -t "signup"` | No -- Wave 0 |
| AUTH-02 | Login returns session, session persists via cookies | integration | `npx vitest run tests/auth/login.test.ts -t "login"` | No -- Wave 0 |
| AUTH-03 | Logout clears session and redirects | integration | `npx vitest run tests/auth/logout.test.ts -t "logout"` | No -- Wave 0 |
| AUTH-04 | Password reset email sent, new password accepted | integration | `npx vitest run tests/auth/reset.test.ts -t "reset"` | No -- Wave 0 |
| UIDE-01 | Brand colors applied to components | unit | `npx vitest run tests/ui/theme.test.ts -t "theme"` | No -- Wave 0 |
| UIDE-02 | Sidebar collapses on tablet, layout responsive | manual-only | Manual browser testing at tablet breakpoints | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- Vitest configuration for Next.js (with @vitejs/plugin-react)
- [ ] `tests/setup.ts` -- Test setup with Supabase mocks
- [ ] `tests/auth/` -- Auth test directory structure
- [ ] `tests/ui/` -- UI test directory structure
- [ ] Install: `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom`

## Sources

### Primary (HIGH confidence)
- [Supabase Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) -- Complete SSR setup guide, middleware pattern, client creation
- [Supabase Auth getUser() reference](https://supabase.com/docs/reference/javascript/auth-getuser) -- Security guidance on getUser vs getSession
- [shadcn/ui Sidebar component](https://ui.shadcn.com/docs/components/radix/sidebar) -- Sidebar API, collapsible modes, layout patterns
- [shadcn/ui Next.js installation](https://ui.shadcn.com/docs/installation/next) -- Init command, component installation
- [Next.js Project Structure](https://nextjs.org/docs/app/getting-started/project-structure) -- App Router conventions

### Secondary (MEDIUM confidence)
- [Supabase auth-js issue #898](https://github.com/supabase/auth-js/issues/898) -- getUser vs getSession security discussion
- [CVE-2025-29927 postmortem](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass) -- Middleware bypass patched in 15.2.3+
- [Tailwind v4 font setup guides](https://www.buildwithmatija.com/blog/how-to-use-custom-google-fonts-in-next-js-15-and-tailwind-v4) -- CSS @theme font configuration

### Tertiary (LOW confidence)
- getClaims() as getUser() alternative -- mentioned in GitHub discussions, not yet in official Next.js guides. Needs validation before adoption.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries are official/documented with clear integration guides
- Architecture: HIGH -- Supabase + Next.js App Router pattern is mature with official examples
- Pitfalls: HIGH -- well-documented in official docs and community discussions
- Design system: HIGH -- shadcn/ui sidebar component matches exact requirements (collapsible icon mode)
- Testing: MEDIUM -- test approach is standard but no existing infrastructure to verify against

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable ecosystem, 30 days)
