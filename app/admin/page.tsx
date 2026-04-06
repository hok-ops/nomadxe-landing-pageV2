import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import { createClientAccount, registerDevice, assignDevice } from './actions';
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
  const users = authUsersResponse?.users || [];
  
  const { data: devices } = await supabase.from('vrm_devices').select('*');

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
                  {users.map((u) => (
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

        {/* Audit / Status Area */}
        <div className="mt-12 bg-surface/50 border border-white/5 rounded-3xl p-8 backdrop-blur-sm">
           <h3 className="text-sm font-mono text-white/30 uppercase tracking-[0.2em] mb-6">System Registry Audit</h3>
           <div className="grid md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <p className="text-xs font-bold text-blue border-b border-blue/20 pb-2">Active Clients</p>
                <ul className="space-y-2 opacity-70">
                  {users.length > 0 ? users.map(u => (
                    <li key={u.id} className="text-sm font-mono flex justify-between">
                      <span>{u.email}</span>
                      <span className="text-[10px] text-white/20">{u.id.substring(0, 8)}...</span>
                    </li>
                  )) : <li className="text-xs italic text-white/20">None identified.</li>}
                </ul>
              </div>
              <div className="space-y-4">
                <p className="text-xs font-bold text-blue border-b border-blue/20 pb-2">Registered Nodes</p>
                <ul className="space-y-2 opacity-70">
                  {devices && devices.length > 0 ? devices.map((d: any) => (
                    <li key={d.id} className="text-sm font-mono flex justify-between">
                       <span>{d.name}</span>
                       <span className="text-xs text-white/40">{d.vrm_site_id}</span>
                    </li>
                  )) : <li className="text-xs italic text-white/20">None identified.</li>}
                </ul>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
