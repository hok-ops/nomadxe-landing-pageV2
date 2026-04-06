import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import { createClientAccount, registerDevice, assignDevice, deleteAssignment, updateUserRole } from './actions';
import Link from 'next/link';

export const metadata = {
  title: 'Admin Command Console | NomadXE',
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
  
  const { data: profiles } = await supabase.from('profiles').select('*');
  const { data: devices } = await supabase.from('vrm_devices').select('*');

  const { data: assignments } = await supabase
    .from('device_assignments')
    .select(`
      id,
      user_id,
      device_id,
      vrm_devices(name, vrm_site_id),
      profiles(id)
    `);

  const accentColor = '#00FF41'; // Volt Green

  return (
    <div className="min-h-screen bg-[#080808] text-[#00FF41]/90 font-mono relative selection:bg-[#00FF41] selection:text-black">
      {/* Tactical CRT Overlay */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(0,255,65,0.02),rgba(0,255,65,0.01),rgba(0,255,65,0.02))] bg-[length:100%_4px,3px_100%] z-50 opacity-30" />
      
      <div className="max-w-[1600px] mx-auto px-6 py-12 lg:px-12 relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 border-b border-[#00FF41]/20 pb-8 gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <span className="w-2 h-2 rounded-full bg-[#00FF41] animate-ping" />
               <h1 className="text-3xl font-black tracking-tighter uppercase text-white shadow-[#00FF41]/20">
                 Command_Center // Fleet_Ops
               </h1>
            </div>
            <p className="text-[10px] text-[#00FF41]/40 uppercase tracking-[0.5em] font-mono">
              SECURE_ADMIN_PORTAL // SYSTEM_TIME_SYNCED
            </p>
          </div>
          <Link href="/dashboard" className="text-[11px] font-bold border border-[#00FF41]/30 bg-[#00FF41]/5 px-8 py-3 rounded-sm hover:bg-[#00FF41] hover:text-black transition-all uppercase tracking-[0.3em] shadow-[0_0_15px_rgba(0,255,65,0.1)] active:scale-[0.98]">
            &larr; Exit_To_Dash
          </Link>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          {/* Left Column: Quick Actions & Forms */}
          <div className="xl:col-span-1 space-y-8">
            
            {/* User Provisioning */}
            <section className="bg-black/40 border-l-2 border-[#00FF41] p-6 space-y-6 backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 text-[10px] text-[#00FF41]/20 group-hover:text-[#00FF41]/40 transition-colors">NO_01</div>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3 text-white">
                <span className="w-1.5 h-1.5 bg-[#00FF41]" />
                Provision_Node
              </h2>
              <form action={createClientAccount} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-[#00FF41]/50">Client_Email</label>
                  <input name="email" type="email" required className="w-full bg-black/60 border border-[#00FF41]/20 p-3 text-sm focus:border-[#00FF41] focus:ring-1 focus:ring-[#00FF41]/20 transition-all outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-[#00FF41]/50">Auth_Secret</label>
                  <input name="password" type="password" required className="w-full bg-black/60 border border-[#00FF41]/20 p-3 text-sm focus:border-[#00FF41] focus:ring-1 focus:ring-[#00FF41]/20 transition-all outline-none" />
                </div>
                <button className="w-full bg-[#00FF41]/10 border border-[#00FF41]/40 py-3 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-[#00FF41] hover:text-black transition-all">
                  Initialize_Account
                </button>
              </form>
            </section>

            {/* Trailer Registration */}
            <section className="bg-black/40 border-l-2 border-[#00FF41]/40 p-6 space-y-6 backdrop-blur-md relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-2 text-[10px] text-[#00FF41]/20 group-hover:text-[#00FF41]/40 transition-colors">NO_02</div>
               <h2 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3 text-white">
                <span className="w-1.5 h-1.5 bg-[#00FF41]/60" />
                Register_Unit
              </h2>
              <form action={registerDevice} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-[#00FF41]/50">VRM_ID</label>
                  <input name="vrm_site_id" required className="w-full bg-black/60 border border-[#00FF41]/20 p-3 text-sm focus:border-[#00FF41] outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-[#00FF41]/50">Callsign</label>
                  <input name="name" required className="w-full bg-black/60 border border-[#00FF41]/20 p-3 text-sm focus:border-[#00FF41] outline-none" placeholder="e.g. ALPHA-01" />
                </div>
                <button className="w-full bg-[#00FF41]/5 border border-[#00FF41]/20 py-3 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-white hover:text-black transition-all">
                  Sync_Hardware
                </button>
              </form>
            </section>

            {/* Assignment Form */}
            <section className="bg-black/40 border-l-2 border-[#00FF41]/20 p-6 space-y-6 backdrop-blur-md relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-2 text-[10px] text-[#00FF41]/20 group-hover:text-[#00FF41]/40 transition-colors">NO_03</div>
               <h2 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3 text-white">
                <span className="w-1.5 h-1.5 bg-[#00FF41]/20" />
                Map_Relay
              </h2>
              <form action={assignDevice} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-[#00FF41]/50">Source_Client</label>
                  <select name="user_id" required className="w-full bg-black/60 border border-[#00FF41]/20 p-3 text-sm focus:border-[#00FF41] text-[#00FF41] outline-none appearance-none">
                    <option value="" className="bg-[#050505]">Select...</option>
                    {authUsers.map((u) => (
                      <option key={u.id} value={u.id} className="bg-[#050505]">{u.email}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-[#00FF41]/50">Target_Unit</label>
                  <select name="device_id" required className="w-full bg-black/60 border border-[#00FF41]/20 p-3 text-sm focus:border-[#00FF41] text-[#00FF41] outline-none appearance-none">
                     <option value="" className="bg-[#050505]">Select...</option>
                     {devices?.map((d: any) => (
                       <option key={d.id} value={d.id} className="bg-[#050505]">{d.name}</option>
                     ))}
                  </select>
                </div>
                <button className="w-full bg-[#00FF41] text-black py-3 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white transition-all shadow-[0_0_20px_rgba(0,255,65,0.2)]">
                  Execute_Final_Mapping
                </button>
              </form>
            </section>
          </div>

          {/* Main Area: Fleet Matrix Audit */}
          <div className="xl:col-span-3 space-y-8">
            <div className="bg-[#0a0a0a]/80 border border-[#00FF41]/10 rounded-sm p-8 shadow-2xl relative">
              <div className="flex justify-between items-center mb-8 border-b border-[#00FF41]/10 pb-6">
                <h3 className="text-xl font-black uppercase tracking-[0.4em] text-white">System_Fleet_Registry</h3>
                <div className="flex gap-6 items-center">
                   <div className="flex items-center gap-2">
                     <span className="w-2 h-2 rounded-sm bg-[#00FF41]" />
                     <span className="text-[10px] text-[#00FF41]/40 uppercase tracking-widest font-bold">Relay_Active</span>
                   </div>
                   <div className="text-[10px] font-mono text-white/20">TOTAL_NODES: {devices?.length || 0}</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border-spacing-0">
                  <thead>
                    <tr className="bg-[#00FF41]/5 text-[9px] font-black text-[#00FF41]/60 uppercase tracking-[0.3em]">
                      <th className="p-4 border border-[#00FF41]/10">Access_ID</th>
                      <th className="p-4 border border-[#00FF41]/10 text-center">Status</th>
                      <th className="p-4 border border-[#00FF41]/10">Allocated_Node</th>
                      <th className="p-4 border border-[#00FF41]/10 text-right">Ops</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#00FF41]/5">
                    {assignments && assignments.length > 0 ? (assignments as any[]).map((a) => (
                      <tr key={a.id} className="group hover:bg-[#00FF41]/5 transition-all">
                        <td className="p-5 text-xs text-[#00FF41]/40 border border-[#00FF41]/10 font-mono">
                          {a.profiles?.email || 'UNSET_IDENTITY'}
                        </td>
                        <td className="p-5 border border-[#00FF41]/10 text-center">
                          <span className="px-3 py-1 bg-[#00FF41]/10 text-[9px] font-black border border-[#00FF41]/20 animate-pulse">
                            ACTIVE
                          </span>
                        </td>
                        <td className="p-5 text-sm font-bold text-white border border-[#00FF41]/10">
                          {a.vrm_devices?.name} <span className="opacity-30 text-xs font-normal">::{a.vrm_devices?.vrm_site_id}</span>
                        </td>
                        <td className="p-5 text-right border border-[#00FF41]/10">
                          <form action={deleteAssignment}>
                            <input type="hidden" name="id" value={a.id} />
                            <button className="text-[9px] font-black bg-rose-900/20 text-rose-500 border border-rose-500/30 px-6 py-2 hover:bg-rose-600 hover:text-white transition-all uppercase tracking-widest">
                              Revoke
                            </button>
                          </form>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="p-20 text-center text-[10px] font-black text-[#00FF41]/20 uppercase tracking-[0.5em] italic">No active telemetry mapped to nodes // Waiting for initialization</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Section: Audit Log & User Management */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* User Management */}
               <div className="bg-black/40 border border-[#00FF41]/10 p-8 space-y-6">
                 <h3 className="text-xs font-black uppercase text-white tracking-[0.3em] flex items-center justify-between">
                   <span>Auth_Profiles</span>
                   <span className="text-[9px] opacity-30">REGISTRY_V1.1</span>
                 </h3>
                 <div className="max-h-80 overflow-y-auto space-y-3 tactical-scrollbar pr-2">
                   {authUsers.map(u => {
                      const p = profiles?.find(prof => prof.id === u.id);
                      return (
                        <div key={u.id} className="flex items-center justify-between p-4 bg-[#050505] border border-[#00FF41]/5 group">
                          <div>
                            <p className="text-xs text-[#00FF41]/80 font-bold">{u.email}</p>
                            <p className={`text-[8px] uppercase tracking-widest font-black ${p?.role === 'admin' ? 'text-blue-400' : 'text-[#00FF41]/40'}`}>
                              ACL_LEVEL: {p?.role || 'user'}
                            </p>
                          </div>
                          <form action={updateUserRole}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="role" value={p?.role === 'admin' ? 'user' : 'admin'} />
                            <button className="text-[8px] font-black px-4 py-2 bg-white/5 border border-white/10 text-white/40 uppercase hover:bg-[#00FF41] hover:text-black hover:border-transparent transition-all">
                              Cycle_Role
                            </button>
                          </form>
                        </div>
                      )
                   })}
                 </div>
               </div>

               {/* Nodes Physical Mapping */}
               <div className="bg-black/40 border border-[#00FF41]/10 p-8 space-y-6">
                 <h3 className="text-xs font-black uppercase text-white tracking-[0.3em] flex items-center justify-between">
                   <span>Nodes_Hardware_Map</span>
                   <span className="text-[9px] opacity-30">VRM_LINK: CONNECTED</span>
                 </h3>
                 <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                    {devices?.map((d: any) => (
                      <div key={d.id} className="p-4 bg-[#050505] border border-[#00FF41]/5 flex justify-between items-center group">
                         <div>
                           <p className="text-xs font-black text-[#00FF41] uppercase tracking-widest">{d.name}</p>
                           <p className="text-[9px] opacity-30 font-mono">SITE_ID_{d.vrm_site_id}</p>
                         </div>
                         <div className="flex gap-1">
                           {[1,2,3].map(i => (
                             <div key={i} className="w-1 h-3 bg-[#00FF41]/20 rounded-full group-hover:bg-[#00FF41] transition-all" />
                           ))}
                         </div>
                      </div>
                    ))}
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


