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

  // Securely retrieve users directly via admin API wrapper as auth.users is restricted 
  const adminClient = createAdminClient();
  const { data: authUsers } = await adminClient.auth.admin.listUsers();
  const clients = authUsers?.users || [];

  const { data: devices } = await supabase.from('vrm_devices').select('*');

  return (
    <div className="min-h-screen bg-midnight pt-32 pb-24 px-8 md:px-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-white/10 pb-6 gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">System Admin Controls</h1>
            <p className="font-mono text-sm text-blue/70 uppercase tracking-widest">Device Assignment Routing</p>
          </div>
          <Link href="/dashboard" className="text-[10px] font-mono border border-white/10 px-6 py-2.5 rounded-lg text-white/50 hover:bg-white/5 hover:text-white transition-all uppercase tracking-[0.2em]">
            &larr; Exit to Dashboard
          </Link>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Create User Form section */}
          <div className="bg-surface border border-white/5 p-8 rounded-2xl shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6">Provision Client</h2>
            <form action={createClientAccount} className="flex flex-col gap-4">
              <input name="email" placeholder="Email Address" type="email" className="bg-black/20 text-sm text-white p-4 rounded-xl border border-white/5 focus:outline-none focus:border-blue/50" required />
              <input name="password" placeholder="Password" type="password" className="bg-black/20 text-sm text-white p-4 rounded-xl border border-white/5 focus:outline-none focus:border-blue/50" required />
              <button className="bg-blue mt-4 py-4 rounded-xl text-midnight font-bold tracking-widest uppercase text-sm hover:shadow-blue-glow transition-all">Create Profile</button>
            </form>
          </div>
          {/* Register Device Form section */}
          <div className="bg-surface border border-white/5 p-8 rounded-2xl shadow-xl">
             <h2 className="text-xl font-bold text-white mb-6">Register VRM Node</h2>
             <form action={registerDevice} className="flex flex-col gap-4">
              <input name="vrm_site_id" placeholder="VRM Numeric ID" className="bg-black/20 text-sm text-white p-4 rounded-xl border border-white/5 focus:outline-none focus:border-blue/50" required />
              <input name="name" placeholder="Trailer Nickname" className="bg-black/20 text-sm text-white p-4 rounded-xl border border-white/5 focus:outline-none focus:border-blue/50" required />
              <button className="bg-blue mt-4 py-4 rounded-xl text-midnight font-bold tracking-widest uppercase text-sm hover:shadow-blue-glow transition-all">Register Device</button>
            </form>
          </div>
        </div>

        {/* Assignments matrix */}
        <div className="bg-surface border border-white/5 p-8 rounded-2xl shadow-xl">
          <h2 className="text-xl font-bold text-white mb-6">Device Assignment Matrix</h2>
          <form action={assignDevice} className="flex flex-col md:flex-row gap-6 items-end">
            <div className="flex flex-col gap-3 w-full">
              <label className="text-[10px] text-white/50 uppercase tracking-widest font-mono">Client Account</label>
              <select name="user_id" className="bg-black/20 text-sm text-white p-4 rounded-xl border border-white/5 focus:outline-none focus:border-blue/50 w-full" required>
                <option value="">Select a user...</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>{c.email}</option>
                ))}
              </select>
            </div>
            
            <div className="flex flex-col gap-3 w-full">
              <label className="text-[10px] text-white/50 uppercase tracking-widest font-mono">VRM Device</label>
              <select name="device_id" className="bg-black/20 text-sm text-white p-4 rounded-xl border border-white/5 focus:outline-none focus:border-blue/50 w-full" required>
                <option value="">Select a device...</option>
                {devices?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name} (VRM: {d.vrm_site_id})</option>
                ))}
              </select>
            </div>
            
            <button className="bg-blue py-4 px-8 rounded-xl text-midnight font-bold tracking-widest uppercase text-sm whitespace-nowrap hover:shadow-blue-glow transition-all mt-6 md:mt-0">
              Assign Device
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
