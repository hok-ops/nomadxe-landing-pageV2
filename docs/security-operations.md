# Security Operations

## Immediate controls

- Git remotes must not contain personal access tokens. Use a clean HTTPS remote URL and rely on GitHub credential manager or deploy keys.
- Rotate any token that has appeared in shell output, chat output, screenshots, logs, or git configuration.
- Keep runtime secrets only in Vercel, Supabase, GitHub, or local `.env.local` files.
- Never prefix server-only secrets with `NEXT_PUBLIC_`.

## Required production secrets

- `SUPABASE_SERVICE_ROLE_KEY`
- `VICTRON_ADMIN_TOKEN`
- `TELTONIKA_RMS_API_TOKEN`
- `TELTONIKA_GATEWAY_BEARER_TOKEN`
- `CERBO_INGEST_TOKEN`
- `TELTONIKA_ROUTER_PASSWORD` when native router reports are enabled

## Optional forwarding secrets

- `FORMS_FORWARD_WEBHOOK_URL`
- `ORDER_FORM_FORWARD_WEBHOOK_URL`
- `RELOCATE_FORM_FORWARD_WEBHOOK_URL`
- `DEACTIVATE_FORM_FORWARD_WEBHOOK_URL`
- legacy Make webhook variables, only if an external automation bridge is still needed

## Local file handling

- `.env.local` is ignored and must stay local.
- `.npm-cache/` is ignored and should not be committed.
- `*.tsbuildinfo` is ignored and should not be committed.
- Operational PDFs that contain network or router details should stay local unless intentionally sanitized.

## Cerbo ingest

The Cerbo managed-network endpoint requires:

```http
Authorization: Bearer <CERBO_INGEST_TOKEN>
```

The token must be high entropy, unique to this deployment, and rotated if it is copied into logs, screenshots, tickets, or chat.

## Review checklist before pushing

```powershell
git remote -v
git status --short --ignored
git grep -n -I -E "ghp_|github_pat_|SUPABASE_SERVICE_ROLE_KEY=|VICTRON_ADMIN_TOKEN=|TELTONIKA_RMS_API_TOKEN=|TELTONIKA_GATEWAY_BEARER_TOKEN=|CERBO_INGEST_TOKEN=|MAKE_WEBHOOK_URL=|BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY" HEAD -- .
```
