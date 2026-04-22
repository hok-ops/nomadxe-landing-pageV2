/**
 * POST /api/order
 * Server-side proxy — validates payload, forwards to Make.com webhook.
 */
import { NextRequest, NextResponse } from 'next/server';

interface OrderPayload {
  full_name: string; email: string; company: string; phone: string;
  location_name: string; site_type: string;
  street_address: string; city: string; state: string; zip_code: string;
  gps_lat?: string; gps_lng?: string;
  delivery_contacts: string;
  start_date: string; duration: string; trailer_count: string;
  deployment_option: string; technician_setup: string; forklift_available: string;
  notes?: string; additional_recipients?: string;
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  utm_term?: string; utm_content?: string; utm_id?: string;
  [key: string]: string | undefined;
}

const LAT_RE = /^-?(([0-8]?\d(\.\d{1,8})?)|90(\.0{1,8})?)$/;
const LNG_RE = /^-?((1[0-7]\d(\.\d{1,8})?)|([0-9]?\d(\.\d{1,8})?)|180(\.0{1,8})?)$/;

function isValidLat(v: string) { return LAT_RE.test(v.trim()) && Math.abs(parseFloat(v)) <= 90; }
function isValidLng(v: string) { return LNG_RE.test(v.trim()) && Math.abs(parseFloat(v)) <= 180; }
function required(v: unknown): v is string { return typeof v === 'string' && v.trim().length > 0; }

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://nomadxe.com';
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  let body: OrderPayload;
  try { body = await req.json(); }
  catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers: corsHeaders() });
  }

  const requiredFields: string[] = [
    'full_name', 'email', 'company', 'phone',
    'location_name', 'site_type',
    'street_address', 'city', 'state', 'zip_code',
    'delivery_contacts',
    'start_date', 'duration', 'trailer_count',
    'deployment_option', 'technician_setup', 'forklift_available',
  ];

  const missing: string[] = [];
  for (const field of requiredFields) {
    if (!required((body as Record<string, unknown>)[field])) missing.push(field);
  }
  if (missing.length > 0) {
    return NextResponse.json({ error: 'Missing required fields.', fields: missing }, { status: 422, headers: corsHeaders() });
  }

  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/.test(body.email.trim())) {
    return NextResponse.json({ error: 'Invalid email address.', fields: ['email'] }, { status: 422, headers: corsHeaders() });
  }

  if (body.gps_lat && !isValidLat(body.gps_lat)) {
    return NextResponse.json({ error: 'Invalid GPS latitude.', fields: ['gps_lat'] }, { status: 422, headers: corsHeaders() });
  }
  if (body.gps_lng && !isValidLng(body.gps_lng)) {
    return NextResponse.json({ error: 'Invalid GPS longitude.', fields: ['gps_lng'] }, { status: 422, headers: corsHeaders() });
  }

  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[order] MAKE_WEBHOOK_URL env var is not set.');
    return NextResponse.json({ error: 'Webhook endpoint not configured.' }, { status: 500, headers: corsHeaders() });
  }

  let makeRes: Response;
  try {
    makeRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        ...(body.gps_lat ? { gps_lat: parseFloat(body.gps_lat) } : {}),
        ...(body.gps_lng ? { gps_lng: parseFloat(body.gps_lng) } : {}),
        submitted_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error('[order] Webhook fetch failed:', err);
    return NextResponse.json({ error: 'Failed to reach the order processing endpoint.' }, { status: 502, headers: corsHeaders() });
  }

  if (!makeRes.ok) {
    console.error(`[order] Make.com returned ${makeRes.status}`);
    return NextResponse.json({ error: 'Order processor returned an error.' }, { status: 502, headers: corsHeaders() });
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders() });
}
