import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { assertVrmSiteAccess } from '@/lib/vrmAccess';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import type { ServiceTicketPriority, ServiceTicketType } from '@/lib/leaseOperations';

const TYPES = new Set<ServiceTicketType>(['service', 'relocation', 'connectivity', 'power', 'monitoring', 'billing', 'other']);
const PRIORITIES = new Set<ServiceTicketPriority>(['low', 'normal', 'urgent']);

function cap(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function titleFor(type: ServiceTicketType, priority: ServiceTicketPriority) {
  const label = {
    service: 'Service request',
    relocation: 'Relocation request',
    connectivity: 'Connectivity review',
    power: 'Power system review',
    monitoring: 'Monitoring review',
    billing: 'Billing question',
    other: 'Customer request',
  }[type];
  return priority === 'urgent' ? `Urgent ${label.toLowerCase()}` : label;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`service-ticket:${ip}`, 6, 60_000)) {
    return NextResponse.json({ error: 'Too many service requests. Please wait before trying again.' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const siteId = cap(body.siteId, 32);
  const type = TYPES.has(body.type as ServiceTicketType) ? body.type as ServiceTicketType : 'service';
  const priority = PRIORITIES.has(body.priority as ServiceTicketPriority) ? body.priority as ServiceTicketPriority : 'normal';
  const description = cap(body.description, 1200);

  if (!siteId || !description) {
    return NextResponse.json({ error: 'A trailer and request description are required.' }, { status: 422 });
  }

  const access = await assertVrmSiteAccess(siteId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const adminClient = createAdminClient();
  const { data: device, error: deviceError } = await adminClient
    .from('vrm_devices')
    .select('id, name, display_name')
    .eq('vrm_site_id', siteId)
    .maybeSingle();

  if (deviceError || !device) {
    return NextResponse.json({ error: 'Assigned trailer was not found.' }, { status: 404 });
  }

  const { data: leaseAsset } = await adminClient
    .from('lease_assets')
    .select('lease_id')
    .eq('vrm_device_id', Number(device.id))
    .is('removed_at', null)
    .maybeSingle();

  const { data: ticket, error: ticketError } = await adminClient
    .from('service_tickets')
    .insert({
      lease_id: leaseAsset?.lease_id ?? null,
      vrm_device_id: Number(device.id),
      customer_id: access.userId,
      type,
      priority,
      status: 'received',
      title: titleFor(type, priority),
      description,
      customer_visible_note: 'Received by NomadXE operations.',
    })
    .select('id')
    .single();

  if (ticketError) {
    console.error('[service-tickets] create failed:', ticketError.message);
    return NextResponse.json({ error: 'Service ticket storage is not configured yet.' }, { status: 503 });
  }

  await adminClient
    .from('proof_of_service_events')
    .insert({
      lease_id: leaseAsset?.lease_id ?? null,
      vrm_device_id: Number(device.id),
      event_type: 'service',
      severity: priority === 'urgent' ? 'action' : 'info',
      title: 'Customer service ticket received',
      summary: `${titleFor(type, priority)} for ${device.display_name ?? device.name}.`,
      evidence: { ticketId: ticket.id, type, priority },
    });

  return NextResponse.json({ ok: true, ticketId: ticket.id });
}
