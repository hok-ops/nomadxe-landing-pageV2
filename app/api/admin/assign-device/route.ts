import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export async function POST(request: NextRequest) {
  try {
    const caller = await getAdminUser();
    if (!caller) {
      console.warn('[SECURITY] assign-device POST: unauthorized attempt', { ts: new Date().toISOString() });
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
    }

    let body: { userId?: unknown; deviceId?: unknown };
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

    const { userId, deviceId } = body;
    if (!userId || !deviceId) {
      return NextResponse.json({ error: 'userId and deviceId are required' }, { status: 400 });
    }

    // Explicit integer parse — Number(coercion) silently returns NaN for
    // non-numeric strings which passes to .eq() and matches nothing.
    const deviceIdNum = parseInt(String(deviceId), 10);
    if (isNaN(deviceIdNum)) {
      return NextResponse.json({ error: 'deviceId must be a valid integer' }, { status: 400 });
    }

    if (typeof userId !== 'string' || !userId.trim()) {
      return NextResponse.json({ error: 'userId must be a non-empty string' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verify the target user exists in profiles
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
      .eq('id', deviceIdNum)
      .single();
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const { error } = await adminClient
      .from('device_assignments')
      .insert([{ user_id: userId, device_id: deviceIdNum }]);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `${device.name} is already assigned to this user` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Assignment failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[assign-device] unexpected:', err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const caller = await getAdminUser();
    if (!caller) {
      console.warn('[SECURITY] assign-device DELETE: unauthorized attempt', { ts: new Date().toISOString() });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { assignmentId?: unknown };
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

    const { assignmentId } = body;
    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 });
    }

    const idNum = parseInt(String(assignmentId), 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'assignmentId must be a valid integer' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('device_assignments')
      .delete()
      .eq('id', idNum);

    if (error) {
      return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[assign-device] unexpected DELETE:', err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
