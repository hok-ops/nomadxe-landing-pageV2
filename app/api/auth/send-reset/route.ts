import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

// Strict RFC-5321-compatible email pattern (same as order/deactivate routes)
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;

export async function POST(request: NextRequest) {
  // ── Rate limit: 3 requests per IP per minute ─────────────────────────────────
  const ip = getClientIp(request);
  if (!checkRateLimit(`send-reset:${ip}`, 3, 60_000)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before requesting another reset.' },
      { status: 429 }
    );
  }

  let email: string | undefined;
  try {
    email = (await request.json())?.email;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Validate email format server-side (client validation is bypassable)
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: 'Valid email address required' }, { status: 400 });
  }
  const cleanEmail = email.trim().toLowerCase();

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const site = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.nomadxe.com';

  if (!url || !anon) {
    console.error('[send-reset] Missing Supabase env vars');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // ── User existence check ──────────────────────────────────────────────────────
  // Verify the user exists before firing a transactional email.
  // Uses the RPC function to avoid O(n) listUsers() call.
  // On RPC failure (function not yet deployed), fall back silently — we still
  // return 200 to the caller regardless to prevent email enumeration.
  try {
    const adminClient = createAdminClient();
    const { data: userId, error: rpcError } = await adminClient
      .rpc('get_user_id_by_email', { email_input: cleanEmail });

    if (rpcError) {
      // RPC may not be deployed yet — log and fall through to fire anyway
      console.warn('[send-reset] get_user_id_by_email RPC unavailable, proceeding:', rpcError.message);
    } else if (!userId) {
      // User does not exist — return 200 to prevent enumeration, skip email send
      console.log('[send-reset] no user found for email (enumeration-safe skip)');
      return NextResponse.json({ ok: true });
    }
  } catch (e: any) {
    console.warn('[send-reset] user existence check failed, proceeding:', e.message);
  }

  // ── Send the reset email via anon client ──────────────────────────────────────
  // resetPasswordForEmail is an anon-key operation — must use an anon client,
  // not the server client (which uses a user session cookie).
  const supabase = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: `${site}/reset-otp`,
  });

  if (error) {
    console.error('[send-reset] error:', error.message);
    // Return a generic 200 — never reveal whether the email exists or not
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
