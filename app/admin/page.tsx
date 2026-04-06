import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import { inviteNewUser, registerDevice, updateUserRole } from './actions';
import Link from 'next/link';

export const metadata = {
  title: 'Operations Console | NomadXE',
};

export default async function AdminDashboard() {
  const supabase = createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return redirect('/dashboard');
  }

  const { data: authUsersResponse } = await adminClient.auth.admin.listUsers();
  const authUsers = authUsersResponse?.users || [];

  const { data: profiles } = await adminClient.from('profiles').select('*');
  const { data: devices } = await adminClient.from('vrm_devices').select('*');

  const { data: assignments } = await adminClient
    .from('device_assignments')
    .select(`
      id,
      user_id,
      device_id,
      vrm_devices(name, vrm_site_id),
      profiles(id)
    `);

  const totalUsers = authUsers.length;
  const totalDevices = devices?.length || 0;
  const pendingUsers = authUsers.filter(u => !u.last_sign_in_at).length;

  return (
    <div className="min-h-screen bg-[#080c14] text-[#93c5fd] font-mono relative selection:bg-[#3b82f6] selection:text-white pt-28 pb-24">
      
      {/* Top accent bar — indigo blue */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />

      {/* Subtle grid overlay */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(to right, #3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-10">

        {/* ── Header ── */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 pb-8 border-b border-[#1e3a5f] gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3b82f6] shadow-[0_0_10px_#3b82f6]" />
              <span className="text-[10px] text-[#3b82f6]/60 uppercase tracking-[0.5em] font-bold">NomadXE Admin</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">Operations Console</h1>
            <p className="text-sm text-[#93c5fd]/50 mt-1">Manage clients, Victron devices, and access control</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-semibold border border-[#1e3a5f] text-[#93c5fd]/70 hover:text-white hover:border-[#3b82f6]/60 px-5 py-2.5 rounded-lg transition-all"
            >
              ← Client Dashboard
            </Link>
          </div>
        </header>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Total Clients', value: totalUsers, note: `${pendingUsers} pending activation` },
            { label: 'Victron Devices', value: totalDevices, note: 'Registered in fleet' },
            { label: 'Active Sessions', value: totalUsers - pendingUsers, note: 'Signed in at least once' },
          ].map(stat => (
            <div key={stat.label} className="bg-[#0d1526] border border-[#1e3a5f] rounded-xl p-5">
              <div className="text-2xl font-black text-white">{stat.value}</div>
              <div className="text-xs font-semibold text-[#93c5fd]/80 mt-1">{stat.label}</div>
              <div className="text-[10px] text-[#3b82f6]/40 mt-1">{stat.note}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">

          {/* ── Left Panel: Actions + Guide ── */}
          <div className="xl:col-span-1 space-y-6">

            {/* INVITE CLIENT */}
            <section className="bg-[#0d1526] border border-[#1e3a5f] rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Invite New Client</h2>
                <p className="text-[11px] text-[#93c5fd]/50 leading-relaxed">
                  Sends a secure invite email. The client&apos;s Victron device is registered and linked automatically on signup.
                </p>
              </div>
              <form action={inviteNewUser} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-[#3b82f6]/60 font-bold">Client Email</label>
                  <input
                    name="email" type="email" required
                    className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
                    placeholder="client@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-[#3b82f6]/60 font-bold">Victron Site ID</label>
                  <input
                    name="vrm_site_id" required
                    className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
                    placeholder="e.g. 123456"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-[#3b82f6]/60 font-bold">Device Name</label>
                  <input
                    name="device_name" required
                    className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
                    placeholder="e.g. Unit Alpha"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold py-3 rounded-lg text-sm transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] active:scale-[0.98]"
                >
                  Send Invitation
                </button>
              </form>
            </section>

            {/* REGISTER DEVICE */}
            <section className="bg-[#0d1526] border border-[#1e3a5f] rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Register a Victron Device</h2>
                <p className="text-[11px] text-[#93c5fd]/50 leading-relaxed">
                  Use this to add a standalone device before assigning it to a client. Find the Site ID from your Victron VRM portal under Installation Settings.
                </p>
              </div>
              <form action={registerDevice} className="space-y-4">
                <input
                  name="vrm_site_id" required
                  className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
                  placeholder="VRM Site ID"
                />
                <input
                  name="name" required
                  className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
                  placeholder="Device name (e.g. Unit Bravo)"
                />
                <button
                  type="submit"
                  className="w-full border border-[#1e40af] text-[#93c5fd] hover:bg-[#1e40af]/30 font-bold py-3 rounded-lg text-sm transition-all active:scale-[0.98]"
                >
                  Register Device
                </button>
              </form>
            </section>

            {/* HOW-TO GUIDE */}
            <section className="bg-[#0a0f1e] border border-[#1e3a5f]/60 rounded-xl p-6 space-y-4">
              <h2 className="text-xs font-bold text-[#3b82f6] uppercase tracking-widest">How This Works</h2>
              <ol className="space-y-4 text-[11px] text-[#93c5fd]/70 leading-relaxed">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1e40af] text-white flex items-center justify-center text-[9px] font-black">1</span>
                  <span><strong className="text-white">Invite a client</strong> using the form above. Enter their email, their Victron Site ID (from VRM portal), and a device name.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1e40af] text-white flex items-center justify-center text-[9px] font-black">2</span>
                  <span><strong className="text-white">The client receives an email</strong> with a link to set their password. Once they sign up, they can view their Victron device data.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1e40af] text-white flex items-center justify-center text-[9px] font-black">3</span>
                  <span><strong className="text-white">Finding the Victron Site ID:</strong> Log into <span className="text-[#3b82f6]">vrm.victronenergy.com</span> → Select your installation → Settings → the 6–8 digit ID in the URL.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1e40af] text-white flex items-center justify-center text-[9px] font-black">4</span>
                  <span><strong className="text-white">Toggle Admin role</strong> in the user table to grant or revoke console access for any account.</span>
                </li>
              </ol>
            </section>
          </div>

          {/* ── Right Panel: User Table ── */}
          <div className="xl:col-span-3 space-y-6">
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded-xl shadow-2xl overflow-hidden">
              <div className="flex justify-between items-center px-7 py-5 border-b border-[#1e3a5f]">
                <div>
                  <h3 className="text-base font-bold text-white">Client & Device Roster</h3>
                  <p className="text-[11px] text-[#93c5fd]/40 mt-0.5">All registered accounts and their assigned Victron nodes</p>
                </div>
                <span className="text-xs font-bold text-[#3b82f6]/60 bg-[#1e40af]/20 px-3 py-1 rounded-full border border-[#1e40af]/30">
                  {totalDevices} Devices
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold text-[#3b82f6]/50 uppercase tracking-widest border-b border-[#1e3a5f] bg-[#080c14]/60">
                      <th className="px-7 py-4">Account</th>
                      <th className="px-7 py-4">Role</th>
                      <th className="px-7 py-4">Assigned Device</th>
                      <th className="px-7 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {authUsers.map((u) => {
                      const p = profiles?.find(prof => prof.id === u.id);
                      const a = assignments?.filter((as: any) => as.user_id === u.id);
                      const isAdmin = p?.role === 'admin';
                      return (
                        <tr key={u.id} className="group border-b border-[#1e3a5f]/50 hover:bg-[#1e3a5f]/10 transition-colors">
                          <td className="px-7 py-5">
                            <div className="text-sm font-semibold text-white">{u.email}</div>
                            {u.last_sign_in_at ? (
                              <div className="text-[10px] text-[#93c5fd]/30 mt-1">
                                Last active {new Date(u.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                            ) : (
                              <div className="text-[10px] text-amber-400/70 mt-1 animate-pulse">Awaiting first login</div>
                            )}
                          </td>
                          <td className="px-7 py-5">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold border ${
                              isAdmin
                                ? 'bg-violet-900/20 text-violet-300 border-violet-500/30'
                                : 'bg-[#1e40af]/10 text-[#93c5fd]/70 border-[#1e40af]/20'
                            }`}>
                              {isAdmin ? '⬡ Admin' : '◯ Client'}
                            </span>
                          </td>
                          <td className="px-7 py-5">
                            {a && a.length > 0 ? (
                              a.map((inst: any) => (
                                <div key={inst.id} className="flex flex-col">
                                  <span className="text-sm font-semibold text-white">{inst.vrm_devices?.name}</span>
                                  <span className="text-[10px] text-[#93c5fd]/30 font-mono">Site ID: {inst.vrm_devices?.vrm_site_id}</span>
                                </div>
                              ))
                            ) : (
                              <span className="text-[11px] text-[#93c5fd]/20 italic">No device assigned</span>
                            )}
                          </td>
                          <td className="px-7 py-5 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <form action={updateUserRole}>
                                <input type="hidden" name="userId" value={u.id} />
                                <input type="hidden" name="role" value={isAdmin ? 'user' : 'admin'} />
                                <button
                                  type="submit"
                                  className={`text-[10px] font-bold px-4 py-2 rounded-lg border transition-all ${
                                    isAdmin
                                      ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                      : 'border-violet-500/30 text-violet-400 hover:bg-violet-500/10'
                                  }`}
                                >
                                  {isAdmin ? 'Revoke Admin' : 'Make Admin'}
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {authUsers.length === 0 && (
                  <div className="text-center py-16 text-[#93c5fd]/30 text-sm">
                    No clients yet. Invite your first client using the panel on the left.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
