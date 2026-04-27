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

export async function POST(req: NextRequest) {
  // ── Rate limit: 5 submissions per IP per minute ───────────────────────────
  const ip = getClientIp(req);
  if (!checkRateLimit(`deactivate:${ip}`, 5, 60_000)) {
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
    'site_name', 'street_address', 'city', 'state', 'zip_code',
    'pickup_date', 'pickup_window',
    'pickup_contact_name', 'pickup_contact_phone',
    'forklift_at_pickup',
    'return_reason', 'equipment_condition', 'last_use_date',
  ];

  const missing = REQUIRED.filter(f => !required(body[f]));
  if (missing.length > 0) {
    return NextResponse.json({ error: 'Missing required fields.', fields: missing }, { status: 422, headers: corsHeaders() });
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(body.email).trim())) {
    return NextResponse.json({ error: 'Invalid email address.', fields: ['email'] }, { status: 422, headers: corsHeaders() });
  }

  // Require the deactivation-specific webhook. Falling back to MAKE_WEBHOOK_URL
  // (the order webhook) would silently route deactivation requests to the wrong
  // Make.com scenario and corrupt the workflow data.
  const webhookUrl = process.env.MAKE_DEACTIVATE_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[deactivate] MAKE_DEACTIVATE_WEBHOOK_URL is not set — deactivation submissions will fail.');
    return NextResponse.json({ error: 'Deactivation endpoint not configured.' }, { status: 500, headers: corsHeaders() });
  }

  // ── Sanitised payload with field length caps ──────────────────────────────
  const sanitized = {
    full_name:               cap(body.full_name, 200),
    email:                   cap(body.email, 254),
    company:                 cap(body.company, 200),
    phone:                   cap(body.phone, 30),
    cc_emails:               cap(body.cc_emails, 500),
    unit_identifier:         cap(body.unit_identifier, 200),
    quantity:                cap(body.quantity, 10),
    site_name:               cap(body.site_name, 200),
    street_address:          cap(body.street_address, 300),
    city:                    cap(body.city, 100),
    state:                   cap(body.state, 50),
    zip_code:                cap(body.zip_code, 20),
    pickup_date:             cap(body.pickup_date, 20),
    pickup_window:           cap(body.pickup_window, 100),
    pickup_contact_name:     cap(body.pickup_contact_name, 200),
    pickup_contact_phone:    cap(body.pickup_contact_phone, 30),
    forklift_at_pickup:      cap(body.forklift_at_pickup, 100),
    gate_access_instructions: cap(body.gate_access_instructions, 1000),
    return_reason:           cap(body.return_reason, 200),
    equipment_condition:     cap(body.equipment_condition, 200),
    condition_notes:         cap(body.condition_notes, 2000),
    police_report_number:    cap(body.police_report_number, 100),
    last_use_date:           cap(body.last_use_date, 20),
    notes:                   cap(body.notes, 2000),
    additional_pickup_contacts: Array.isArray(body.additional_pickup_contacts)
      ? (body.additional_pickup_contacts as unknown[]).slice(0, 10).map(c =>
          typeof c === 'object' && c !== null
            ? { name: cap((c as any).name, 200), phone: cap((c as any).phone, 30) }
            : {}
        )
      : [],
    form_type:    'deactivation',
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
    console.error('[deactivate] webhook error:', err);
    return NextResponse.json({ error: 'Failed to reach processing endpoint.' }, { status: 502, headers: corsHeaders() });
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders() });
}
