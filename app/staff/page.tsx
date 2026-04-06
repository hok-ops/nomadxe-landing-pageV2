import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default function StaffLoginPage() {

  const signIn = async (formData: FormData) => {
    'use server';

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
       return redirect('/staff?error=Access Denied'); 
    }
    
    return redirect('/admin');
  };

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden flex items-center justify-center p-6 selection:bg-[#00FF41] selection:text-black">
      {/* Tactical Scanline Overlay */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-50 opacity-20" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-40" />

      {/* Dynamic ambient background glow - Emerald Ops accent */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00FF41]/5 rounded-full blur-[120px] pointer-events-none animate-pulse" aria-hidden="true" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00FF41]/10 rounded-full blur-[100px] pointer-events-none" aria-hidden="true" />

      <div className="relative w-full max-w-md bg-black/40 backdrop-blur-3xl border border-[#00FF41]/20 rounded-2xl p-10 shadow-[0_0_50px_rgba(0,255,65,0.1)] overflow-hidden">
        
        {/* Glowing top rim */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#00FF41]/40 to-transparent shadow-[0_0_15px_#00FF41]" />

        <div className="text-center mb-10 mt-2">
          <div className="inline-block px-3 py-1 border border-[#00FF41]/30 rounded text-[10px] font-mono text-[#00FF41] uppercase tracking-[0.3em] mb-6 bg-[#00FF41]/5 animate-pulse">
            Terminal_Active
          </div>
          <p className="font-mono text-xl tracking-[0.4em] uppercase text-white font-bold mb-3 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            OPERATIONS_CONSOLE
          </p>
          <p className="text-[10px] text-[#00FF41]/60 font-mono uppercase tracking-[0.2em]">
            SYSTEM_VERSION // V2.0.4 - SECURE_AUTH_REQUIRED
          </p>
        </div>

        <form action={signIn} className="flex flex-col gap-6 relative z-10 text-center">
          <div className="group text-left">
            <label className="block font-mono text-[9px] text-[#00FF41]/40 mb-2 uppercase tracking-[0.3em] group-focus-within:text-[#00FF41] transition-colors">
              [ IDENTITY_REF ]
            </label>
            <input 
              name="email"
              type="email" 
              required
              className="w-full bg-[#0a0a0a] border border-[#00FF41]/10 rounded-lg px-5 py-4 text-[#00FF41] text-sm font-mono focus:outline-none focus:border-[#00FF41]/50 focus:ring-1 focus:ring-[#00FF41]/30 transition-all shadow-inner placeholder-[#00FF41]/20" 
              placeholder="OP-ALPHA@nomadxe.com" 
            />
          </div>
          <div className="group text-left">
            <label className="block font-mono text-[9px] text-[#00FF41]/40 mb-2 uppercase tracking-[0.3em] group-focus-within:text-[#00FF41] transition-colors">
              [ ACCESS_KEY_BLOCK ]
            </label>
            <input 
              name="password"
              type="password" 
              required
              className="w-full bg-[#0a0a0a] border border-[#00FF41]/10 rounded-lg px-5 py-4 text-[#00FF41] text-sm font-mono focus:outline-none focus:border-[#00FF41]/50 focus:ring-1 focus:ring-[#00FF41]/30 transition-all shadow-inner placeholder-[#00FF41]/20" 
              placeholder="••••••••" 
            />
          </div>
          <button 
            type="submit" 
            className="w-full mt-4 bg-[#00FF41]/10 border border-[#00FF41]/40 text-[#00FF41] font-mono font-bold tracking-[0.3em] uppercase py-4 rounded-lg transition-all duration-300 hover:bg-[#00FF41] hover:text-black hover:shadow-[0_0_30px_rgba(0,255,65,0.4)] active:scale-[0.98]"
          >
            EXECUTE_LOGIN
          </button>
        </form>

        <div className="mt-10 text-center pt-8 border-t border-white/5 relative z-10">
          <Link href="/" className="text-[9px] font-mono text-[#00FF41]/30 hover:text-[#00FF41] transition-colors uppercase tracking-[0.2em]">
            &larr; DISCONNECT_FROM_OPS
          </Link>
        </div>

        {/* Decorative Corner Brackets */}
        <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-[#00FF41]/20" />
        <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-[#00FF41]/20" />
        <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-[#00FF41]/20" />
        <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-[#00FF41]/20" />
      </div>
    </div>
  );
}
