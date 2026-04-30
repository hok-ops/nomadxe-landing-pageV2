/**
 * POST /api/order
 * Server-side proxy — validates payload, enforces limits, forwards to Make.com webhook.
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { submitPublicForm } from '@/lib/formSubmissions';

interface PhotoAttachment {
  name: string;
  type: string;
  data: string; // base64 data URL
}

interface OrderPayload {
  full_name: string; email: string; company: string; phone: string;
  location_name: string; site_type: string;
  street_address: string; city: string; state: string; zip_code: string;
  gps_lat?: string; gps_lng?: string;
  delivery_contacts: string;
  start_date: string; duration: string; trailer_count: string;
  deployment_option: string; technician_setup: string; forklift_available: string;
  notes?: string; additional_recipients?: string;
  photos?: PhotoAttachment[];
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  utm_term?: string; utm_content?: string; utm_id?: string;
  [key: string]: string | undefined | PhotoAttachment[];
}

const LAT_RE = /^-?(([0-8]?\d(\.\d{1,8})?)|90(\.0{1,8})?)$/;
const LNG_RE = /^-?((1[0-7]\d(\.\d{1,8})?)|([0-9]?\d(\.\d{1,8})?)|180(\.0{1,8})?)$/;

function isValidLat(v: string) { return LAT_RE.test(v.trim()) && Math.abs(parseFloat(v)) <= 90; }
function isValidLng(v: string) { return LNG_RE.test(v.trim()) && Math.abs(parseFloat(v)) <= 180; }
function required(v: unknown): v is string { return typeof v === 'string' && v.trim().length > 0; }

// Truncate a string field to a maximum byte length (protects Make.com payload size)
function cap(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.slice(0, max);
}

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
  // ── Rate limit: 5 submissions per IP per minute ───────────────────────────
  const ip = getClientIp(req);
  if (!checkRateLimit(`order:${ip}`, 5, 60_000)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before submitting again.' },
      { status: 429, headers: corsHeaders() }
    );
  }

  // ── Origin validation (raises the bar for automated abuse) ────────────────
  // Browser clients always send Origin; server-side bots typically don't.
  // Not a complete defense — attackers can spoof Origin — but combined with
  // rate limiting it significantly increases the cost of bulk abuse.
  const origin = req.headers.get('origin') ?? '';
  if (origin && origin !== ALLOWED_ORIGIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

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

  // ── Build sanitised payload with field length caps ─────────────────────────
  // Prevents a malicious actor from forwarding multi-MB strings to Make.com,
  // exhausting operation quotas or triggering downstream timeouts.
  const sanitized = {
    full_name:          cap(body.full_name, 200),
    email:              cap(body.email, 254),
    company:            cap(body.company, 200),
    phone:              cap(body.phone, 30),
    location_name:      cap(body.location_name, 200),
    site_type:          cap(body.site_type, 100),
    street_address:     cap(body.street_address, 300),
    city:               cap(body.city, 100),
    state:              cap(body.state, 50),
    zip_code:           cap(body.zip_code, 20),
    delivery_contacts:  cap(body.delivery_contacts, 500),
    start_date:         cap(body.start_date, 20),
    duration:           cap(body.duration, 100),
    trailer_count:      cap(body.trailer_count, 20),
    deployment_option:  cap(body.deployment_option, 100),
    technician_setup:   cap(body.technician_setup, 100),
    forklift_available: cap(body.forklift_available, 100),
    notes:              cap(body.notes, 2000),
    additional_recipients: cap(body.additional_recipients, 500),
    utm_source:         cap(body.utm_source, 100),
    utm_medium:         cap(body.utm_medium, 100),
    utm_campaign:       cap(body.utm_campaign, 100),
    utm_term:           cap(body.utm_term, 100),
    utm_content:        cap(body.utm_content, 100),
    utm_id:             cap(body.utm_id, 100),
    ...(body.gps_lat ? { gps_lat: parseFloat(body.gps_lat) } : {}),
    ...(body.gps_lng ? { gps_lng: parseFloat(body.gps_lng) } : {}),
    // Photos: validate and pass through base64 attachments (max 4, image types only)
    ...(Array.isArray(body.photos) && body.photos.length > 0 ? {
      photos: (body.photos as PhotoAttachment[])
        .slice(0, 4)
        .filter(p =>
          typeof p.name === 'string' &&
          typeof p.data === 'string' &&
          /^image\/(jpeg|png|webp|heic|heif)$/.test(p.type ?? '') &&
          p.data.startsWith('data:image/')
        )
        .map(p => ({
          name: cap(p.name, 200),
          type: p.type,
          data: p.data.slice(0, 4_000_000), // hard cap at ~3 MB base64 per photo
        })),
    } : {}),
    submitted_at: new Date().toISOString(),
  };

  try {
    const submission = await submitPublicForm({
      formType: 'order',
      payload: sanitized,
      sourceRoute: '/api/order',
      request: req,
    });
    return NextResponse.json({ ok: true, submissionId: submission.id, forwarded: submission.forwarded }, { status: 200, headers: corsHeaders() });
  } catch (err) {
    console.error('[order] submission failed:', err);
    return NextResponse.json({ error: 'Failed to save the order request.' }, { status: 503, headers: corsHeaders() });
  }
}
