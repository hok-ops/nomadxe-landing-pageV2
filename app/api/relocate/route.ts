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

const LAT_RE = /^-?(([0-8]?\d(\.\d{1,8})?)|90(\.0{1,8})?)$/;
const LNG_RE = /^-?((1[0-7]\d(\.\d{1,8})?)|([0-9]?\d(\.\d{1,8})?)|180(\.0{1,8})?)$/;

export async function POST(req: NextRequest) {
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

  // Use a dedicated relocation webhook if configured, otherwise fall back to
  // the shared Make.com webhook — form_type: 'relocation' lets Make.com route it.
  const webhookUrl = process.env.MAKE_RELOCATE_WEBHOOK_URL ?? process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[relocate] Neither MAKE_RELOCATE_WEBHOOK_URL nor MAKE_WEBHOOK_URL is set.');
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500, headers: corsHeaders() });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        form_type: 'relocation',
        submitted_at: new Date().toISOString(),
        ...(lat ? { dest_gps_lat: parseFloat(lat) } : {}),
        ...(lng ? { dest_gps_lng: parseFloat(lng) } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Make returned ${res.status}`);
  } catch (err) {
    console.error('[relocate] webhook error:', err);
    return NextResponse.json({ error: 'Failed to reach processing endpoint.' }, { status: 502, headers: corsHeaders() });
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders() });
}
