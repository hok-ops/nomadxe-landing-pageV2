import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  // If already authenticated, redirect to appropriate portal
  if (session) {
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role === 'admin') {
      return redirect('/admin');
    }
    return redirect('/dashboard');
  }

  const signIn = async (formData: FormData) => {
    'use server';

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabase = createClient();
    const adminClient = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !user) {
      console.error(`[AUTH_GATEWAY] Authentication failed for ${email}: ${authError?.message || 'Unknown Error'}`);
      return redirect(`/login?error=${encodeURIComponent(authError?.message || 'Invalid credentials')}`);
    }

    console.log(`[AUTH_GATEWAY] Authenticated User: ${user.email} (ID: ${user.id})`);

    // Role-Based Redirection Logic (Using Admin Client to bypass RLS latency)
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error(`[AUTH_GATEWAY] Profile Fetch Error: ${profileError.message}`);
    }

    if (profile?.role === 'admin') {
      return redirect('/admin');
    }
    
    return redirect('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#00FF41] font-mono relative selection:bg-[#00FF41] selection:text-black flex items-center justify-center p-6 overflow-hidden">
      {/* Tactical CRT Overlay */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(0,255,65,0.02),rgba(0,255,65,0.01),rgba(0,255,65,0.02))] bg-[length:100%_4px,3px_100%] z-50 opacity-20" />
      
      {/* 🚨 TACTICAL CACHE BUSTER: This confirms you are on the Master Gateway Build */}
      <div className="fixed top-0 left-0 right-0 h-1.5 bg-[#00FF41] z-[100] animate-pulse shadow-[0_0_15px_rgba(0,255,65,0.8)]" />
      <div className="fixed top-6 left-6 text-[10px] font-black uppercase tracking-[0.5em] text-[#00FF41]/40 z-[100]">
         [ SYSTEM_LAYER_01: NOMADXE_GATEWAY ]
      </div>

      <div className="relative w-full max-w-lg bg-black border-2 border-[#00FF41]/20 p-12 shadow-[0_0_100px_rgba(0,255,65,0.05)] relative z-10 transition-all hover:border-[#00FF41]/40">
        
        {/* Decorative corner brackets */}
        <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-[#00FF41]" />
        <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-[#00FF41]" />

        <div className="text-center mb-12">
          <h1 className="text-5xl font-black tracking-[-0.15em] uppercase text-white mb-4 italic leading-none">
            NOMAD<span className="text-[#00FF41]">XE</span>
          </h1>
          <div className="flex items-center justify-center gap-3">
            <span className="w-2.5 h-2.5 bg-[#00FF41] rounded-full animate-ping" />
            <p className="text-[11px] text-[#00FF41]/60 uppercase tracking-[0.6em] font-bold">
              IDENTITY_GATEWAY // SECURE_HUB
            </p>
          </div>
        </div>

        {searchParams.error && (
          <div className="mb-10 bg-red-950/20 border border-red-500/50 p-6 text-red-500 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse flex flex-col gap-2">
            <div>[ ! ] AUTH_ERROR_DETECTED</div>
            <div className="opacity-70">{searchParams.error}</div>
          </div>
        )}

        <form action={signIn} className="flex flex-col gap-10">
          <div className="space-y-4">
            <label className="block text-[10px] uppercase tracking-[0.5em] text-[#00FF41]/40 font-black">
              [ TARGET_ID ]
            </label>
            <input 
              name="email"
              type="email" 
              required
              className="w-full bg-black border-2 border-[#00FF41]/20 p-5 text-[#00FF41] text-sm focus:outline-none focus:border-[#00FF41] transition-all placeholder:text-[#00FF41]/30 selection:bg-[#00FF41] selection:text-black font-bold" 
              placeholder="operator@nomadxe.com" 
            />
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] uppercase tracking-[0.5em] text-[#00FF41]/40 font-black">
                [ ACCESS_KEY ]
              </label>
            </div>
            <input 
              name="password"
              type="password" 
              required
              className="w-full bg-black border-2 border-[#00FF41]/20 p-5 text-[#00FF41] text-sm focus:outline-none focus:border-[#00FF41] transition-all placeholder:text-[#00FF41]/30 selection:bg-[#00FF41] selection:text-black font-bold" 
              placeholder="••••••••" 
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-[#00FF41] text-black font-black tracking-[0.5em] uppercase py-6 text-sm hover:bg-white transition-all shadow-[0_0_30px_rgba(0,255,65,0.4)] mt-6 active:scale-[0.98]"
          >
            AUTHENTICATE_SESSION
          </button>
        </form>

        <div className="mt-14 text-center pt-8 border-t border-[#00FF41]/10">
          <Link href="/" className="text-[11px] text-[#00FF41]/20 hover:text-[#00FF41] transition-colors uppercase tracking-[0.4em] font-black">
            &larr; TERMINATE_AND_ABORT
          </Link>
        </div>
      </div>
    </div>
  );
}
