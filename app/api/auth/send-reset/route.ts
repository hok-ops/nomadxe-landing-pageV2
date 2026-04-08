import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const site = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.nomadxe.com';

  if (!url || !anon) {
    console.error('[send-reset] Missing Supabase env vars');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // Use a fresh anon client — resetPasswordForEmail is an anon-key operation
  const supabase = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/reset-otp`,
  });

  if (error) {
    console.error('[send-reset] error:', error.message, error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
