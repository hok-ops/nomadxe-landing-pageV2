# NomadXE V2 — Incident & Resolution Log

> Comprehensive record of every significant failure, root cause, and resolution across the project lifecycle.
> Organized by domain. Commits referenced by short hash.

---

## Table of Contents

1. [Build & Deployment Failures](#1-build--deployment-failures)
2. [Authentication — Invite Flow](#2-authentication--invite-flow)
3. [Authentication — Password Reset Flow](#3-authentication--password-reset-flow)
4. [Authentication — Session & RLS Issues](#4-authentication--session--rls-issues)
5. [Security Hardening](#5-security-hardening)
6. [Middleware & RBAC](#6-middleware--rbac)
7. [Admin Panel Issues](#7-admin-panel-issues)
8. [Dashboard & Victron Data](#8-dashboard--victron-data)
9. [UI — Contrast & Accessibility](#9-ui--contrast--accessibility)
10. [UI — Light/Dark Theme](#10-uidark-light-theme)
11. [SEO](#11-seo)

---

## 1. Build & Deployment Failures

### 1.1 Unescaped Apostrophes in JSX
**Commit:** `0ddc228`
**Symptom:** Vercel CI build failed on ESLint `react/no-unescaped-entities` rule.
**Cause:** Raw apostrophes in JSX text nodes (e.g. `it's`, `don't`) are treated as invalid HTML by ESLint's JSX parser.
**Fix:** Replaced all offending apostrophes with `&apos;` or `{'\`'}`  HTML entities.

---

### 1.2 Vercel CI — Missing ESLint Config and Type Errors
**Commit:** `86342f3`
**Symptom:** Build passed locally but failed on Vercel with TypeScript and ESLint errors.
**Cause:** Missing `.eslintrc` configuration and unchecked TypeScript types that the local environment was silently ignoring.
**Fix:** Added `.eslintignore`, corrected type annotations, resolved all build-blocking lint errors.

---

### 1.3 styled-jsx in Server Component
**Commit:** `b3e503b`
**Symptom:** Vercel deployment crash: `styled-jsx` cannot be used in a React Server Component.
**Cause:** A component using `<style jsx>` syntax was not marked `'use client'` and was being rendered server-side.
**Fix:** Converted the component to a Client Component with `'use client'` directive, or replaced the style approach with Tailwind classes.

---

### 1.4 Syntax Error in `actions.ts` Broke Build
**Commits:** `c0cc059` → `8f8edbf` (multiple failed attempts) → `2ef8667`
**Symptom:** Entire application failed to build; Vercel reported a JavaScript syntax error on deployment.
**Cause:** A series of inline edits to `actions.ts` introduced mismatched braces and broken async function blocks. Multiple manual patch attempts made it worse.
**Fix:** Full rewrite of `actions.ts` from scratch (`2ef8667`), restoring correct async/await structure and proper error handling.

---

### 1.5 `useSearchParams` Missing Suspense Boundary
**Commit:** `9a8e730`
**Symptom:** Next.js 14 build error: `useSearchParams()` must be wrapped in a Suspense boundary.
**Cause:** Next.js 14 App Router requires any component calling `useSearchParams()` to be wrapped in `<Suspense>` to avoid hydration mismatches during static rendering.
**Fix:** Wrapped the inner component in `<Suspense fallback={...}>` in the page component.

---

### 1.6 Deployment Hang — Stale Route Cache
**Commit:** `3ed0f06`
**Symptom:** After major route restructuring, Vercel served stale pages. New routes returned 404 or the old UI even after successful deployment.
**Cause:** Vercel's edge cache retained the previous route structure. The build output did not invalidate cached route manifests.
**Fix:** Added a cache-busting mechanism and forced a clean deployment by modifying the build configuration to ensure all route manifests were regenerated.

---

### 1.7 Build-Safe Admin Client (Missing Env Vars at Build Time)
**Commit:** `c0a6145`
**Symptom:** Vercel build crashed during static analysis: `SUPABASE_SERVICE_ROLE_KEY is undefined`.
**Cause:** `createAdminClient()` threw immediately if env vars were absent. During Next.js static build phase, server-only env vars like `SUPABASE_SERVICE_ROLE_KEY` are not available.
**Fix:** Added a `NEXT_PHASE` guard in `utils/supabase/admin.ts` — during `phase-production-build`, a placeholder client is returned. At request time with missing keys, an error is logged but the app does not crash.

---

## 2. Authentication — Invite Flow

### 2.1 Initial Invite Flow — Wrong redirectTo
**Commit:** `b721256`
**Symptom:** After clicking an invite email link, user was not redirected to the account setup page.
**Cause:** `redirectTo` in `inviteUserByEmail` pointed to a route that did not exist or was not configured in Supabase's allowed redirect URL list.
**Fix:** Corrected `redirectTo` to `/auth/callback`, which was registered in the Supabase project's allowed URLs, and added PKCE code exchange logic.

---

### 2.2 Invite Flow — auth_tokens Not Being Created
**Commit:** `e46f1e9`
**Symptom:** User completed invite link flow but was not routed to setup page; DB lookup returned nothing.
**Cause:** The `auth_tokens` row for the invited user was never being inserted. `generate-link` was not calling `createAuthToken()` at all — it returned the Supabase action link without creating the application-level token.
**Fix:** Added `createAuthToken()` call inside `generate-link` route, creating the 48-hour invite token immediately after `generateLink()` succeeded.

---

### 2.3 Invite Flow — INITIAL_SESSION Not Handled
**Commit:** `e46f1e9`
**Symptom:** `onAuthStateChange` in `/auth/callback` never fired, causing the 8-second timeout and redirect to the error page.
**Cause:** On first load, Supabase fires `INITIAL_SESSION` (not `SIGNED_IN`) when a session already exists. The callback only listened for `SIGNED_IN`.
**Fix:** Added `INITIAL_SESSION` to the event filter in `onAuthStateChange`.

---

### 2.4 Invite Flow — Hash `type` Param Not Read Reliably
**Commit:** `427d816`
**Symptom:** `/auth/callback` routed users to `/dashboard` instead of the invite setup page.
**Cause:** The `type` parameter (e.g., `type=invite`) was in the URL hash fragment (`#access_token=...&type=invite`). The page was reading it from `searchParams` (query string), which does not contain hash data.
**Fix:** Changed to read `type` from `window.location.hash`, parsed via `URLSearchParams`.

---

### 2.5 Invite Flow — User ID Mismatch When Admin Tests in Own Browser
**Commit:** `7a7aba5`
**Symptom:** When the admin clicked an invite link in their own logged-in browser, the DB lookup for `auth_tokens` found no matching row and the user was sent to the error page.
**Cause:** `getSession()` in `/auth/callback` returned the **admin's** session (user ID `4591a43e`) instead of the invited user's session (`d02aede0`). The `auth_tokens` row was created for the invited user, so the lookup using the admin's session ID returned nothing.
**Fix:** Embedded the `invite_token` directly into the `redirect_to` URL (patching the `action_link`'s query string). `/auth/callback` now reads `invite_token` from URL search params and routes directly to `/auth/setup/[token]` — bypassing the DB lookup entirely when the token is in the URL.

---

### 2.6 Invite Link Broken After Security Hardening (RLS RESTRICTIVE Policy)
**Commits:** `cf759e4` (introduced), `2a3d811` → `074f682` → `1e88fe2` (resolved)
**Symptom:** After migration 004 was applied, invite links stopped working. Users saw "INVALID OR EXPIRED LINK. PLEASE REQUEST A NEW ONE." on the login page.
**Cause (layered):**
  1. Migration 004 added a `RESTRICTIVE USING (false)` RLS policy on `auth_tokens` for `authenticated` and `anon` roles. This blocked ALL client-side queries to the table — including the fallback DB lookup in `/auth/callback`.
  2. When the `invite_token` URL patching was later removed (incorrectly), the only remaining path was the DB fallback, which was now blocked.
  3. `/auth/callback` also never explicitly exchanged the PKCE `?code=` — it called `getSession()` which returned the admin's existing session instead of the invited user's session, causing the token ownership check to fail with "Token does not belong to this user."
**Fix (three commits):**
  - `2a3d811`: Changed `redirectTo` to `/auth/confirm` (server route with `adminClient`) — partially correct direction but broke password reset.
  - `074f682`: Restored `/auth/callback` as `redirectTo`, restored `invite_token` patching, created new server API `GET /api/auth/invite-token?type=` that uses `adminClient` (service_role) to bypass the RLS policy for the DB fallback.
  - `1e88fe2`: Fixed the core session issue — `/auth/callback` now **explicitly** calls `exchangeCodeForSession(code)` for PKCE links or `setSession()` for implicit flow, guaranteeing the invited user's session replaces any existing browser session before routing.

---

### 2.7 "Token Does Not Belong to This User" on Account Setup
**Commit:** `1e88fe2`
**Symptom:** User reached the account setup page, filled in name and password, clicked "Activate Account", and received "Token does not belong to this user".
**Cause:** `/auth/callback` was calling `getSession()` which returned the **admin's existing** browser session. The page never called `exchangeCodeForSession()` to actually exchange the PKCE code for the invited user's session. So when `use-token` ran, `supabase.auth.getUser()` returned the admin's user ID, which did not match the `user_id` on the invite token.
**Fix:** Rewrote `/auth/callback` to explicitly handle three paths:
  1. `?code=` present → `exchangeCodeForSession(code)` → replaces admin session with invited user's session
  2. `#access_token=` in hash → `setSession()` → replaces admin session
  3. Neither → fall back to existing session (normal signed-in redirect)

---

## 3. Authentication — Password Reset Flow

### 3.1 resetPasswordForEmail Failing — Wrong Client
**Commits:** `0f326b2`, `1c59d97`, `ad1beea`
**Symptom:** Password reset emails were not being sent; Supabase returned an auth error.
**Cause:** `resetPasswordForEmail()` was being called with `adminClient` (service_role). This operation is an end-user-facing auth action that must use the **anon key** client, not the service_role client.
**Fix:** After two failed attempts (trying different client configurations), the call was moved into a dedicated API route (`/api/auth/send-reset`) using a plain `createClient(url, anonKey)` with `autoRefreshToken: false`.

---

### 3.2 Password Reset redirectTo — Wrong URL
**Commit:** `5802e0a`
**Symptom:** Clicking the password reset email link did not redirect to the app's reset page.
**Cause:** `redirectTo` was using `process.env.NEXT_PUBLIC_SITE_URL` which was undefined in Server Actions at runtime (client env vars are not available server-side in the same way).
**Fix:** Changed to use `process.env.SITE_URL` (a server-only env var) with `NEXT_PUBLIC_SITE_URL` and hardcoded URL as fallbacks: `process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.nomadxe.com'`.

---

### 3.3 NEXT_PUBLIC_SITE_URL Not Available at Runtime
**Commit:** `a8e99ce`
**Symptom:** After fixing the env var reference, the redirectTo still resolved incorrectly on Vercel.
**Cause:** `NEXT_PUBLIC_SITE_URL` was added to the local `.env.local` but was never added to Vercel's Environment Variables settings.
**Fix:** Added the variable in Vercel Dashboard and triggered a redeploy.

---

### 3.4 OTP Input — Fixed 6-Box Input Rejected Valid Codes
**Commit:** `085a035`
**Symptom:** Users copying their OTP from email could not paste it into the reset form; some codes were longer or shorter than 6 digits.
**Cause:** The reset form used a rigid 6-box digit-by-digit input component. Supabase OTP codes are not always exactly 6 digits, and copy-paste to the fixed boxes did not work reliably.
**Fix:** Replaced the 6-box input with a single text field that accepts any length code.

---

### 3.5 Password Reset redirectTo Changed to /auth/confirm — Broke OTP Flow
**Commits:** `2a3d811` (introduced), `074f682` (fixed)
**Symptom:** Clicking the password reset email link no longer landed on the OTP code entry page. The server route received a hash-based token it couldn't read and redirected to an error.
**Cause:** While attempting to fix the invite link issue, `send-reset/route.ts` had its `redirectTo` changed from `/reset-otp` to `/auth/confirm`. The `/auth/confirm` server route only handles `?code=` and `?token_hash=` query params — it cannot read URL hash fragments (`#access_token=...`), which is what Supabase sends for password reset flows. So the server route saw no params and returned "Invalid reset link."
**Fix:** Restored `redirectTo` in `send-reset/route.ts` to `/reset-otp`, the client-side OTP entry page.

---

## 4. Authentication — Session & RLS Issues

### 4.1 RLS Recursion — Infinite Loop in Admin Check
**Commits:** `38f0f44`, `3e5515d`
**Symptom:** Admin pages timed out or returned 500 errors. Supabase logs showed stack overflow / infinite recursion.
**Cause:** The `profiles` table had an RLS policy that checked `profiles.role = 'admin'` — but reading `profiles` to check the role triggered the policy again, causing infinite recursion.
**Fix:** Replaced the recursive RLS policy with a non-recursive approach using `auth.uid()` directly, and used `adminClient` (service_role, bypasses RLS) for all admin-side profile lookups.

---

### 4.2 Middleware Admin Check — RLS Recursion in Edge Runtime
**Commits:** `bc4d5ef`, `45f73ea`, `c2bd3a4`
**Symptom:** Middleware redirected all users (including admins) to `/login`, making the admin panel inaccessible.
**Cause:** Middleware runs in the Edge Runtime which has limitations. The `createClient` used for the admin role check was triggering the same RLS recursion issue. Additionally, the Edge Runtime does not support all Node.js APIs required by the standard Supabase server client.
**Fix:** Created a minimal `createServerClient` with empty cookie handlers specifically for the middleware admin check, then switched to `adminClient` (service_role) which bypasses RLS entirely and works in Edge Runtime.

---

### 4.3 RESTRICTIVE Deny Policy on auth_tokens Blocked All Client Queries
**Commit:** `cf759e4` (introduced), `074f682` (fixed)
**Symptom:** Any page that queried `auth_tokens` using the regular Supabase client (anon/authenticated role) received no data, silently failing.
**Cause:** Migration 004 added `CREATE POLICY deny_all ON public.auth_tokens AS RESTRICTIVE FOR ALL TO authenticated, anon USING (false)`. A RESTRICTIVE policy overrides all permissive policies — so even authenticated users could not read their own tokens.
**Fix:** All `auth_tokens` queries that need to succeed client-side were redirected through a server API route (`/api/auth/invite-token`) that uses `adminClient` (service_role), which is exempt from RLS policies.

---

### 4.4 Same-Password Restriction on Account Activation
**Commit:** `961e2db`
**Symptom:** New users invited via email could not set their initial password. The activation form returned an error saying the new password must be different from the current password.
**Cause:** Supabase enforces a "cannot reuse current password" rule on `updateUser({ password })`. For a freshly-invited user, Supabase had set a random temporary password internally. When the user tried to set their real password, Supabase occasionally matched it against this internal temporary value.
**Fix:** Changed the activation flow to call `adminClient.auth.admin.updateUserById()` instead of the user-facing `updateUser()`. Admin-side password updates bypass the same-password restriction.

---

## 5. Security Hardening

### 5.1 Privilege Escalation via profileUpdate
**Commit:** `cf759e4`
**Symptom:** (Proactive fix — no live exploit reported.)
**Cause:** The `/api/auth/use-token` route accepted a `profileUpdate` object and wrote all keys directly to the `profiles` table via `adminClient`. A malicious caller could send `{ role: 'admin' }` and self-escalate to admin.
**Fix:** Added an explicit `ALLOWED_PROFILE_FIELDS` whitelist (`full_name`, `is_active`, `status`). All other keys are silently dropped before the DB write.

---

### 5.2 Auth Token Value Leaked in Server Logs
**Commit:** `cf759e4`
**Symptom:** (Proactive fix.)
**Cause:** `generate-link/route.ts` logged `{ token: inviteToken }` — a full 64-character hex secret — to the server console. Server logs on Vercel are accessible to anyone with project access.
**Fix:** Removed the token value from the log line. Only non-sensitive metadata (user ID, type) is now logged.

---

### 5.3 SECURITY DEFINER View Bypassed RLS
**Commit:** `cf759e4`
**Symptom:** (Identified by Supabase Security Advisor.)
**Cause:** `public.vw_client_assignments` was a view with `SECURITY DEFINER`, meaning it ran with the view creator's privileges (bypassing RLS) for all callers including anon users.
**Fix:** Dropped the view. The application was not querying it directly; it was a leftover from an earlier iteration.

---

### 5.4 Mutable search_path in Functions
**Commit:** `8b3a554`
**Symptom:** (Identified by Supabase Security Advisor.)
**Cause:** `is_admin()`, `log_changes()`, and `handle_new_user()` functions did not pin `search_path`. A malicious user could potentially shadow `public` schema objects.
**Fix:** Added `SET search_path = public, pg_catalog` to all affected functions.

---

### 5.5 audit_logs Table Had No RLS Policies
**Commit:** `8b3a554`
**Symptom:** (Identified by Supabase Security Advisor.)
**Cause:** RLS was enabled on `audit_logs` but no policies were defined. Supabase Security Advisor flags this as a potential data exposure (all rows visible or no rows visible depending on interpretation).
**Fix:** Added an explicit `RESTRICTIVE USING (false)` deny policy for `authenticated` and `anon` roles. Service_role (used by all server-side audit writes) bypasses RLS.

---

### 5.6 profileUpdate Allowed on Recovery Tokens
**Commit:** `cf759e4`
**Symptom:** (Proactive fix.)
**Cause:** The `use-token` API accepted `profileUpdate` for any token type. Recovery tokens are for password reset only — allowing profile updates on them was an unintended attack surface.
**Fix:** Added a guard rejecting `profileUpdate` when `type !== 'invite'`.

---

## 6. Middleware & RBAC

### 6.1 Middleware Bounced All Users — RBAC Not Working
**Commits:** `420381a`, `36c4090`
**Symptom:** All authenticated users (including admins) were redirected to `/login` by middleware.
**Cause:** The middleware role check used a client that triggered RLS recursion (see §4.2). The role query returned no data, so everyone was treated as unauthenticated.
**Fix:** Replaced the recursive client with `adminClient` (service_role) in the middleware role check.

---

### 6.2 `confirm()` Called in Server Component — ReferenceError Crash
**Commit:** `30c5c23`
**Symptom:** Admin panel crashed with `ReferenceError: confirm is not defined`.
**Cause:** A delete button used `window.confirm()` inline inside a Server Component. `window` does not exist in the Node.js server environment.
**Fix:** Extracted the delete button into a separate `'use client'` component where `window.confirm()` is valid.

---

## 7. Admin Panel Issues

### 7.1 Admin Auth Guard Too Permissive
**Commit:** `f540320`
**Symptom:** Non-admin users could access admin API routes by making direct fetch requests.
**Cause:** Some admin API routes checked for an active session but did not verify the `role` field in `profiles`.
**Fix:** Added explicit role check via `adminClient` in all admin-gated routes: fetch `profiles.role` for the current user; return 403 if not `'admin'`.

---

### 7.2 Form userId Fields Not Populated
**Commit:** `f540320`
**Symptom:** Admin forms for user management submitted with empty `userId`, causing server-side errors.
**Cause:** Hidden `userId` inputs in admin forms were not being populated from the server-rendered user list.
**Fix:** Ensured `userId` is passed as a prop from the server component and rendered as a hidden input value.

---

### 7.3 Landing Page — Inaccurate Marketing Copy
**Commits:** `3a2930f`, `a5030c5`
**Symptom:** Option 01 on the landing page referenced "platform connectivity" — a feature NomadXE does not offer.
**Cause:** Copy written without final product spec confirmation.
**Fix:** Removed the inaccurate claim. Revised surrounding copy for accuracy and marketing impact.

---

## 8. Dashboard & Victron Data

### 8.1 VRM API Auth Header Incorrect
**Commit:** `a33d0b5`
**Symptom:** All Victron VRM API calls returned 401 Unauthorized.
**Cause:** The API request used the wrong header format for the VRM bearer token.
**Fix:** Corrected the `Authorization` header to match Victron's VRM API spec.

---

### 8.2 VRM Attribute IDs Mapped Incorrectly
**Commit:** `30cff95`
**Symptom:** Dashboard showed `undefined` or `0` for all solar, battery, and DC load readings.
**Cause:** The attribute ID mapping used assumed/guessed numeric IDs. The actual IDs returned by the live VRM API were different.
**Fix:** Added a debug route to capture the live VRM response, then remapped all attribute IDs to match the actual values returned by the production VRM installation.

---

### 8.3 Dashboard Architecture Mismatch — AC vs DC
**Commit:** `1471f66`
**Symptom:** Dashboard displayed AC grid, inverter, and AC load panels that were always empty or irrelevant.
**Cause:** The dashboard was designed for a standard solar + grid + AC load system. NomadXE trailers are DC-only — they have a solar panel, battery bank, and DC loads with no AC grid connection.
**Fix:** Redesigned the dashboard to show only DC-relevant panels: solar input, battery state of charge, DC load output, and charge direction indicators.

---

### 8.4 Solar Surplus and DC Load Reported Incorrectly
**Commit:** `29c3774`
**Symptom:** Solar surplus showed negative values; DC load read 0 when the trailer was actively drawing power.
**Cause:** The surplus calculation subtracted in the wrong order. DC load was reading from an attribute that reported the charger's perspective (negative when charging) rather than the load perspective.
**Fix:** Corrected the surplus formula; remapped DC load to the correct VRM attribute that reports consumption as a positive value.

---

### 8.5 Poll Interval and Manual Refresh
**Commit:** `1017d69`
**Symptom:** (Feature request) Dashboard auto-refreshed every 30 seconds, causing noticeable flicker and unnecessary API calls.
**Fix:** Changed the poll interval from 30 seconds to 5 minutes. Added a manual "Refresh" button with a `useTransition` spinner so users can force an immediate update. The button is disabled and shows "Updating…" while the refresh is in progress.

---

## 9. UI — Contrast & Accessibility

### 9.1 WCAG AA Contrast Failures Across Dashboard and Admin
**Commit:** `4d0fcdc`
**Symptom:** Text and UI elements failed WCAG AA contrast ratio (minimum 4.5:1 for normal text).
**Cause:** Many colors used opacity variants on dark backgrounds (e.g. `text-[#93c5fd]/30`) which were too faint. Green-500 (`#22c55e`) on white is only 2.5:1 contrast.
**Fix:** Systematically audited all color usages. Replaced failing combinations with solid higher-contrast alternatives: green-500 → green-600, muted text opacity levels mapped to fixed slate values (`#64748b`, `#475569`, `#334155`).

---

### 9.2 Light Mode — Fleet Tile Inline Colors Invisible
**Commit:** `d072a49`
**Symptom:** In light mode, battery SOC bars, solar watt readings, and charge direction indicators were invisible or extremely faint on white backgrounds.
**Cause:** The components used inline `style={{ color: '#22c55e' }}` props. CSS `[data-theme="light"]` overrides cannot target inline styles — `!important` on a CSS rule does not override a `style` attribute.
**Fix:** Modified `FleetTile.tsx` and `NomadXECoreView.tsx` to call `useTheme()` and conditionally provide different color values based on `isLight`: e.g. `isLight ? '#16a34a' : '#22c55e'`.

---

### 9.3 Light Mode — Muted Text Still Too Faint (Second Pass)
**Commit:** `d072a49`
**Symptom:** After initial light mode implementation, muted text using `/30`–`/45` opacity values was still unreadable.
**Cause:** The first pass mapped opacity-based blue variants to `#1e40af` at low opacity, which was still below 4.5:1 on white.
**Fix:** Replaced all opacity-based muted text with solid slate-family values on a fixed scale: `/30-/45` → `#64748b` (4.6:1), `/50-/60` → `#475569` (6.1:1), `/65-/75` → `#334155` (8.0:1), `/80` → `#1e293b`.

---

## 10. UI — Light/Dark Theme

### 10.1 Theme Toggle — Anti-Flash
**Commit:** `cae19c0`
**Symptom:** On page load, the theme briefly flashed the wrong color scheme (white flash before dark theme applied).
**Cause:** React renders on the client after the initial HTML paint. If `localStorage` is read in a `useEffect`, the correct theme is applied after the flash.
**Fix:** Added an inline `<script>` in `<head>` that runs before React hydration, reading `localStorage` and setting `data-theme` on `<html>` immediately. Also added `suppressHydrationWarning` on `<html>` to prevent React from complaining about the server/client attribute mismatch.

---

### 10.2 Hover Color Too Light in Light Mode
**Commits:** `e2d63f6`, `7e5db23`
**Symptom:** Hovering over Power Base Readings fleet tiles showed a barely-visible highlight.
**Cause:** The initial light mode hover override used `#eff6ff` (blue-50) which was near-white and invisible on a white background.
**Fix (two passes):** First pass changed to blue-100 (`#dbeafe`); second pass darkened further after user feedback.

---

## 11. SEO

### 11.1 Not Appearing in Search Results for "Mobile Security Trailers"
**Commit:** `28d4886`
**Symptom:** NomadXE did not appear on the first page of Google results for core search terms.
**Cause:** No structured data (JSON-LD), weak metadata, generic page title, no sitemap `lastModified` dates, and no `robots.txt` disallow rules to concentrate crawl budget.
**Fix:**
- Added 4 JSON-LD schemas: `Organization`, `LocalBusiness+SecurityService`, `WebSite`, `FAQPage` (6 Q&As targeting real search queries)
- Rewrote `<title>` to "Mobile Security Trailers | NomadXE Surveillance Solutions"
- Added 15 targeted keywords, OpenGraph image, absolute canonical URL
- Changed `sitemap.ts` from `new Date()` (dynamic, ignored by Google) to static dates
- Added `robots.ts` with `disallow` for `/dashboard/`, `/admin/`, `/api/`, `/auth/` to focus crawl budget on public pages

---

## Summary Table

| # | Area | Root Cause Category | Commits |
|---|------|-------------------|---------|
| 1.1–1.7 | Build/Deploy | ESLint, types, Edge Runtime, env vars, cache | `0ddc228` `86342f3` `b3e503b` `2ef8667` `9a8e730` `3ed0f06` `c0a6145` |
| 2.1–2.7 | Invite Auth | redirectTo, session mismatch, RLS, PKCE exchange | `b721256` `e46f1e9` `427d816` `7a7aba5` `cf759e4` `074f682` `1e88fe2` |
| 3.1–3.5 | Password Reset | Wrong client, env vars, OTP input, redirectTo regression | `0f326b2` `ad1beea` `5802e0a` `085a035` `074f682` |
| 4.1–4.4 | Session/RLS | Recursion, RESTRICTIVE policy, same-password | `38f0f44` `c2bd3a4` `cf759e4` `074f682` `961e2db` |
| 5.1–5.6 | Security | Privilege escalation, log leak, SECURITY DEFINER, search_path | `cf759e4` `8b3a554` |
| 6.1–6.2 | Middleware/RBAC | Edge Runtime, server-only browser APIs | `420381a` `30c5c23` |
| 7.1–7.3 | Admin Panel | Auth guards, form fields, copy accuracy | `f540320` `3a2930f` `a5030c5` |
| 8.1–8.5 | Dashboard/VRM | API auth, attribute IDs, DC architecture, calculations | `a33d0b5` `30cff95` `1471f66` `29c3774` `1017d69` |
| 9.1–9.3 | Contrast/A11y | Inline styles bypass CSS, opacity-based colors | `4d0fcdc` `d072a49` |
| 10.1–10.2 | Theme Toggle | Anti-flash, hover visibility | `cae19c0` `e2d63f6` `7e5db23` |
| 11.1 | SEO | No structured data, weak metadata, crawl budget | `28d4886` |
