/**
 * POST /api/order
 *
 * Headless API proxy — receives the order form JSON from the browser,
 * validates the payload server-side, then forwards it to the Make.com
 * webhook. Keeping the webhook URL in an env var means it never reaches
 * the client bundle.
 *
 * ─── CORS (Make.com side) ──────────────────────────────────────────────────
 * Because this route is a server-side proxy the browser NEVER contacts
 * Make.com directly, so Make.com itself doesn't need CORS headers.
 *
 * If you ever switch back to a direct browser → Make.com call you must add
 * an HTTP Response module in Make.com *before* the webhook trigger and set:
 *
 *   Access-Control-Allow-Origin:  https://nomadxe.com
 *   Access-Control-Allow-Methods: POST, OPTIONS
 *   Access-Control-Allow-Headers: Content-Type
 *
 * Restrict the origin to `https://nomadxe.com` only — never use `*` in
 * production as that allows any site to trigger your workflow.
 *
 * For the server-side proxy (current approach) you control CORS on THIS
 * route instead, which is handled below.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderPayload {
  // Contact
  full_name: string;
  email: string;
  company: string;
  phone?: string;

  // Site details
  site_type: string;
  site_address: string;
  gps_lat: string;
  gps_lng: string;

  // Deployment
  start_date: string;
  duration: string;
  trailer_count: string;
  deployment_option: string;

  // Optional
  notes?: string;

  // UTM / attribution (all optional — captured from URL on page load)
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  utm_id?: string;
  [key: string]: string | undefined; // allows arbitrary extra UTM params
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Decimal-degree coordinate regex — accepts up to 8 decimal places. */
const LAT_RE = /^-?(([0-8]?\d(\.\d{1,8})?)|90(\.0{1,8})?)$/;
const LNG_RE = /^-?((1[0-7]\d(\.\d{1,8})?)|([0-9]?\d(\.\d{1,8})?)|180(\.0{1,8})?)$/;

function isValidLat(v: string) {
  return LAT_RE.test(v.trim()) && Math.abs(parseFloat(v)) <= 90;
}
function isValidLng(v: string) {
  return LNG_RE.test(v.trim()) && Math.abs(parseFloat(v)) <= 180;
}

function required(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

// ---------------------------------------------------------------------------
// CORS helper (restricts browser pre-flight to nomadxe.com)
// ---------------------------------------------------------------------------

const ALLOWED_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://nomadxe.com';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Handle browser pre-flight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // ── 1. Parse body ────────────────────────────────────────────────────────
  let body: OrderPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body.' },
      { status: 400, headers: corsHeaders() }
    );
  }

  // ── 2. Required-field validation ─────────────────────────────────────────
  const missing: string[] = [];
  const requiredFields: string[] = [
    'full_name',
    'email',
    'company',
    'site_type',
    'site_address',
    'start_date',
    'duration',
    'trailer_count',
    'deployment_option',
  ];

  for (const field of requiredFields) {
    if (!required((body as Record<string, unknown>)[field])) missing.push(field);
  }

  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'Missing required fields.', fields: missing },
      { status: 422, headers: corsHeaders() }
    );
  }

  // ── 3. GPS coordinate validation (optional fields) ───────────────────────
  if (body.gps_lat && !isValidLat(body.gps_lat)) {
    return NextResponse.json(
      {
        error: 'Invalid GPS latitude. Expected decimal degrees between -90 and 90 (e.g. 40.7128).',
        fields: ['gps_lat'],
      },
      { status: 422, headers: corsHeaders() }
    );
  }

  if (body.gps_lng && !isValidLng(body.gps_lng)) {
    return NextResponse.json(
      {
        error:
          'Invalid GPS longitude. Expected decimal degrees between -180 and 180 (e.g. -74.0060).',
        fields: ['gps_lng'],
      },
      { status: 422, headers: corsHeaders() }
    );
  }

  // ── 4. Email format sanity check ─────────────────────────────────────────
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return NextResponse.json(
      { error: 'Invalid email address.', fields: ['email'] },
      { status: 422, headers: corsHeaders() }
    );
  }

  // ── 5. Forward to Make.com webhook ───────────────────────────────────────
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error('[order] MAKE_WEBHOOK_URL env var is not set.');
    return NextResponse.json(
      { error: 'Webhook endpoint not configured. Contact the site administrator.' },
      { status: 500, headers: corsHeaders() }
    );
  }

  let makeRes: Response;
  try {
    makeRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        // Normalise coordinates to numbers when provided
        ...(body.gps_lat ? { gps_lat: parseFloat(body.gps_lat) } : {}),
        ...(body.gps_lng ? { gps_lng: parseFloat(body.gps_lng) } : {}),
        // ISO timestamp of submission
        submitted_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error('[order] Webhook fetch failed:', err);
    return NextResponse.json(
      { error: 'Failed to reach the order processing endpoint. Please try again.' },
      { status: 502, headers: corsHeaders() }
    );
  }

  if (!makeRes.ok) {
    console.error(`[order] Make.com returned ${makeRes.status}`);
    return NextResponse.json(
      { error: 'Order processor returned an error. Please try again.' },
      { status: 502, headers: corsHeaders() }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders() });
}
