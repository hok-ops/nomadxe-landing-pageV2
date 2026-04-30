import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import { AdminLeftPanel } from './AdminLeftPanel';
import { ManagedNetworkPanel } from './ManagedNetworkPanel';
import { OperationsIntelligencePanel } from './OperationsIntelligencePanel';
import { FormSubmissionsPanel } from './FormSubmissionsPanel';
import { StorageGuardrailPanel } from './StorageGuardrailPanel';
import { RosterTable } from './RosterTable';
import { ApiStructureGuide } from './ApiStructureGuide';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import type { ManagedNetworkStatus } from '@/lib/networkDevices';

export const metadata = {
  title: 'Operations Console | NomadXE',
};

// Map server-action event codes to display messages.
// Using codes (not raw strings) prevents URL-crafted visual spoofing.
const EVENT_MESSAGES: Record<string, { type: 'success' | 'error'; text: string }> = {
  user_invited:      { type: 'success', text: 'Invitation sent successfully.' },
  invite_resent:     { type: 'success', text: 'Invite resent.' },
  reset_sent:        { type: 'success', text: 'Password reset email sent.' },
  role_updated:      { type: 'success', text: 'User role updated.' },
  status_updated:    { type: 'success', text: 'Account status updated.' },
  user_deleted:      { type: 'success', text: 'User deleted.' },
  device_registered: { type: 'success', text: 'Device registered.' },
  device_assigned:   { type: 'success', text: 'Device assigned.' },
  assignment_removed:{ type: 'success', text: 'Device assignment removed.' },
  account_created:   { type: 'success', text: 'Account created.' },
  managed_device_added: { type: 'success', text: 'Managed LAN device added.' },
  managed_device_removed: { type: 'success', text: 'Managed LAN device removed.' },
  maintenance_run: { type: 'success', text: 'Free-plan maintenance cleanup completed.' },
};

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; msg?: string }>;
}) {
  const query = await searchParams;
  const supabase = createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return redirect('/dashboard');

  const { data: authUsersResponse } = await adminClient.auth.admin.listUsers();
  const authUsers = authUsersResponse?.users || [];
  const { data: profiles } = await adminClient.from('profiles').select('*');
  const { data: devices } = await adminClient.from('vrm_devices').select('*');
  const { data: managedDevices } = await adminClient
    .from('managed_network_devices')
    .select(`
      id,
      vrm_device_id,
      name,
      ip_address,
      alert_on_offline,
      is_active,
      last_status,
      last_reported_at,
      last_change_at,
      last_latency_ms,
      last_detail,
      vrm_devices!inner(name, vrm_site_id)
    `)
    .order('last_status', { ascending: true })
    .order('name', { ascending: true });
  const { data: discoveredDevices } = await adminClient
    .from('discovered_network_devices')
    .select(`
      id,
      vrm_device_id,
      ip_address,
      mac_address,
      hostname,
      last_status,
      first_seen_at,
      last_seen_at,
      last_latency_ms,
      last_detail,
      is_ignored,
      vrm_devices!inner(name, vrm_site_id)
    `)
    .eq('is_ignored', false)
    .order('last_seen_at', { ascending: false });
  const { data: assignments } = await adminClient
    .from('device_assignments')
    .select(`id, user_id, device_id, vrm_devices(name, vrm_site_id)`);
  const [
    serviceTicketsResult,
    historicalReportsResult,
    recommendationsResult,
    firmwareAdvisoriesResult,
    formSubmissionsResult,
    formSubmissionCountResult,
    cellularReportCountResult,
    dailyReportCountResult,
    discoveredHostCountResult,
    networkEventCountResult,
  ] = await Promise.all([
    adminClient
      .from('service_tickets')
      .select('id, title, status, priority, type, description, created_at, vrm_devices(name, vrm_site_id)')
      .order('created_at', { ascending: false })
      .limit(12),
    adminClient
      .from('daily_intelligence_reports')
      .select('id, report_date, status, summary, created_at, updated_at, vrm_devices(name, vrm_site_id)')
      .order('report_date', { ascending: false })
      .limit(12),
    adminClient
      .from('intelligence_recommendations')
      .select('id, category, severity, status, title, summary, action, created_at, vrm_devices(name, vrm_site_id)')
      .order('created_at', { ascending: false })
      .limit(12),
    adminClient
      .from('firmware_config_advisories')
      .select('id, severity, status, title, summary, product_name, firmware_version, created_at, vrm_devices(name, vrm_site_id)')
      .order('created_at', { ascending: false })
      .limit(12),
    adminClient
      .from('public_form_submissions')
      .select('id, form_type, status, name, email, company, phone, created_at, payload')
      .order('created_at', { ascending: false })
      .limit(12),
    adminClient
      .from('public_form_submissions')
      .select('id', { count: 'exact', head: true }),
    adminClient
      .from('cellular_signal_reports')
      .select('id', { count: 'exact', head: true }),
    adminClient
      .from('daily_intelligence_reports')
      .select('id', { count: 'exact', head: true }),
    adminClient
      .from('discovered_network_devices')
      .select('id', { count: 'exact', head: true }),
    adminClient
      .from('managed_network_device_events')
      .select('id', { count: 'exact', head: true }),
  ]);

  const totalUsers = authUsers.length;
  const totalDevices = devices?.length || 0;
  const pendingUsers = authUsers.filter(u => !u.last_sign_in_at).length;

  const userList = authUsers.map(u => ({ id: u.id, email: u.email }));
  const deviceList = (devices ?? []).map(d => ({
    id: d.id as number,
    name: d.name as string,
    vrm_site_id: d.vrm_site_id as string,
  }));

  const assignmentMap: Record<string, number[]> = {};
  for (const a of assignments ?? []) {
    if (!assignmentMap[a.user_id]) assignmentMap[a.user_id] = [];
    assignmentMap[a.user_id].push(a.device_id as number);
  }

  const managedDeviceList = (managedDevices ?? []).map((device: any) => {
    const parent = Array.isArray(device.vrm_devices) ? device.vrm_devices[0] : device.vrm_devices;
    return {
      id: Number(device.id),
      vrmDeviceId: Number(device.vrm_device_id),
      name: String(device.name),
      ipAddress: String(device.ip_address),
      alertOnOffline: Boolean(device.alert_on_offline),
      isActive: Boolean(device.is_active),
      lastStatus: String(device.last_status) as ManagedNetworkStatus,
      lastReportedAt: device.last_reported_at ? String(device.last_reported_at) : null,
      lastChangeAt: device.last_change_at ? String(device.last_change_at) : null,
      lastLatencyMs: typeof device.last_latency_ms === 'number' ? device.last_latency_ms : null,
      lastDetail: device.last_detail ? String(device.last_detail) : null,
      parentName: String(parent?.name ?? 'Unknown trailer'),
      parentSiteId: String(parent?.vrm_site_id ?? ''),
    };
  });

  const managedIps = new Set(
    managedDeviceList.map((device) => `${device.vrmDeviceId}:${device.ipAddress}`)
  );

  const discoveredDeviceList = (discoveredDevices ?? []).map((device: any) => {
    const parent = Array.isArray(device.vrm_devices) ? device.vrm_devices[0] : device.vrm_devices;
    const vrmDeviceId = Number(device.vrm_device_id);
    const ipAddress = String(device.ip_address);
    return {
      id: Number(device.id),
      vrmDeviceId,
      ipAddress,
      macAddress: device.mac_address ? String(device.mac_address) : null,
      hostname: device.hostname ? String(device.hostname) : null,
      lastStatus: String(device.last_status) as ManagedNetworkStatus,
      firstSeenAt: String(device.first_seen_at),
      lastSeenAt: String(device.last_seen_at),
      lastLatencyMs: typeof device.last_latency_ms === 'number' ? device.last_latency_ms : null,
      lastDetail: device.last_detail ? String(device.last_detail) : null,
      isIgnored: Boolean(device.is_ignored),
      isManaged: managedIps.has(`${vrmDeviceId}:${ipAddress}`),
      parentName: String(parent?.name ?? 'Unknown trailer'),
      parentSiteId: String(parent?.vrm_site_id ?? ''),
    };
  });

  const rosterUsers = authUsers.map(u => {
    const p = profiles?.find(prof => prof.id === u.id);
    return {
      id: u.id,
      email: u.email,
      last_sign_in_at: u.last_sign_in_at ?? null,
      role: (p?.role as string | null) ?? null,
      status: (p?.status as string | null) ?? null,
      assignments: (assignments ?? []).filter((a: any) => a.user_id === u.id),
    };
  });

  const storageGuardrailCounts = {
    formSubmissions: formSubmissionCountResult.count ?? 0,
    cellularReports: cellularReportCountResult.count ?? 0,
    dailyReports: dailyReportCountResult.count ?? 0,
    discoveredHosts: discoveredHostCountResult.count ?? 0,
    networkEvents: networkEventCountResult.count ?? 0,
  };

  return (
    <div className="nx-page min-h-screen bg-[#080c14] text-[#93c5fd] font-mono relative selection:bg-[#3b82f6] selection:text-white pt-28 pb-24">

      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(to right, #3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-10">

        {/* ── Toasts ── */}
        {query.event && (() => {
          const mapped = EVENT_MESSAGES[query.event];
          if (mapped?.type === 'success') {
            return (
              <div className="mb-6 bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-5 py-4 flex items-center gap-3 text-sm text-emerald-300">
                <span className="text-emerald-400">✓</span> {mapped.text}
              </div>
            );
          }
          if (query.event === 'error') {
            // msg is URL-encoded by actions.ts; decode for display but never trust it for logic.
            const errorText = query.msg
              ? decodeURIComponent(query.msg).slice(0, 200)
              : 'An unexpected error occurred.';
            return (
              <div className="mb-6 bg-red-950/40 border border-red-500/40 rounded-xl px-5 py-4 flex items-center gap-3 text-sm text-red-300">
                <span className="text-red-400">⚠</span> {errorText}
              </div>
            );
          }
          return null;
        })()}

        {/* ── Header ── */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-8 border-b border-[#1e3a5f] gap-6">
          <div>
            <Link href="/" className="flex items-center gap-3 mb-2 group w-fit">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3b82f6] shadow-[0_0_10px_#3b82f6]" />
              <span className="text-[10px] text-[#93c5fd]/70 group-hover:text-[#3b82f6] uppercase tracking-[0.5em] font-bold transition-colors">NomadXE Admin</span>
            </Link>
            <h1 className="text-3xl font-black tracking-tight text-white">Operations Console</h1>
            <p className="text-sm text-[#93c5fd]/70 mt-1">Manage clients, Victron devices, and access control</p>
          </div>
          <div className="flex items-center gap-3">
            <ApiStructureGuide />
            <ThemeToggle />
            <Link
              href="/"
              className="text-xs font-semibold border border-[#1e3a5f] text-[#93c5fd]/50 hover:text-white hover:border-[#3b82f6]/60 px-5 py-2.5 rounded-lg transition-all"
            >
              ← Home
            </Link>
            <Link
              href="/dashboard"
              className="text-xs font-semibold border border-[#1e3a5f] text-[#93c5fd]/70 hover:text-white hover:border-[#3b82f6]/60 px-5 py-2.5 rounded-lg transition-all"
            >
              My Dashboard
            </Link>
            <Link
              href="/admin/quote"
              className="text-xs font-semibold bg-[#1e40af]/30 border border-[#3b82f6]/40 text-[#93c5fd] hover:bg-[#2563eb]/40 hover:text-white hover:border-[#3b82f6] px-5 py-2.5 rounded-lg transition-all"
            >
              Quote Engine
            </Link>
          </div>
        </header>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Total Clients', value: totalUsers, note: `${pendingUsers} pending activation` },
            { label: 'Victron Devices', value: totalDevices, note: 'Registered in fleet' },
            { label: 'Active Accounts', value: totalUsers - pendingUsers, note: 'Signed in at least once' },
          ].map(stat => (
            <div key={stat.label} className="bg-[#0d1526] border border-[#1e3a5f] rounded-xl p-5">
              <div className="text-2xl font-black text-white">{stat.value}</div>
              <div className="text-xs font-semibold text-[#93c5fd]/80 mt-1">{stat.label}</div>
              <div className="text-[10px] text-[#93c5fd]/65 mt-1">{stat.note}</div>
            </div>
          ))}
        </div>

        <section id="lan-device-operations" className="mb-10">
          <ManagedNetworkPanel
            devices={deviceList}
            managedDevices={managedDeviceList}
            discoveredDevices={discoveredDeviceList}
          />
        </section>

        <FormSubmissionsPanel submissions={(formSubmissionsResult.data ?? []) as any[]} />

        <StorageGuardrailPanel counts={storageGuardrailCounts} />

        <OperationsIntelligencePanel
          tickets={(serviceTicketsResult.data ?? []) as any[]}
          reports={(historicalReportsResult.data ?? []) as any[]}
          recommendations={(recommendationsResult.data ?? []) as any[]}
          firmwareAdvisories={(firmwareAdvisoriesResult.data ?? []) as any[]}
        />

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]">

          {/* ── Left Panel ── */}
          <div>
            <AdminLeftPanel
              userList={userList}
              deviceList={deviceList}
              assignmentMap={assignmentMap}
            />
          </div>

          {/* ── Right Panel: Roster ── */}
          <div className="min-w-0">
            <RosterTable users={rosterUsers} totalDevices={totalDevices} />
          </div>

        </div>
      </div>
    </div>
  );
}
