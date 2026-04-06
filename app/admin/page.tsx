import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import { createClientAccount, registerDevice, assignDevice, deleteAssignment, updateUserRole } from './actions';
import Link from 'next/link';

export const metadata = {
  title: 'Admin Control Portal | NomadXE',
};

export default async function AdminDashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/staff');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return redirect('/dashboard');

  const adminClient = createAdminClient();
  const { data: authUsersResponse } = await adminClient.auth.admin.listUsers();
  const authUsers = authUsersResponse?.users || [];
  
  // Fetch profiles to get roles for management
  const { data: profiles } = await supabase.from('profiles').select('*');
  
  const { data: devices } = await supabase.from('vrm_devices').select('*');

  // Fetch live assignments with joined data
  const { data: assignments } = await supabase
    .from('device_assignments')
    .select(`
      id,
      user_id,
      device_id,
      vrm_devices(name, vrm_site_id),
      profiles(id)
    `);

  return (
    <div className="min-h-screen bg-midnight pt-32 pb-24 px-8 md:px-12 text-white/90">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-white/10 pb-6 gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Systems Administration</h1>
            <p className="font-mono text-xs text-blue/70 uppercase tracking-[0.3em]">Trailer Allocation & Provisioning</p>
          </div>
          <Link href="/dashboard" className="text-[10px] font-mono border border-white/10 px-6 py-2.5 rounded-lg text-white/50 hover:bg-white/5 hover:text-white transition-all uppercase tracking-[0.2em]">
            &larr; Exit to Dashboard
          </Link>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Section 1: Provision Users */}
          <section className="bg-surface border border-white/5 p-8 rounded-3xl shadow-2xl space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-blue/10 flex items-center justify-center text-blue text-sm">01</span>
              <h2 className="text-xl font-bold uppercase tracking-tight text-white">Provision Client</h2>
            </div>
            <form action={createClientAccount} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-white/40 uppercase mb-2 block ml-1">Client Email</label>
                <input name="email" type="email" required className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-sm focus:outline-none focus:border-blue/50 transition-all font-mono" placeholder="client@example.com" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-white/40 uppercase mb-2 block ml-1">Access Key</label>
                <input name="password" type="password" required className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-sm focus:outline-none focus:border-blue/50 transition-all font-mono" placeholder="••••••••" />
              </div>
              <button className="w-full bg-blue text-midnight font-bold py-4 rounded-xl text-sm uppercase tracking-widest hover:shadow-[0_0_20px_rgba(14,165,233,0.4)] transition-all active:scale-[0.98]">
                Initialize Account
              </button>
            </form>
          </section>

          {/* Section 2: Register Trailer */}
          <section className="bg-surface border border-white/5 p-8 rounded-3xl shadow-2xl space-y-6">
             <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-blue/10 flex items-center justify-center text-blue text-sm">02</span>
              <h2 className="text-xl font-bold uppercase tracking-tight text-white">Register Trailer</h2>
            </div>
            <form action={registerDevice} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-white/40 uppercase mb-2 block ml-1">VRM ID</label>
                <input name="vrm_site_id" required className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-sm focus:outline-none focus:border-blue/50 transition-all font-mono" placeholder="e.g. 123456" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-white/40 uppercase mb-2 block ml-1">Trailer Tag</label>
                <input name="name" required className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-sm focus:outline-none focus:border-blue/50 transition-all font-mono" placeholder="e.g. ALPHA-01" />
              </div>
               <button className="w-full bg-blue text-midnight font-bold py-4 rounded-xl text-sm uppercase tracking-widest hover:shadow-[0_0_20px_rgba(14,165,233,0.4)] transition-all active:scale-[0.98]">
                Add VRM Node
              </button>
            </form>
          </section>

          {/* Section 3: Mapping / Assignment */}
          <section className="bg-surface border border-white/5 p-8 rounded-3xl shadow-2xl space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-blue/10 flex items-center justify-center text-blue text-sm">03</span>
              <h2 className="text-xl font-bold uppercase tracking-tight text-white">Assign Access</h2>
            </div>
            <form action={assignDevice} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-white/40 uppercase mb-2 block ml-1">Target Client</label>
                <select name="user_id" required className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-sm focus:outline-none focus:border-blue/50 transition-all text-white appearance-none cursor-pointer">
                  <option value="" className="bg-midnight text-white/50">Select Account...</option>
                  {authUsers.map((u) => (
                    <option key={u.id} value={u.id} className="bg-midnight">{u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-white/40 uppercase mb-2 block ml-1">Target Trailer</label>
                <select name="device_id" required className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-sm focus:outline-none focus:border-blue/50 transition-all text-white appearance-none cursor-pointer">
                   <option value="" className="bg-midnight text-white/50">Select Device...</option>
                   {devices?.map((d: any) => (
                     <option key={d.id} value={d.id} className="bg-midnight">{d.name} ({d.vrm_site_id})</option>
                   ))}
                </select>
              </div>
               <button className="w-full bg-emerald-500 text-midnight font-bold py-4 rounded-xl text-sm uppercase tracking-widest hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all active:scale-[0.98]">
                Commit Mapping
              </button>
            </form>
          </section>
        </div>

        {/* Advanced Access Audit Section */}
        <div className="mt-12 bg-surface border border-white/5 rounded-3xl p-8 overflow-hidden">
          <h3 className="text-sm font-mono text-white/30 uppercase tracking-[0.2em] mb-8">Active Access Matrix</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-mono text-white/20 uppercase tracking-widest">
                  <th className="pb-4">Client ID</th>
                  <th className="pb-4">Assignment Status</th>
                  <th className="pb-4">Trailer Node</th>
                  <th className="pb-4 text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assignments && assignments.length > 0 ? (assignments as any[]).map((a) => (
                  <tr key={a.id} className="group hover:bg-white/[0.02] transition-all">
                    <td className="py-6 text-sm font-mono text-white/50">{a.profiles?.email || a.user_id.substring(0, 16)}...</td>
                    <td className="py-6 italic text-xs text-emerald-400/60">ACTIVE_RELAY</td>
                    <td className="py-6 text-sm font-bold text-white">{a.vrm_devices?.name} <span className="font-normal opacity-30">({a.vrm_devices?.vrm_site_id})</span></td>
                    <td className="py-6 text-right">
                      <form action={deleteAssignment}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="text-[10px] font-mono bg-rose-500/10 text-rose-400 px-4 py-2 rounded-lg hover:bg-rose-500 hover:text-white transition-all uppercase tracking-widest">
                          Revoke Access
                        </button>
                      </form>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-xs font-mono text-white/20 uppercase italic">No active mappings identified in registry.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Global Registry Audit & Role Management */}
        <div className="mt-12 bg-surface/30 border border-white/5 rounded-3xl p-8 backdrop-blur-sm grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h3 className="text-sm font-mono text-white/30 uppercase tracking-[0.2em]">Global User Registry</h3>
              <ul className="space-y-4">
                {authUsers.map(u => {
                  const p = profiles?.find(prof => prof.id === u.id);
                  return (
                    <li key={u.id} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/[0.02]">
                      <div className="font-mono">
                        <p className="text-sm text-white/80">{u.email}</p>
                        <p className="text-[10px] text-blue uppercase tracking-widest">{p?.role || 'user'}</p>
                      </div>
                      <form action={updateUserRole} className="flex gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="role" value={p?.role === 'admin' ? 'user' : 'admin'} />
                        <button className={`text-[9px] font-mono px-3 py-1.5 rounded bg-white/5 uppercase tracking-widest hover:bg-blue hover:text-midnight transition-all`}>
                          Toggle Admin
                        </button>
                      </form>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="space-y-6">
              <h3 className="text-sm font-mono text-white/30 uppercase tracking-[0.2em]">Registered VRM Nodes</h3>
              <ul className="space-y-4">
                 {devices && devices.map((d: any) => (
                   <li key={d.id} className="p-4 bg-black/20 rounded-2xl border border-white/[0.02] flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-white">{d.name}</p>
                        <p className="text-[10px] font-mono text-white/30">{d.vrm_site_id}</p>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                   </li>
                 ))}
              </ul>
            </div>
        </div>
      </div>
    </div>
  );
}
