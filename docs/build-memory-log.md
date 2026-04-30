# NomadXE Build Memory Log

This log captures durable decisions and lessons so future AI sessions do not have to rediscover them.

## 2026-04-29 Native Intake And Router Reporting

### Accomplished

- Moved public form handling toward first-party storage.
  - Contact, order, relocation, and deactivation routes now save sanitized submissions into `public.public_form_submissions`.
  - Make/Formspree are no longer required for a form submission to survive.
  - Optional forwarding remains available through `FORMS_FORWARD_WEBHOOK_URL`, form-specific forwarding variables, or legacy Make URLs.
- Added a locked-down Supabase migration for `public_form_submissions`.
  - RLS is enabled.
  - Direct inserts, updates, and deletes are revoked from `anon` and `authenticated`.
  - Admin users can read submissions through policy-gated select access.
- Added an admin Form Intake panel.
  - Admins can see the latest first-party form submissions in the Operations Console.
- Refactored network scan ingestion into `lib/networkScanIngest.ts`.
  - The public `/api/cerbo/network-scan` route now only authenticates the bearer token and delegates to the shared ingestion function.
  - Native server routes can write router reports without making an internal HTTP call back into the app.
- Added native Teltonika router report collection.
  - The dashboard router network report button now attempts direct Teltonika collection before falling back to Make.
  - The native path logs into `/api/login`, reads `/api/modems/status`, stores cellular metrics, and probes configurable LAN inventory endpoints.
  - `TELTONIKA_ROUTER_PASSWORD` is required for the native router path. `TELTONIKA_ROUTER_USERNAME` defaults to `admin`.
  - `TELTONIKA_LAN_CLIENTS_PATHS` can override the LAN endpoint probe list once the exact RutOS client endpoint is verified.
- Updated environment validation.
  - `MAKE_WEBHOOK_URL` is no longer a required secret.
  - Router and forwarding variables are treated as optional feature flags instead of build blockers.

### Valuable Lessons

- Make is useful as an operations bridge, but it should not be the source of truth for customer requests or telemetry.
- Router reporting belongs inside NomadXE because it needs security controls, rate limits, audit events, and stable database writes.
- The known-working Teltonika flow is:
  - `POST /api/login` with top-level `{ "username": "...", "password": "..." }`
  - `GET /api/modems/status` with `Authorization: Bearer <token>`
- `/ubus` returned WebUI HTML in this environment and should not be used for this router-report path unless firmware/API configuration changes.
- Keep router URLs and secrets out of chat, docs, and client code. Store them server-side only.
- Supabase service-role writes should stay in server routes or server-only libraries. Public clients should never receive service keys.
- When adding intelligence features, prefer a durable ledger plus clear admin visibility over one-off external automations.

### Open Verification Items

- Verify the best Teltonika LAN inventory endpoint for the deployed RUT firmware.
- Set `TELTONIKA_ROUTER_PASSWORD` in Vercel Production and Preview if native router collection should run after deploy.
- Apply migration `00000000000017_public_form_submissions.sql` to Supabase before relying on first-party form storage in production.
- Decide whether optional form notifications should go to email, Make, or a future internal task queue.

## 2026-04-29 Supabase Free Plan Constraint

### Accomplished

- Confirmed the Supabase Free plan has tight database/storage quotas compared with paid plans.
- Patched first-party form storage so image data URLs are redacted before insertion into `public_form_submissions`.
- Optional downstream forwarding can still receive the original payload, but the Supabase database stores only photo metadata and an approximate byte count.

### Valuable Lessons

- Never store customer photo uploads as base64 inside Postgres JSONB on a free-plan database.
- Use Postgres for durable form records and searchable metadata; use object storage for binary evidence when photo retention becomes necessary.
- For the current build, telemetry reports and text form submissions are lightweight enough for the free tier, but unlimited historical retention is not. Add pruning or archiving before scale.
