import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {

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
      return redirect('/login?error=Invalid credentials');
    }

    // DEBUG: Log the user details arriving at the gateway
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

    console.log(`[AUTH_GATEWAY] Detected Role: ${profile?.role || 'null'}`);

    if (profile?.role === 'admin') {
      console.log(`[AUTH_GATEWAY] Routing to OPS_CONSOLE`);
      return redirect('/admin');
    }
    
    console.log(`[AUTH_GATEWAY] Routing to CLIENT_DASHBOARD`);
    return redirect('/dashboard');
  };



  return (
    <div className="min-h-screen bg-midnight relative overflow-hidden flex items-center justify-center p-6">
      {/* Dynamic ambient background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue/10 rounded-full blur-[120px] pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue/5 rounded-full blur-[100px] pointer-events-none" aria-hidden="true" />

      <div className="relative w-full max-w-md bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-3xl p-10 shadow-2xl overflow-hidden">
        
        {/* Subtle glassmorphic highlight rim */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue/50 to-transparent opacity-70" />

        <div className="text-center mb-10 mt-2">
          <p className="font-mono text-2xl tracking-[0.3em] uppercase text-white font-bold mb-3 drop-shadow-lg">
            NOMADXE
          </p>
          <p className="text-xs text-blue/70 font-mono uppercase tracking-widest">
            Identity Gateway
          </p>
        </div>

        <form action={signIn} className="flex flex-col gap-6 relative z-10">
          <div className="group">
            <label className="block font-mono text-[10px] text-white/40 mb-2 uppercase tracking-[0.2em] group-focus-within:text-blue/70 transition-colors">
              User Email
            </label>
            <input 
              name="email"
              type="email" 
              required
              className="w-full bg-black/20 border border-white/5 rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-blue/50 focus:ring-1 focus:ring-blue/50 transition-all shadow-inner" 
              placeholder="operator@nomadxe.com" 
            />
          </div>
          <div className="group">
            <div className="flex justify-between items-end mb-2">
              <label className="block font-mono text-[10px] text-white/40 uppercase tracking-[0.2em] group-focus-within:text-blue/70 transition-colors">
                Access Key
              </label>
              <Link href="/reset-password" title="Recover account access" className="text-[9px] font-mono text-blue/40 hover:text-blue transition-colors uppercase tracking-widest">
                Forgot Key?
              </Link>
            </div>
            <input 
              name="password"
              type="password" 
              required
              className="w-full bg-black/20 border border-white/5 rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-blue/50 focus:ring-1 focus:ring-blue/50 transition-all shadow-inner" 
              placeholder="••••••••" 
            />
          </div>
          <button 
            type="submit" 
            className="w-full mt-4 bg-gradient-to-r from-blue/90 to-blue hover:from-blue hover:to-blue/90 text-midnight font-bold tracking-widest uppercase py-4 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:shadow-[0_0_30px_rgba(14,165,233,0.5)] active:scale-[0.98]"
          >
            Authenticate
          </button>
        </form>

        <div className="mt-8 text-center pt-8 border-t border-white/5 relative z-10">
          <Link href="/" className="text-[10px] font-mono text-white/30 hover:text-white transition-colors uppercase tracking-[0.2em]">
            &larr; Return to main site
          </Link>
        </div>
      </div>
    </div>
  );
}

