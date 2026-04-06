import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import { inviteNewUser, registerDevice, assignDevice, deleteAssignment, updateUserRole } from './actions';
import Link from 'next/link';

export const metadata = {
  title: 'Admin Command Console | NomadXE',
};

export default async function AdminDashboard() {
  // 1. Initialize High-Clearance Security
  const supabase = createClient();
  const adminClient = createAdminClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  // 2. Perform Explicit Role Validation (Bypass RLS Latency)
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    console.warn(`[ADMIN_GATEWAY] Unauthorized access attempt by ${user.email}. Routing to Client_Dash.`);
    return redirect('/dashboard');
  }

  // 3. Data Fetching for Ops Matrix
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

  return (
    <div className="min-h-screen bg-[#080808] text-[#00FF41]/90 font-mono relative selection:bg-[#00FF41] selection:text-black pt-32 pb-24">
      {/* Tactical CRT Overlay */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(0,255,65,0.02),rgba(0,255,65,0.01),rgba(0,255,65,0.02))] bg-[length:100%_4px,3px_100%] z-50 opacity-30" />
      
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12 relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 border-b border-[#00FF41]/20 pb-8 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
               <span className="w-2 h-2 rounded-full bg-[#00FF41] animate-ping" />
               <h1 className="text-4xl font-black tracking-tighter uppercase text-white">
                 Command_Center // Fleet_Ops
               </h1>
            </div>
            <p className="text-[10px] text-[#00FF41]/40 uppercase tracking-[0.5em]">
              AUTHORIZED_ADMIN_LAYER // SESSION_ACTIVE
            </p>
          </div>
          <Link href="/dashboard" className="text-[10px] font-black border border-[#00FF41]/40 px-8 py-3 rounded-sm hover:bg-[#00FF41] hover:text-black transition-all uppercase tracking-[0.3em]">
            &larr; CLIENT_DASHBOARD
          </Link>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-12">
          
          {/* Quick Actions Panel */}
          <div className="xl:col-span-1 space-y-12">
            
            {/* INVITATION HUB (The New Engine) */}
            <section className="bg-black/60 border border-[#00FF41]/20 p-8 space-y-8 backdrop-blur-xl relative group">
              <div className="absolute top-0 right-0 p-3 text-[9px] text-[#00FF41]/20">ID_01</div>
              <h2 className="text-sm font-black uppercase tracking-[0.3em] flex items-center gap-3 text-white">
                <span className="w-2 h-0.5 bg-[#00FF41]" />
                Invite_New_Client
              </h2>
              <form action={inviteNewUser} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest text-[#00FF41]/50">[ TARGET_EMAIL ]</label>
                  <input name="email" type="email" required className="w-full bg-black/60 border border-[#00FF41]/20 p-4 text-sm text-[#00FF41] outline-none focus:border-[#00FF41]" placeholder="client@nomadxe.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest text-[#00FF41]/50">[ SITE_ID_LOCK ]</label>
                  <input name="vrm_site_id" required className="w-full bg-black/60 border border-[#00FF41]/20 p-4 text-sm text-[#00FF41] outline-none focus:border-[#00FF41]" placeholder="123456" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest text-[#00FF41]/50">[ CALLSIGN ]</label>
                  <input name="device_name" required className="w-full bg-black/60 border border-[#00FF41]/20 p-4 text-sm text-[#00FF41] outline-none focus:border-[#00FF41]" placeholder="ALPHA-01" />
                </div>
                <button className="w-full bg-[#00FF41] text-black py-4 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white transition-all">
                  TRANSMIT_SECURE_INVITATION
                </button>
              </form>
            </section>

            {/* Hardware Registry */}
            <section className="bg-black/40 border border-[#00FF41]/5 p-8 space-y-8 opacity-60 hover:opacity-100 transition-opacity">
               <h2 className="text-sm font-black uppercase tracking-[0.3em] flex items-center gap-3 text-white/60">
                <span className="w-2 h-0.5 bg-[#00FF41]/40" />
                Register_Manual_Unit
              </h2>
               <form action={registerDevice} className="space-y-4">
                <input name="vrm_site_id" required className="w-full bg-black/40 border border-[#00FF41]/10 p-3 text-xs text-[#00FF41] outline-none" placeholder="VRM_SITE_ID" />
                <input name="name" required className="w-full bg-black/40 border border-[#00FF41]/10 p-3 text-xs text-[#00FF41] outline-none" placeholder="CALLSIGN (e.g. BRAVO-02)" />
                <button className="w-full border border-[#00FF41]/20 py-3 text-[9px] font-bold uppercase tracking-[0.3em] hover:bg-[#00FF41]/10">
                  SYNC_HARDWARE
                </button>
              </form>
            </section>
          </div>

          {/* Ops Matrix Audit */}
          <div className="xl:col-span-3 space-y-12">
            <div className="bg-black/80 border border-[#00FF41]/10 p-8 shadow-2xl relative">
              <div className="flex justify-between items-center mb-10 border-b border-[#00FF41]/10 pb-6">
                <h3 className="text-xl font-black uppercase tracking-[0.4em] text-white">Fleet_Control_Matrix</h3>
                <div className="text-[10px] font-mono text-[#00FF41]/40 font-bold uppercase">TOTAL_DEPLOYMENTS: {devices?.length || 0}</div>
              </div>

              <div className="overflow-x-auto tactical-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#00FF41]/5 text-[9px] font-black text-[#00FF41]/60 uppercase tracking-[0.4em]">
                      <th className="p-5 border border-[#00FF41]/10">OPERATOR_EMAIL</th>
                      <th className="p-5 border border-[#00FF41]/10">SECURITY_ROLE</th>
                      <th className="p-5 border border-[#00FF41]/10">ASSIGNED_NODE</th>
                      <th className="p-5 border border-[#00FF41]/10 text-right">OPERATIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#00FF41]/5">
                    {authUsers.map((u) => {
                       const p = profiles?.find(prof => prof.id === u.id);
                       const a = assignments?.filter((as: any) => as.user_id === u.id);
                       return (
                         <tr key={u.id} className="group hover:bg-[#00FF41]/5 transition-all">
                           <td className="p-6 text-xs text-white border border-[#00FF41]/10">
                             {u.email}
                             {u.last_sign_in_at ? (
                               <span className="block text-[8px] opacity-20 mt-1 uppercase">PULSE_DETECTED: {new Date(u.last_sign_in_at).toLocaleDateString()}</span>
                             ) : (
                               <span className="block text-[8px] text-orange-500 mt-1 animate-pulse uppercase tracking-widest">AWAITING_ACTIVATION</span>
                             )}
                           </td>
                           <td className="p-6 border border-[#00FF41]/10">
                             <span className={`px-4 py-1 text-[9px] font-black border ${p?.role === 'admin' ? 'bg-blue-900/20 text-blue-400 border-blue-500/40' : 'bg-[#00FF41]/10 text-[#00FF41]/60 border-[#00FF41]/20'}`}>
                               {p?.role || 'user'}
                             </span>
                           </td>
                           <td className="p-6 text-sm text-white border border-[#00FF41]/10">
                             {a && a.length > 0 ? (
                               a.map((inst: any) => (
                                 <div key={inst.id} className="flex flex-col gap-1">
                                   <span className="font-bold">{inst.vrm_devices?.name}</span>
                                   <span className="text-[10px] opacity-30 font-mono">SITE_ID: {inst.vrm_devices?.vrm_site_id}</span>
                                 </div>
                               ))
                             ) : (
                               <span className="text-[10px] opacity-20 uppercase tracking-widest italic">No_Assignments</span>
                             )}
                           </td>
                           <td className="p-6 text-right border border-[#00FF41]/10">
                             <div className="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
                               <form action={updateUserRole}>
                                 <input type="hidden" name="userId" value={u.id} />
                                 <input type="hidden" name="role" value={p?.role === 'admin' ? 'user' : 'admin'} />
                                 <button className="text-[9px] font-black px-4 py-2 border border-white/10 hover:bg-[#00FF41] hover:text-black transition-all uppercase">
                                   Cycle_ACL
                                 </button>
                               </form>
                             </div>
                           </td>
                         </tr>
                       )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



