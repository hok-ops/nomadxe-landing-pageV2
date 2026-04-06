import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import { inviteNewUser, updateUserRole } from '../actions';
import Link from 'next/link';

export const metadata = {
  title: 'User Management // Ops Console',
};

export default async function UserManagement() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return redirect('/dashboard');

  const adminClient = createAdminClient();
  const { data: authUsersResponse } = await adminClient.auth.admin.listUsers();
  const users = authUsersResponse?.users || [];
  
  const { data: profiles } = await supabase.from('profiles').select('*');

  return (
    <div className="min-h-screen bg-[#080808] text-[#00FF41]/90 font-mono relative selection:bg-[#00FF41] selection:text-black pt-32 pb-24">
      {/* Tactical CRT Overlay */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(0,255,65,0.02),rgba(0,255,65,0.01),rgba(0,255,65,0.02))] bg-[length:100%_4px,3px_100%] z-50 opacity-30" />
      
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 border-b border-[#00FF41]/20 pb-8 gap-8">
           <div className="space-y-4">
             <Link href="/admin" className="text-[10px] text-[#00FF41]/40 border border-[#00FF41]/20 px-4 py-1 hover:bg-[#00FF41]/10 hover:text-[#00FF41] transition-all">
               &larr; COMMAND_CENTER_ROOT
             </Link>
             <h1 className="text-4xl font-black tracking-tighter uppercase text-white">
               User_Registry // Node_ACL
             </h1>
           </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
          {/* Invitation Portal */}
          <section className="bg-black/40 border border-[#00FF41]/20 p-8 space-y-8 backdrop-blur-md relative h-fit">
            <h2 className="text-sm font-black uppercase tracking-[0.3em] flex items-center gap-3 text-white">
              <span className="w-2 h-0.5 bg-[#00FF41]" />
              Initialize_Deployment
            </h2>
            <form action={inviteNewUser} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest text-[#00FF41]/50">[ TARGET_EMAIL ]</label>
                <input name="email" type="email" required className="w-full bg-black/60 border border-[#00FF41]/20 p-4 text-sm text-[#00FF41] focus:border-[#00FF41] outline-none" placeholder="client-id@nomadxe.com" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest text-[#00FF41]/50">[ SITE_ID_LOCK ] (OPTIONAL)</label>
                <input name="vrm_site_id" className="w-full bg-black/60 border border-[#00FF41]/20 p-4 text-sm text-[#00FF41] focus:border-[#00FF41] outline-none" placeholder="123456" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest text-[#00FF41]/50">[ NODE_CALLSIGN ]</label>
                <input name="device_name" className="w-full bg-black/60 border border-[#00FF41]/20 p-4 text-sm text-[#00FF41] focus:border-[#00FF41] outline-none" placeholder="e.g. ALPHA-01" />
              </div>
              <button className="w-full bg-[#00FF41] text-black py-4 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white transition-all shadow-[0_0_20px_rgba(0,255,65,0.2)]">
                TRANSMIT_INVITATION
              </button>
            </form>
          </section>

          {/* Active Registry */}
          <div className="xl:col-span-2 space-y-8">
            <div className="bg-[#0a0a0a]/80 border border-[#00FF41]/10 rounded-sm p-8 shadow-2xl">
               <h3 className="text-xs font-black uppercase tracking-[0.4em] text-[#00FF41]/40 mb-8 pb-4 border-b border-[#00FF41]/10">Access_Control_Matrix</h3>
               
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse border-spacing-0">
                    <thead>
                      <tr className="bg-[#00FF41]/5 text-[9px] font-black text-[#00FF41]/60 uppercase tracking-[0.3em]">
                        <th className="p-4 border border-[#00FF41]/10">OPERATOR_ID</th>
                        <th className="p-4 border border-[#00FF41]/10">SECURITY_LEVEL</th>
                        <th className="p-4 border border-[#00FF41]/10">INITIALIZATION_DATE</th>
                        <th className="p-4 border border-[#00FF41]/10 text-right">OPS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#00FF41]/5">
                      {users.map((u) => {
                         const p = profiles?.find(prof => prof.id === u.id);
                         return (
                           <tr key={u.id} className="group hover:bg-[#00FF41]/5 transition-all">
                             <td className="p-5 text-xs text-white border border-[#00FF41]/10">
                               {u.email}
                               {u.last_sign_in_at ? (
                                 <span className="block text-[8px] opacity-30 mt-1 uppercase">LAST_DASHBOARD_PULSE: {new Date(u.last_sign_in_at).toLocaleDateString()}</span>
                               ) : (
                                 <span className="block text-[8px] text-orange-500 mt-1 animate-pulse uppercase tracking-widest">AWAITING_ACTIVATION</span>
                               )}
                             </td>
                             <td className="p-5 border border-[#00FF41]/10">
                               <span className={`px-3 py-1 text-[9px] font-black border ${p?.role === 'admin' ? 'bg-blue-900/20 text-blue-400 border-blue-500/40' : 'bg-[#00FF41]/10 text-[#00FF41]/60 border-[#00FF41]/40'}`}>
                                 {p?.role || 'user'}
                               </span>
                             </td>
                             <td className="p-5 text-xs border border-[#00FF41]/10 opacity-40">
                               {new Date(u.created_at).toLocaleDateString()}
                             </td>
                             <td className="p-5 text-right border border-[#00FF41]/10">
                               <form action={updateUserRole}>
                                 <input type="hidden" name="userId" value={u.id} />
                                 <input type="hidden" name="role" value={p?.role === 'admin' ? 'user' : 'admin'} />
                                 <button className="text-[9px] font-black px-4 py-2 border border-white/10 text-white/30 uppercase hover:bg-[#00FF41] hover:text-black transition-all">
                                   CYCLE_LEVEL
                                 </button>
                               </form>
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
