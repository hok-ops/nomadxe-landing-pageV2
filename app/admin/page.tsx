import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import { inviteNewUser, registerDevice } from './actions';
import { AssignDeviceForm } from './AssignDeviceForm';
import GenerateLinkTool from './GenerateLinkTool';
import CopyOrderLink from './CopyOrderLink';
import { RosterTable } from './RosterTable';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata = {
  title: 'Operations Console | NomadXE',
};

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: { success?: string; error?: string };
}) {
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
  const { data: assignments } = await adminClient
    .from('device_assignments')
    .select(`id, user_id, device_id, vrm_devices(name, vrm_site_id)`);

  const totalUsers = authUsers.length;
  const totalDevices = devices?.length || 0;
  const pendingUsers = authUsers.filter(u => !u.last_sign_in_at).length;

  // Shape data for client components
  const userList = authUsers.map(u => ({ id: u.id, email: u.email }));
  const deviceList = (devices ?? []).map(d => ({
    id: d.id as number,
    name: d.name as string,
    vrm_site_id: d.vrm_site_id as string,
  }));

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

  return (
    <div className="nx-page min-h-screen bg-[#080c14] text-[#93c5fd] font-mono relative selection:bg-[#3b82f6] selection:text-white pt-28 pb-24">

      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(to right, #3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-10">

        {/* ── Toasts ── */}
        {searchParams.success && (
          <div className="mb-6 bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-5 py-4 flex items-center gap-3 text-sm text-emerald-300">
            <span className="text-emerald-400">✓</span> {searchParams.success}
          </div>
        )}
        {searchParams.error && (
          <div className="mb-6 bg-red-950/40 border border-red-500/40 rounded-xl px-5 py-4 flex items-center gap-3 text-sm text-red-300">
            <span className="text-red-400">⚠</span> {searchParams.error}
          </div>
        )}

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

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">

          {/* ── Left Panel ── */}
          <div className="xl:col-span-1 space-y-6">

            {/* INVITE */}
            <section className="bg-[#0d1526] border border-[#1e3a5f] rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Invite New Client</h2>
                <p className="text-[11px] text-[#93c5fd]/70 leading-relaxed">
                  Sends a secure invite email. Client sets their own password on first login.
                </p>
              </div>
              <form action={inviteNewUser} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-[#93c5fd]/75 font-bold">Client Email</label>
                  <input name="email" type="email" required
                    className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
                    placeholder="client@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-[#93c5fd]/75 font-bold">
                    Victron Site ID <span className="normal-case text-[#93c5fd]/60 font-normal">(optional)</span>
                  </label>
                  <input name="vrm_site_id"
                    className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
                    placeholder="e.g. 123456"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-[#93c5fd]/75 font-bold">
                    Device Name <span className="normal-case text-[#93c5fd]/60 font-normal">(optional)</span>
                  </label>
                  <input name="device_name"
                    className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
                    placeholder="e.g. Unit Alpha"
                  />
                </div>
                <button type="submit"
                  className="w-full bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold py-3 rounded-lg text-sm transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] active:scale-[0.98]"
                >
                  Send Invitation
                </button>
              </form>
            </section>

            {/* ORDER FORM LINK */}
            <CopyOrderLink />

            {/* ASSIGN DEVICE — client component for real-time error feedback */}
            <section className="bg-[#0d1526] border border-[#1e3a5f] rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Assign Device to User</h2>
                <p className="text-[11px] text-[#93c5fd]/70 leading-relaxed">
                  Link an additional Victron unit to an existing client. Each user can have multiple units.
                </p>
              </div>
              <AssignDeviceForm users={userList} devices={deviceList} />
            </section>

            {/* REGISTER DEVICE */}
            <section className="bg-[#0d1526] border border-[#1e3a5f] rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Register Victron Device</h2>
                <p className="text-[11px] text-[#93c5fd]/70 leading-relaxed">
                  Add a device to the fleet. Find the Site ID in VRM → Installation Settings.
                </p>
              </div>
              <form action={registerDevice} className="space-y-4">
                <input name="vrm_site_id" required
                  className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
                  placeholder="VRM Site ID"
                />
                <input name="name" required
                  className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
                  placeholder="Device name (e.g. Unit Bravo)"
                />
                <button type="submit"
                  className="w-full border border-[#1e40af]/60 text-[#93c5fd]/70 hover:bg-[#1e40af]/20 font-bold py-3 rounded-lg text-sm transition-all active:scale-[0.98]"
                >
                  Register Device
                </button>
              </form>
            </section>

            {/* HOW-TO */}
            <section className="bg-[#0a0f1e] border border-[#1e3a5f]/60 rounded-xl p-6 space-y-4">
              <h2 className="text-xs font-bold text-[#3b82f6] uppercase tracking-widest">How This Works</h2>
              <ol className="space-y-3 text-[11px] text-[#93c5fd]/70 leading-relaxed">
                {[
                  ['Invite a client', 'They receive an activation email and set their own password.'],
                  ['Assign additional units', 'Use "Assign Device" to link extra Victron units after signup.'],
                  ['Finding the Site ID', 'VRM portal → select installation → 6–8 digit ID in the URL.'],
                  ['Manage roles & access', 'Toggle Admin, suspend, send a new password reset, or delete.'],
                ].map(([title, desc], i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1e40af] text-white flex items-center justify-center text-[9px] font-black">{i + 1}</span>
                    <span><strong className="text-white">{title} — </strong>{desc}</span>
                  </li>
                ))}
              </ol>
              <div className="pt-3 border-t border-[#1e3a5f]/40 text-[10px] text-amber-400/80">
                ⚠ Set <code className="text-amber-300">NEXT_PUBLIC_SITE_URL=https://www.nomadxe.com</code> in Vercel so invite/reset emails link correctly.
              </div>
            </section>
          </div>

          {/* ── Right Panel: Roster ── */}
          <div className="xl:col-span-3">
            <RosterTable users={rosterUsers} totalDevices={totalDevices} />
          </div>

        </div>

        {/* Dev tool — full-width below the main grid */}
        <div className="mt-8">
          <GenerateLinkTool users={userList} />
        </div>
      </div>
    </div>
  );
}
