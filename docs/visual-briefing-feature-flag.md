# Visual Briefing Feature Flag

The Visual Briefing / Flipbook-style dashboard experiment is additive and reversible.

## Enable

Set this environment variable in Vercel:

```text
NEXT_PUBLIC_VISUAL_BRIEFING=true
```

When enabled, each opened trailer's Asset Intelligence panel shows a `Visual Briefing` button. The briefing uses current VRM, readiness, network, alarm, and recommendation data to render deterministic visual frames.

## Disable / Roll Back

Remove the variable or set it to anything other than `true`:

```text
NEXT_PUBLIC_VISUAL_BRIEFING=false
```

No database migration is required. No customer workflow, ticket action, lease state, or router access path depends on the feature.

## Safety Rules

- The generated-looking frames are rendered by React from structured data.
- The frame text and numbers come from existing dashboard telemetry and intelligence scoring.
- The feature does not call image/video generation APIs.
- The feature does not create tickets, change leases, open routers, or update Supabase records.
- The existing dashboard remains the source of truth.

## Why This Is Not Full Pixel Streaming Yet

Full Flipbook-style pixel streaming is currently expensive, difficult to make accessible, and not deterministic enough for an operational customer portal. This implementation captures the useful interaction pattern while preserving security, reversibility, and readability.
