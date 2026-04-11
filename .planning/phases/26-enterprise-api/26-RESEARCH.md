# Phase 26: Enterprise API - Research

**Researched:** 2026-04-10
**Domain:** REST API design, API key authentication, webhook delivery, rate limiting
**Confidence:** HIGH

## Summary

Phase 26 adds a programmatic REST API for Enterprise tier users. The existing architecture already has all the backend functionality needed (FastAPI validates datasets, generates reports, exports data) -- the main work is adding an API key authentication layer, public-facing API routes that bypass cookie-based auth, and a webhook notification system.

The key architectural insight is that the FastAPI backend already uses a Supabase service role key (bypassing RLS). The new Enterprise API routes on the Next.js side need a parallel auth path: instead of cookie-based Supabase sessions, they authenticate via API key in the `Authorization` header, look up the associated org, verify enterprise tier, then proxy to the same FastAPI endpoints. This keeps the FastAPI backend unchanged and centralises all auth logic in Next.js.

**Primary recommendation:** Add API key auth as a Next.js middleware/helper that sits alongside the existing `requireOrgRole` pattern, store API keys as SHA-256 hashes in a `api_keys` table, and implement webhooks as a simple Supabase-triggered fetch with exponential backoff retries.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SUBS-05 | API access for Enterprise tier | Tier check against `profiles.plan = 'enterprise'` using existing `TIER_LIMITS` system |
| EAPI-01 | REST API for programmatic file upload and validation | New `/api/v1/external/*` routes that proxy to existing FastAPI endpoints with API key auth |
| EAPI-02 | API key management in settings | `api_keys` table with SHA-256 hashed keys, CRUD UI in settings page |
| EAPI-03 | Fetch validation results and reports via API | JSON result endpoint + PDF report proxy, both using API key auth |
| EAPI-04 | Webhook notifications (validation complete, QC failed) | `webhook_endpoints` table + `webhook_deliveries` table with Supabase Realtime trigger |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| crypto (Node.js built-in) | N/A | SHA-256 hashing for API keys, secure random key generation | No external deps needed for key generation/hashing |
| Next.js Route Handlers | 16.x | Public API endpoints with API key auth | Already the project's API layer |
| FastAPI | existing | Backend validation/report/export processing | Already handles all processing -- no changes needed |
| Supabase | existing | API keys table, webhook endpoints table, Realtime for triggers | Already the communication bus |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Upstash Redis (optional) | latest | Rate limiting with sliding window | Only if in-memory rate limiting proves insufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SHA-256 key hashing | bcrypt | bcrypt is slower (good for passwords) but SHA-256 is standard for API keys since keys are high-entropy random strings, not guessable passwords |
| In-process rate limiter | Upstash Redis | Redis adds a dependency but enables distributed rate limiting across Vercel serverless functions; start simple with in-memory Map |
| Supabase Vault | Custom api_keys table | Vault is more secure but complex; custom table with SHA-256 hash is standard and simpler for this use case |
| Database trigger for webhooks | Application-level dispatch | DB trigger couples webhook logic to PostgreSQL; application-level dispatch in the validation background task is simpler and more testable |

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    api-auth.ts              # API key verification helper (resolveApiKey)
    api-rate-limit.ts        # In-memory rate limiter
  app/
    api/
      v1/                    # Public Enterprise API routes
        upload/route.ts      # File upload via API key
        validate/route.ts    # Trigger validation via API key
        results/[runId]/route.ts  # Fetch validation results as JSON
        reports/[runId]/route.ts  # Download PDF report
        webhooks/route.ts    # Webhook endpoint CRUD
      api-keys/route.ts      # API key management (generate, list, revoke)
  components/
    settings/
      api-keys-section.tsx   # API key management UI
      webhook-settings.tsx   # Webhook URL configuration UI

supabase/
  migrations/
    00013_api_keys.sql       # api_keys + webhook tables

backend/
  (no changes needed -- FastAPI endpoints already exist)
```

### Pattern 1: Dual Auth Path
**What:** API routes check for API key first (Authorization: Bearer tk_...), fall back to cookie-based Supabase session. This allows the same endpoint structure to serve both UI users and API consumers.
**When to use:** All Enterprise API routes.
**Example:**
```typescript
// src/lib/api-auth.ts
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

interface ApiKeyResult {
  orgId: string
  userId: string  // the key owner
  keyId: string
}

export async function resolveApiKey(
  request: Request
): Promise<ApiKeyResult | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer tk_')) return null

  const rawKey = authHeader.slice(7) // remove "Bearer "
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: apiKey } = await supabaseAdmin
    .from('api_keys')
    .select('id, org_id, user_id, revoked_at')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .single()

  if (!apiKey) return null

  // Verify enterprise tier
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', apiKey.user_id)
    .single()

  if (profile?.plan !== 'enterprise') return null

  // Update last_used_at
  await supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)

  return {
    orgId: apiKey.org_id,
    userId: apiKey.user_id,
    keyId: apiKey.id,
  }
}
```

### Pattern 2: API Key Generation
**What:** Generate a cryptographically random key with a `tk_` prefix, store only the SHA-256 hash. Show the raw key exactly once at creation time.
**When to use:** Key creation endpoint.
**Example:**
```typescript
// Generate key
const rawKey = `tk_${crypto.randomBytes(32).toString('hex')}` // tk_ + 64 hex chars
const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
const keyPrefix = rawKey.slice(0, 11) // "tk_" + first 8 hex chars for display

// Store hash + prefix in DB, return raw key once
await supabaseAdmin.from('api_keys').insert({
  org_id: orgId,
  user_id: userId,
  key_hash: keyHash,
  key_prefix: keyPrefix,
  name: keyName,
})

// Return rawKey to user (ONLY time it's visible)
return { key: rawKey, prefix: keyPrefix }
```

### Pattern 3: Webhook Dispatch from Validation Background Task
**What:** After validation completes or fails in the FastAPI background task, dispatch webhook notifications. Since FastAPI already updates dataset status via Supabase, add a webhook dispatch step.
**When to use:** After validation_runs insert and dataset status update.
**Example:**
```python
# In FastAPI validation background task, after updating dataset status:
def dispatch_webhooks(dataset_id: str, event: str, payload: dict):
    """Fire webhooks for the dataset's org."""
    supabase = get_supabase_client()
    
    # Get org_id from dataset -> job -> project chain
    ds = supabase.table("datasets").select("id, jobs(project_id, projects(org_id))").eq("id", dataset_id).single().execute()
    org_id = ds.data["jobs"]["projects"]["org_id"]
    
    # Get active webhook endpoints for this org
    endpoints = supabase.table("webhook_endpoints").select("*").eq("org_id", org_id).eq("active", True).execute()
    
    for endpoint in endpoints.data:
        # Create delivery record
        delivery_id = str(uuid.uuid4())
        supabase.table("webhook_deliveries").insert({
            "id": delivery_id,
            "endpoint_id": endpoint["id"],
            "event": event,
            "payload": payload,
            "status": "pending",
        }).execute()
        
        # Attempt delivery with retries
        _deliver_webhook(delivery_id, endpoint["url"], endpoint["secret"], event, payload)
```

### Pattern 4: Simple Rate Limiting
**What:** In-memory sliding window rate limiter per API key. Enterprise tier gets generous limits (e.g. 100 requests/minute).
**When to use:** Applied before any API key-authenticated request.
**Example:**
```typescript
// src/lib/api-rate-limit.ts
const windows = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMIT = 100 // requests per window
const WINDOW_MS = 60_000 // 1 minute

export function checkRateLimit(keyId: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const window = windows.get(keyId)

  if (!window || now > window.resetAt) {
    windows.set(keyId, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT - 1 }
  }

  if (window.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 }
  }

  window.count++
  return { allowed: true, remaining: RATE_LIMIT - window.count }
}
```

### Anti-Patterns to Avoid
- **Storing raw API keys:** Never store the actual key. Store SHA-256 hash only. The key is shown once at creation.
- **Putting API key auth in FastAPI:** Keep all auth in Next.js. FastAPI uses the service role key and trusts the proxy. Adding auth to both layers creates maintenance burden.
- **Synchronous webhook delivery:** Never block the validation response waiting for webhooks. Dispatch async after the main work completes.
- **Unlimited retries for webhooks:** Cap at 5 attempts with exponential backoff. After that, mark as failed and let the user see delivery status in the UI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cryptographic key generation | Custom random string | `crypto.randomBytes(32)` | Cryptographically secure randomness is essential |
| Key hashing | Custom hash function | `crypto.createHash('sha256')` | Standard, fast, well-audited |
| Webhook signature | Custom signing | HMAC-SHA256 with shared secret | Industry standard (Stripe, GitHub use same pattern) |
| PDF report generation | New report endpoint | Existing FastAPI `/api/v1/report/pdf/{run_id}` | Already built in Phase 19/24 |
| File upload processing | New upload pipeline | Existing FastAPI parse/validate endpoints | Already built in Phase 3-5 |

**Key insight:** The entire backend processing pipeline already exists. This phase is purely about adding an authentication layer and notification system on top.

## Common Pitfalls

### Pitfall 1: API Key Timing Attacks
**What goes wrong:** Comparing API key hashes with string equality (`===`) leaks timing information about how many characters match.
**Why it happens:** JavaScript string comparison short-circuits on first mismatch.
**How to avoid:** Use `crypto.timingSafeEqual()` for hash comparison, or rely on database lookup (which is inherently constant-time for the hash column).
**Warning signs:** Using `===` to compare hashes directly in application code.

### Pitfall 2: Forgetting to Scope API Access to the Org
**What goes wrong:** API key owner can access datasets from other organisations.
**Why it happens:** Not filtering queries by org_id after API key verification.
**How to avoid:** Every API endpoint must filter by the org_id from the resolved API key. Use the service role Supabase client (bypasses RLS) but explicitly add `.eq('org_id', orgId)` filters.
**Warning signs:** API endpoints that don't reference orgId from the resolved key.

### Pitfall 3: Webhook Secret Not Used for Signing
**What goes wrong:** Consumers can't verify webhook payloads are genuinely from TruQC.
**Why it happens:** Skipping HMAC signature in webhook delivery.
**How to avoid:** Sign every webhook payload with HMAC-SHA256 using a per-endpoint secret. Include the signature in a `X-TruQC-Signature` header.
**Warning signs:** Webhook delivery without signature headers.

### Pitfall 4: Rate Limiter State Lost on Serverless Cold Start
**What goes wrong:** In-memory rate limit map resets when Vercel spins up a new function instance.
**Why it happens:** Serverless functions are stateless.
**How to avoid:** For MVP, the in-memory approach is acceptable -- it still provides protection within a single instance. If abuse occurs, upgrade to Upstash Redis. Document this as a known limitation.
**Warning signs:** Rate limits not being enforced during high traffic across multiple serverless instances.

### Pitfall 5: File Upload via API Needs Multipart Handling
**What goes wrong:** API file upload endpoint doesn't properly handle multipart/form-data.
**Why it happens:** Most API endpoints use JSON bodies; file upload is different.
**How to avoid:** Use `request.formData()` in the Next.js route handler to extract the uploaded file, then forward to Supabase Storage and create dataset records using the same pattern as the existing upload flow.
**Warning signs:** Trying to send files as base64 JSON (wasteful) instead of multipart.

## Code Examples

### Database Schema for API Keys and Webhooks
```sql
-- Migration: 00013_api_keys.sql

-- API Keys table
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,  -- "tk_xxxxxxxx" for display
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook endpoints table
CREATE TABLE public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,  -- HMAC signing secret
  events TEXT[] NOT NULL DEFAULT '{validation.completed,validation.failed}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery log
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  response_status INT,
  response_body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- API keys: admin can manage
CREATE POLICY "Admins can manage api keys"
  ON public.api_keys FOR ALL
  USING (get_user_org_role(org_id) = 'admin');

-- Webhook endpoints: admin can manage
CREATE POLICY "Admins can manage webhooks"
  ON public.webhook_endpoints FOR ALL
  USING (get_user_org_role(org_id) = 'admin');

-- Webhook deliveries: admin can view
CREATE POLICY "Admins can view deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.webhook_endpoints we
      WHERE we.id = webhook_deliveries.endpoint_id
      AND get_user_org_role(we.org_id) = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_org_id ON public.api_keys(org_id);
CREATE INDEX idx_webhook_endpoints_org_id ON public.webhook_endpoints(org_id);
CREATE INDEX idx_webhook_deliveries_endpoint_id ON public.webhook_deliveries(endpoint_id);
CREATE INDEX idx_webhook_deliveries_status ON public.webhook_deliveries(status);
```

### Webhook Signing Pattern
```typescript
// Sign payload with HMAC-SHA256
import crypto from 'crypto'

function signWebhookPayload(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

// Send webhook with signature
async function deliverWebhook(
  url: string,
  secret: string,
  event: string,
  data: Record<string, unknown>
): Promise<{ status: number; body: string }> {
  const payload = JSON.stringify({
    event,
    data,
    timestamp: new Date().toISOString(),
  })

  const signature = signWebhookPayload(payload, secret)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-TruQC-Signature': `sha256=${signature}`,
      'X-TruQC-Event': event,
    },
    body: payload,
    signal: AbortSignal.timeout(10_000), // 10s timeout
  })

  return {
    status: response.status,
    body: await response.text(),
  }
}
```

### API Route Pattern (Enterprise Endpoint)
```typescript
// src/app/api/v1/results/[runId]/route.ts
import { NextResponse } from 'next/server'
import { resolveApiKey } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/api-rate-limit'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  // 1. Authenticate via API key
  const apiKey = await resolveApiKey(request)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Invalid or missing API key' },
      { status: 401 }
    )
  }

  // 2. Rate limit
  const rateResult = checkRateLimit(apiKey.keyId)
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  // 3. Fetch data (service role client, manual org scoping)
  const { runId } = await params
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: run } = await supabaseAdmin
    .from('validation_runs')
    .select('*, datasets!inner(id, job_id, jobs!inner(project_id, projects!inner(org_id)))')
    .eq('id', runId)
    .single()

  if (!run || run.datasets.jobs.projects.org_id !== apiKey.orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 4. Fetch issues
  const { data: issues } = await supabaseAdmin
    .from('validation_issues')
    .select('*')
    .eq('run_id', runId)
    .order('row_number')

  // 5. Return structured JSON
  return NextResponse.json({
    run_id: run.id,
    dataset_id: run.dataset_id,
    status: run.status,
    total_issues: run.total_issues,
    critical_count: run.critical_count,
    warning_count: run.warning_count,
    info_count: run.info_count,
    pass_rate: run.pass_rate,
    created_at: run.run_at,
    issues: (issues ?? []).map(i => ({
      row_number: i.row_number,
      column_name: i.column_name,
      rule_type: i.rule_type,
      severity: i.severity,
      message: i.message,
      expected: i.expected,
      actual: i.actual,
    })),
  }, {
    headers: {
      'X-RateLimit-Remaining': String(rateResult.remaining),
    }
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API keys in plain text DB | SHA-256 hashed, prefix-only display | Standard practice | Keys secure even if DB leaked |
| Webhook without signing | HMAC-SHA256 signed payloads | Stripe/GitHub standard | Consumers can verify authenticity |
| API auth via query params | Bearer token in Authorization header | OAuth2 standard | Prevents key leakage in logs/URLs |
| Single API key per user | Multiple named keys per org | Current SaaS pattern | Granular rotation, revocation |

## Open Questions

1. **Webhook retry mechanism in serverless context**
   - What we know: Vercel functions have 10s-60s timeout limits. Multi-retry with exponential backoff needs a long-running process.
   - What's unclear: Whether FastAPI background tasks (Railway) or a Supabase Edge Function should handle retries.
   - Recommendation: Do webhook dispatch from the FastAPI background task (which already runs long for validation). It has no timeout constraints on Railway. Retry up to 3 times with 5s/30s/120s delays within the same background task execution.

2. **API key scoping granularity**
   - What we know: Enterprise users need org-scoped API access.
   - What's unclear: Whether keys should have per-permission scopes (read-only vs read-write) for MVP.
   - Recommendation: Start with full org access for all keys. Add scoped permissions in a future iteration if customers request it.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend), Jest (frontend -- existing stubs) |
| Config file | backend/pytest.ini (if exists), or pytest defaults |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EAPI-01 | API key auth resolves org from hashed key | unit | `cd backend && python -m pytest tests/test_api_auth.py -x` | No -- Wave 0 |
| EAPI-01 | Upload endpoint accepts file via API key | integration | Manual via curl | N/A |
| EAPI-02 | API key generation produces hash + prefix | unit | Test in Next.js action test or backend | No -- Wave 0 |
| EAPI-03 | Results endpoint returns structured JSON | integration | Manual via curl | N/A |
| EAPI-04 | Webhook delivery sends signed payload | unit | `cd backend && python -m pytest tests/test_webhooks.py -x` | No -- Wave 0 |
| EAPI-04 | Webhook retries on failure | unit | `cd backend && python -m pytest tests/test_webhooks.py -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** Quick pytest run for changed modules
- **Per wave merge:** Full backend test suite
- **Phase gate:** Full suite green + manual curl test of all API endpoints

### Wave 0 Gaps
- [ ] `backend/tests/test_webhooks.py` -- webhook dispatch, signing, retry logic
- [ ] Test for API key hash verification logic (can be in Next.js or backend)
- [ ] Manual test script (curl commands) for all Enterprise API endpoints

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/app/api/validate/route.ts`, `src/lib/permissions.ts`, `backend/app/routers/validation.py` -- current auth and proxy patterns
- Existing codebase: `supabase/migrations/00012_organisations.sql` -- org/RLS architecture
- Existing codebase: `src/lib/usage.ts` -- tier enforcement patterns
- Node.js crypto docs -- SHA-256 hashing, randomBytes, HMAC

### Secondary (MEDIUM confidence)
- [MakerKit: Supabase API Key Management](https://makerkit.dev/blog/tutorials/supabase-api-key-management) -- API key table patterns with bcrypt/SHA-256
- [Supabase: User API Keys Gist](https://gist.github.com/j4w8n/25d233194877f69c1cbf211de729afb2) -- Vault-based approach (more complex than needed)
- [FastAPI Security First Steps](https://fastapi.tiangolo.com/tutorial/security/first-steps/) -- Bearer token patterns
- [Hookdeck: Webhook Retry Best Practices](https://hookdeck.com/outpost/guides/outbound-webhook-retry-best-practices) -- Exponential backoff, circuit breaker patterns

### Tertiary (LOW confidence)
- In-memory rate limiting on Vercel serverless -- unclear how well Map state persists across invocations within the same instance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- using only Node.js built-ins and existing project infrastructure
- Architecture: HIGH -- pattern directly mirrors existing auth proxy pattern in codebase
- Pitfalls: HIGH -- well-documented security concerns for API key systems
- Webhooks: MEDIUM -- retry strategy in serverless context needs validation during implementation

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable domain, no fast-moving dependencies)
