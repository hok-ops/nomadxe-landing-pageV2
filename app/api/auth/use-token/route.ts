import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token, type, profileUpdate } = await request.json();

    if (!token || !type) {
      return NextResponse.json({ error: 'token and type are required' }, { status: 400 });
    }
    if (!['invite', 'recovery'].includes(type)) {
      return NextResponse.json({ error: 'Invalid token type' }, { status: 400 });
    }

    // Verify caller has an active session
    const supabase = createClient();
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !user) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Fetch and validate the token
    const { data: tokenRecord, error: tokenError } = await adminClient
      .from('auth_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .eq('type', type)
      .single();

    if (tokenError || !tokenRecord) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }
    if (tokenRecord.used_at) {
      return NextResponse.json({ error: 'Token already used' }, { status: 409 });
    }
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 410 });
    }
    // Ensure token belongs to the authenticated user
    if (tokenRecord.user_id !== user.id) {
      return NextResponse.json({ error: 'Token does not belong to this user' }, { status: 403 });
    }

    // Mark token as used immediately (single-use enforcement)
    const { error: invalidateError } = await adminClient
      .from('auth_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    if (invalidateError) {
      console.error('[use-token] invalidate:', invalidateError.message);
      return NextResponse.json({ error: 'Failed to invalidate token' }, { status: 500 });
    }

    // Apply profile updates if provided (invite flow: set name + active status)
    if (profileUpdate && Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await adminClient
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id);

      if (profileError) {
        console.error('[use-token] profile update:', profileError.message);
        return NextResponse.json({ error: `Profile update failed: ${profileError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[use-token] unexpected:', err);
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 });
  }
}
