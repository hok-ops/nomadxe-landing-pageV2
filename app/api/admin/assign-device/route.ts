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
      console.warn('[SECURITY] assign-device POST: unauthorized attempt', { ts: new Date().toISOString() });
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
    }

    const { userId, deviceId } = await request.json();
    if (!userId || !deviceId) {
      return NextResponse.json({ error: 'userId and deviceId are required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verify the user exists in profiles before assigning
    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify device exists
    const { data: device } = await adminClient
      .from('vrm_devices')
      .select('id, name')
      .eq('id', Number(deviceId))
      .single();
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const { error } = await adminClient
      .from('device_assignments')
      .insert([{ user_id: userId, device_id: Number(deviceId) }]);

    if (error) {
      // Unique constraint — already assigned
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `${device.name} is already assigned to this user` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[assign-device] unexpected:', err);
    return NextResponse.json(
      { error: err.message || 'Unexpected server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const caller = await getAdminUser();
    if (!caller) {
      console.warn('[SECURITY] assign-device DELETE: unauthorized attempt', { ts: new Date().toISOString() });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId } = await request.json();
    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('device_assignments')
      .delete()
      .eq('id', Number(assignmentId));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 });
  }
}
