import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = {
  title: 'Sign In | NomadXE',
  description: 'Sign in to your NomadXE account to access your dashboard or operations console.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !user) {
      return redirect(
        `/login?error=${encodeURIComponent(authError?.message || 'Invalid email or password')}`
      );
    }

    // Role-based redirect — admin goes to Ops Console, everyone else to client dashboard
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log(`[AUTH] ${user.email} signed in — role: ${profile?.role || 'user'}`);

    return redirect(profile?.role === 'admin' ? '/admin' : '/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">

      {/* Subtle dot-grid background */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'radial-gradient(circle, #3b82f6 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Top accent bar */}
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />

      {/* Ambient radial glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 38%, rgba(37,99,235,0.10) 0%, transparent 100%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[420px]">

        {/* ── Card ── */}
        <div className="bg-[#0d1526] border border-[#1e3a5f]/80 rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(59,130,246,0.04)]">

          {/* Card top-edge highlight */}
          <div className="h-px w-full rounded-t-2xl bg-gradient-to-r from-transparent via-[#3b82f6]/30 to-transparent" />

          <div className="px-8 pt-10 pb-8 sm:px-10 sm:pt-12 sm:pb-10">

            {/* ── Brand / Logo ── */}
            <div className="text-center mb-10">
              <Link
                href="/"
                className="inline-flex flex-col items-center gap-3 group"
                aria-label="Back to NomadXE home"
              >
                {/* Icon mark */}
                <div className="w-12 h-12 rounded-xl bg-[#1e40af]/20 border border-[#3b82f6]/20 flex items-center justify-center group-hover:border-[#3b82f6]/50 group-hover:bg-[#1e40af]/30 transition-all duration-300">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>

                {/* Wordmark */}
                <span className="font-mono text-[22px] font-black tracking-[0.18em] uppercase text-white leading-none">
                  NOMAD<span className="text-[#3b82f6]">XE</span>
                </span>
              </Link>

              <div className="mt-5 space-y-1.5">
                <h1 className="text-[17px] font-bold text-white tracking-tight">
                  Welcome back
                </h1>
                <p className="text-[12.5px] text-[#93c5fd]/45 leading-relaxed max-w-[280px] mx-auto">
                  Sign in to access your portal. Admins are routed to the Operations Console.
                </p>
              </div>
            </div>

            {/* ── Error Alert ── */}
            {searchParams.error && (
              <div className="mb-6 bg-red-950/25 border border-red-500/35 rounded-xl p-3.5 flex items-start gap-3">
                <span className="text-red-400 mt-px flex-shrink-0" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <span className="text-[12.5px] text-red-400 leading-snug">{searchParams.error}</span>
              </div>
            )}

            {/* ── Sign-in Form ── */}
            <form action={signIn} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-[10.5px] font-semibold text-[#93c5fd]/55 uppercase tracking-[0.12em]"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-[#93c5fd]/18 outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 transition-all duration-200"
                  placeholder="you@example.com"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor="password"
                    className="block text-[10.5px] font-semibold text-[#93c5fd]/55 uppercase tracking-[0.12em]"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[11px] text-[#3b82f6]/55 hover:text-[#3b82f6] transition-colors duration-200"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-[#93c5fd]/18 outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 transition-all duration-200"
                  placeholder="••••••••"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full mt-2 bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold py-3.5 rounded-xl text-sm tracking-wide transition-all duration-200 hover:shadow-[0_0_28px_rgba(59,130,246,0.45)] active:scale-[0.98]"
              >
                Sign In
              </button>
            </form>

            {/* ── Divider + Back link ── */}
            <div className="mt-8 pt-6 border-t border-[#1e3a5f]/70 flex items-center justify-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-[11px] text-[#93c5fd]/30 hover:text-[#93c5fd]/70 transition-colors duration-200"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10 12L6 8l4-4" />
                </svg>
                Back to NomadXE.com
              </Link>
            </div>
          </div>
        </div>

        {/* ── Footer note ── */}
        <p className="text-center text-[9.5px] text-[#93c5fd]/18 mt-5 font-mono uppercase tracking-[0.22em]">
          Secure · Role-based access · NomadXE
        </p>
      </div>
    </div>
  );
}
