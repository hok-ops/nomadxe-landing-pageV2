import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = {
  title: 'Sign In | NomadXE',
  description: 'Sign in to your NomadXE account to access your dashboard or operations console.',
};

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  // Already authenticated — route to correct portal immediately
  if (session) {
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    return redirect(profile?.role === 'admin' ? '/admin' : '/dashboard');
  }

  const signIn = async (formData: FormData) => {
    'use server';

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabase = createClient();
    const adminClient = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !user) {
      return redirect(`/login?error=${encodeURIComponent(authError?.message || 'Invalid email or password')}`);
    }

    // Role-based redirect — admin goes to Ops Console, everyone else to dashboard
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log(`[AUTH] ${user.email} signed in — role: ${profile?.role || 'user'}`);

    return redirect(profile?.role === 'admin' ? '/admin' : '/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-6 relative overflow-hidden">

      {/* Subtle grid */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(to right, #3b82f6 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top accent bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />

      {/* Radial glow */}
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(37,99,235,0.08) 0%, transparent 100%)' }}
      />

      <div className="relative z-10 w-full max-w-md">

        {/* Card */}
        <div className="bg-[#0d1526] border border-[#1e3a5f] rounded-2xl p-10 shadow-[0_40px_80px_rgba(0,0,0,0.6)]">

          {/* Logo */}
          <div className="text-center mb-10">
            <Link href="/" className="inline-block mb-6">
              <span className="font-mono text-2xl font-black tracking-[0.2em] uppercase text-white">
                NOMAD<span className="text-[#3b82f6]">XE</span>
              </span>
            </Link>
            <h1 className="text-xl font-bold text-white">Welcome back</h1>
            <p className="text-sm text-[#93c5fd]/50 mt-1.5">
              Sign in to access your portal. Admins are routed to the Operations Console automatically.
            </p>
          </div>

          {/* Error */}
          {searchParams.error && (
            <div className="mb-6 bg-red-950/30 border border-red-500/40 rounded-lg p-4 text-sm text-red-400 flex items-start gap-3">
              <span className="text-red-500 font-bold mt-0.5">⚠</span>
              <span>{searchParams.error}</span>
            </div>
          )}

          {/* Form */}
          <form action={signIn} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold text-[#93c5fd]/60 uppercase tracking-widest">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3.5 text-white text-sm placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/30 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="block text-xs font-semibold text-[#93c5fd]/60 uppercase tracking-widest">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-[#3b82f6]/60 hover:text-[#3b82f6] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3.5 text-white text-sm placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/30 transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold py-3.5 rounded-lg text-sm transition-all hover:shadow-[0_0_24px_rgba(59,130,246,0.4)] active:scale-[0.98] mt-2"
            >
              Sign In
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[#1e3a5f] text-center">
            <Link href="/" className="text-xs text-[#93c5fd]/30 hover:text-[#93c5fd] transition-colors">
              ← Back to NomadXE.com
            </Link>
          </div>
        </div>

        {/* Subtle note */}
        <p className="text-center text-[10px] text-[#93c5fd]/20 mt-6 font-mono uppercase tracking-widest">
          Secure · Role-based access · NomadXE
        </p>
      </div>
    </div>
  );
}
