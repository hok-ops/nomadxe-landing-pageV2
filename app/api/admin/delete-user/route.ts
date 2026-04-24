import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export async function POST(request: NextRequest) {
  try {
    const caller = await getAdminUser();
    if (!caller) {
      console.warn('[SECURITY] delete-user: unauthorized attempt', { ts: new Date().toISOString() });
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
    }

    let body: { userId?: unknown };
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

    const { userId } = body;
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return NextResponse.json({ error: 'userId is required and must be a non-empty string' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Step 1: Explicitly delete device assignments (belt-and-suspenders)
    const { error: asnErr } = await adminClient
      .from('device_assignments')
      .delete()
      .eq('user_id', userId);
    if (asnErr) {
      console.error('[delete-user] device_assignments cleanup:', asnErr.message);
      // Non-fatal — cascade on profile delete should handle it
    }

    // Step 2: Delete profile row before auth delete
    const { error: profErr } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (profErr) {
      console.error('[delete-user] profiles:', profErr.message);
      return NextResponse.json({ error: 'Could not delete user profile' }, { status: 500 });
    }

    // Step 3: Delete the Supabase auth user
    const { error: authErr } = await adminClient.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error('[delete-user] auth.admin.deleteUser:', authErr.message);
      return NextResponse.json({ error: 'Auth deletion failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[delete-user] unexpected:', err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
