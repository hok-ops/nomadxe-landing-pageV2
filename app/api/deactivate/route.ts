import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(req: NextRequest) {
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

  const webhookUrl = process.env.MAKE_DEACTIVATE_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[deactivate] MAKE_DEACTIVATE_WEBHOOK_URL not set.');
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500, headers: corsHeaders() });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, form_type: 'deactivation', submitted_at: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`Make returned ${res.status}`);
  } catch (err) {
    console.error('[deactivate] webhook error:', err);
    return NextResponse.json({ error: 'Failed to reach processing endpoint.' }, { status: 502, headers: corsHeaders() });
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders() });
}
