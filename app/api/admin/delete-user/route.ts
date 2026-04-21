import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

async function getAdminUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin' ? user : null;
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getAdminUser();
    if (!caller) {
      console.warn('[SECURITY] delete-user: unauthorized attempt', { ts: new Date().toISOString() });
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
    }

    const { userId } = await request.json();
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Step 1: Explicitly delete device assignments (belt-and-suspenders before profile delete)
    const { error: asnErr } = await adminClient
      .from('device_assignments')
      .delete()
      .eq('user_id', userId);
    if (asnErr) {
      console.error('[delete-user] device_assignments:', asnErr.message);
      // Non-fatal — continue
    }

    // Step 2: Delete profile row — MUST happen before auth delete because
    // profiles.id FK to auth.users has no CASCADE (migration 002 fixes this,
    // but this explicit delete is the belt in case migration hasn't run yet)
    const { error: profErr } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (profErr) {
      console.error('[delete-user] profiles:', profErr.message);
      return NextResponse.json(
        { error: `Could not delete profile: ${profErr.message}` },
        { status: 500 }
      );
    }

    // Step 3: Delete the Supabase auth user
    const { error: authErr } = await adminClient.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error('[delete-user] auth.admin.deleteUser:', authErr.message);
      return NextResponse.json(
        { error: `Auth delete failed: ${authErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[delete-user] unexpected:', err);
    return NextResponse.json(
      { error: err.message || 'Unexpected server error' },
      { status: 500 }
    );
  }
}
