import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

const ALLOWED_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://nomadxe.com';

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

function required(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function cap(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.slice(0, max);
}

const LAT_RE = /^-?(([0-8]?\d(\.\d{1,8})?)|90(\.0{1,8})?)$/;
const LNG_RE = /^-?((1[0-7]\d(\.\d{1,8})?)|([0-9]?\d(\.\d{1,8})?)|180(\.0{1,8})?)$/;

export async function POST(req: NextRequest) {
  // ── Rate limit: 5 submissions per IP per minute ───────────────────────────
  const ip = getClientIp(req);
  if (!checkRateLimit(`relocate:${ip}`, 5, 60_000)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before submitting again.' },
      { status: 429, headers: corsHeaders() }
    );
  }

  // ── Origin validation ────────────────────────────────────────────────────
  const origin = req.headers.get('origin') ?? '';
  if (origin && origin !== ALLOWED_ORIGIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers: corsHeaders() });
  }

  const REQUIRED = [
    'full_name', 'email', 'company', 'phone',
    'unit_identifier', 'quantity',
    'origin_site_name', 'origin_street', 'origin_city', 'origin_state', 'origin_zip',
    'origin_contact_name', 'origin_contact_phone', 'forklift_at_origin',
    'dest_site_name', 'dest_site_type', 'dest_street', 'dest_city', 'dest_state', 'dest_zip',
    'dest_contact_name', 'dest_contact_phone', 'forklift_at_dest',
    'move_date', 'move_window', 'recommission_at_dest', 'relocation_reason',
  ];

  const missing = REQUIRED.filter(f => !required(body[f]));
  if (missing.length > 0) {
    return NextResponse.json({ error: 'Missing required fields.', fields: missing }, { status: 422, headers: corsHeaders() });
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(body.email).trim())) {
    return NextResponse.json({ error: 'Invalid email address.', fields: ['email'] }, { status: 422, headers: corsHeaders() });
  }

  const lat = body.dest_gps_lat as string | undefined;
  const lng = body.dest_gps_lng as string | undefined;
  if (lat && (!LAT_RE.test(lat.trim()) || Math.abs(parseFloat(lat)) > 90)) {
    return NextResponse.json({ error: 'Invalid destination latitude.', fields: ['dest_gps_lat'] }, { status: 422, headers: corsHeaders() });
  }
  if (lng && (!LNG_RE.test(lng.trim()) || Math.abs(parseFloat(lng)) > 180)) {
    return NextResponse.json({ error: 'Invalid destination longitude.', fields: ['dest_gps_lng'] }, { status: 422, headers: corsHeaders() });
  }

  const webhookUrl = process.env.MAKE_RELOCATE_WEBHOOK_URL ?? process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[relocate] Neither MAKE_RELOCATE_WEBHOOK_URL nor MAKE_WEBHOOK_URL is set.');
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500, headers: corsHeaders() });
  }

  // ── Sanitised payload with field length caps ──────────────────────────────
  const sanitized = {
    full_name:          cap(body.full_name, 200),
    email:              cap(body.email, 254),
    company:            cap(body.company, 200),
    phone:              cap(body.phone, 30),
    cc_emails:          cap(body.cc_emails, 500),
    unit_identifier:    cap(body.unit_identifier, 200),
    quantity:           cap(body.quantity, 10),
    // Origin site
    origin_site_name:   cap(body.origin_site_name, 200),
    origin_street:      cap(body.origin_street, 300),
    origin_city:        cap(body.origin_city, 100),
    origin_state:       cap(body.origin_state, 50),
    origin_zip:         cap(body.origin_zip, 20),
    origin_contact_name:  cap(body.origin_contact_name, 200),
    origin_contact_phone: cap(body.origin_contact_phone, 30),
    forklift_at_origin: cap(body.forklift_at_origin, 100),
    origin_gate_access: cap(body.origin_gate_access, 1000),
    // Destination site
    dest_site_name:     cap(body.dest_site_name, 200),
    dest_site_type:     cap(body.dest_site_type, 100),
    dest_street:        cap(body.dest_street, 300),
    dest_city:          cap(body.dest_city, 100),
    dest_state:         cap(body.dest_state, 50),
    dest_zip:           cap(body.dest_zip, 20),
    dest_contact_name:  cap(body.dest_contact_name, 200),
    dest_contact_phone: cap(body.dest_contact_phone, 30),
    forklift_at_dest:   cap(body.forklift_at_dest, 100),
    dest_gate_access:   cap(body.dest_gate_access, 1000),
    // Schedule
    move_date:           cap(body.move_date, 20),
    move_window:         cap(body.move_window, 100),
    recommission_at_dest: cap(body.recommission_at_dest, 100),
    relocation_reason:   cap(body.relocation_reason, 200),
    notes:               cap(body.notes, 2000),
    // GPS (parsed to float)
    ...(lat ? { dest_gps_lat: parseFloat(lat) } : {}),
    ...(lng ? { dest_gps_lng: parseFloat(lng) } : {}),
    // Additional contacts (capped array)
    additional_contacts: Array.isArray(body.additional_contacts)
      ? (body.additional_contacts as unknown[]).slice(0, 10).map(c =>
          typeof c === 'object' && c !== null
            ? { name: cap((c as any).name, 200), phone: cap((c as any).phone, 30) }
            : {}
        )
      : [],
    form_type:    'relocation',
    submitted_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sanitized),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Make returned ${res.status}`);
  } catch (err) {
    console.error('[relocate] webhook error:', err);
    return NextResponse.json({ error: 'Failed to reach processing endpoint.' }, { status: 502, headers: corsHeaders() });
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders() });
}
