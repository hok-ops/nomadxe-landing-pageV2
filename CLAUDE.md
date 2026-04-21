# NomadXE V2 — CLAUDE.md

## Essential Commands

```bash
# Development
npm run dev          # starts Next.js dev server (runs env-check.mjs first)

# Build & production
npm run build        # production build (runs env-check.mjs first)
npm run start        # start production server

# Type checking (run before every commit)
npx tsc --noEmit

# Linting
npm run lint
```

> **No test suite.** There are flow docs in `tests/testsprite-flows.md` but no automated test runner.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Auth & DB | Supabase (`@supabase/ssr`) |
| External API | Victron VRM REST API v2 |
| Deployment | Vercel (standalone Next.js output) |
| Animation | GSAP |

---

## Project Structure

```
nomadxe-v2/
├── app/                        # Next.js App Router pages & API routes
│   ├── page.tsx                # Landing page (public)
│   ├── layout.tsx              # Root layout + ThemeProvider + ToastProvider
│   ├── dashboard/
│   │   ├── page.tsx            # Server component — fetches devices + initial VRM data
│   │   └── DashboardClient.tsx # Client component — 30s auto-poll, fleet/detail layout
│   ├── admin/                  # Admin panel (role-gated)
│   │   ├── page.tsx
│   │   ├── actions.ts          # Server Actions: invite user, resend invite
│   │   └── *.tsx               # AssignDeviceForm, RosterTable, etc.
│   ├── auth/
│   │   ├── callback/page.tsx   # Handles PKCE code + implicit hash token exchange
│   │   └── confirm/route.ts    # Server route handler for Supabase redirects
│   ├── activate-account/       # Post-invite account setup (set password)
│   ├── forgot-password/        # OTP-based password reset entry
│   ├── reset-otp/              # OTP code verification step
│   ├── reset-password/         # New password form (after OTP verified)
│   └── api/
│       ├── vrm/[siteId]/
│       │   ├── route.ts        # GET — fetches live data from Victron VRM API
│       │   └── debug/route.ts  # GET — raw diagnostics dump for debugging
│       ├── devices/[siteId]/display-name/route.ts  # PATCH — set custom device label
│       ├── admin/
│       │   ├── generate-link/route.ts   # POST — generate invite/reset link
│       │   ├── assign-device/route.ts   # POST — assign vrm device to user
│       │   └── delete-user/route.ts     # DELETE — remove user
│       └── auth/
│           ├── invite-token/route.ts    # GET — fetch unused invite token (bypasses RLS)
│           ├── use-token/route.ts       # POST — mark token as used
│           └── send-reset/route.ts      # POST — send password reset email
│
├── components/
│   ├── dashboard/
│   │   ├── NomadXECoreView.tsx # Main device detail card — polls VRM every 30s on mount
│   │   ├── FleetTile.tsx       # Compact fleet grid tile
│   │   └── ReadingKey.tsx      # Legend for dashboard readings
│   ├── ThemeProvider.tsx       # light/dark context
│   ├── ThemeToggle.tsx
│   ├── ToastProvider.tsx
│   ├── TwoOptions.tsx          # Landing page pricing/options section
│   ├── Hero.tsx / Features.tsx / HowItWorks.tsx / Manifesto.tsx / UseCases.tsx
│   └── Navbar.tsx / Footer.tsx
│
├── utils/supabase/
│   ├── server.ts               # createClient() — server-side, reads cookies
│   ├── client.ts               # createBrowserClient() — client-side
│   ├── admin.ts                # createAdminClient() — service_role, bypasses RLS
│   └── middleware.ts           # updateSession() — refreshes session on every request
│
├── supabase/migrations/        # Applied manually via Supabase SQL Editor
│   ├── 000_init_vrm.sql        # profiles, vrm_devices, device_assignments
│   ├── 001_add_user_status.sql
│   ├── 002_fix_profile_fk_cascade.sql
│   ├── 003_auth_tokens.sql     # invite/recovery token table
│   ├── 004_security_hardening.sql  # RESTRICTIVE deny RLS on auth_tokens
│   ├── 005_security_advisor_pass2.sql
│   └── 006_device_display_name.sql # display_name column on vrm_devices
│
├── middleware.ts               # Supabase session refresh on every request
├── next.config.mjs             # standalone output, image remote patterns
├── tailwind.config.js
├── scripts/env-check.mjs       # Validates required env vars before dev/build
├── INCIDENT_LOG.md             # Full incident history with root causes + fixes
└── .env.local                  # Local secrets (never committed)
```

---

## Supabase Schema (key tables)

| Table | Purpose |
|---|---|
| `profiles` | `id` (FK → auth.users), `role` (admin/user), `status` |
| `vrm_devices` | `id`, `vrm_site_id`, `name`, `display_name` (nullable override) |
| `device_assignments` | `user_id` FK → profiles, `device_id` FK → vrm_devices |
| `auth_tokens` | `token`, `user_id`, `type` (invite/recovery), `used_at`, `expires_at` |

**RLS note:** `auth_tokens` has a RESTRICTIVE deny policy for `authenticated` and `anon` roles. All token lookups must go through an API route using `adminClient` (service_role key).

---

## Auth Flows

### Invite Flow
1. Admin generates link via `/api/admin/generate-link` → Supabase creates magic link with `?code=` param + `?invite_token=` appended to `redirect_to`
2. User clicks link → lands on `/auth/callback?code=...&invite_token=...`
3. `exchangeCodeForSession(code)` called explicitly (does NOT auto-exchange in `@supabase/ssr`)
4. Redirect to `/auth/setup/[token]` → set password

### Password Reset Flow
1. User submits email at `/forgot-password` → `/api/auth/send-reset` → Supabase sends OTP to email
2. User enters OTP at `/reset-otp` → verified server-side
3. Redirect to `/reset-password` → set new password

---

## Dashboard Data Flow

```
dashboard/page.tsx (Server)
  └─ fetches device assignments via adminClient
  └─ fetches initial VRM data for each device
  └─ renders DashboardClient with devices + initialDataMap

DashboardClient (Client)
  └─ setInterval 30s → pollDevice(siteId) → PATCH dataMap state
  └─ passes dataMap[siteId] as initialData to NomadXECoreView

NomadXECoreView (Client, per selected device)
  └─ polls /api/vrm/[siteId] immediately on mount
  └─ setInterval 30s → direct fetch → setData + setLastPoll
```

**VRM data freshness:** `/api/vrm/[siteId]` fetches `GET /installations/{id}/diagnostics` from the Victron VRM REST API. This endpoint returns *logged* data — it only updates when the physical device pushes telemetry to VRM (typically every 1–5 min depending on device config). The `export const dynamic = 'force-dynamic'` and `cache: 'no-store'` on the internal fetch prevent any Next.js caching.

---

## Environment Variables

Required in `.env.local` (validated by `scripts/env-check.mjs`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # used by adminClient only — never exposed to browser
VICTRON_ADMIN_TOKEN=             # Victron VRM API token
NEXT_PUBLIC_SITE_URL=            # e.g. https://nomadxe.com (used in invite redirect_to)
```

---

## Key Conventions

- **Server vs client split:** Pages under `app/` are server components by default. Add `'use client'` only when needing hooks/interactivity. API routes (`route.ts`) are always server-side.
- **Admin operations always use `adminClient`:** Any DB query that touches `auth_tokens`, cross-user data, or bypasses RLS must use `createAdminClient()` in a server route — never in client code.
- **`createClient()` vs `createAdminClient()`:** `createClient()` reads the current user's session cookie. `createAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses all RLS.
- **No test runner:** Type-check with `npx tsc --noEmit` before committing. Linting with `npm run lint`.
- **Migrations are manual:** Run SQL from `supabase/migrations/` directly in the Supabase SQL Editor. The Supabase CLI is installed but migrations are not auto-applied.
- **Float display:** All wattage values rendered in the UI must use `.toFixed(2)` — raw Victron attribute values contain floating-point imprecision.
- **Device display names:** `vrm_devices.display_name` is a nullable override — `null` means fall back to VRM `name`. Never write to Victron VRM API; local DB only.
