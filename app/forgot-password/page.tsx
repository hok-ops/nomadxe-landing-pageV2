import { requestPasswordReset } from '@/app/admin/actions';
import OtpResetForm from './OtpResetForm';
import Link from 'next/link';

export const metadata = { title: 'Forgot Password | NomadXE' };

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { sent?: string; error?: string; email?: string };
}) {
  const sent  = searchParams.sent === '1';
  const email = searchParams.email ?? '';

  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="bg-[#0d1526] border border-[#1e3a5f]/80 rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)]">
          <div className="h-px w-full rounded-t-2xl bg-gradient-to-r from-transparent via-[#3b82f6]/30 to-transparent" />

          <div className="px-8 pt-10 pb-8 sm:px-10 sm:pt-12 sm:pb-10">

            {/* Brand */}
            <div className="text-center mb-10">
              <div className="w-12 h-12 rounded-xl bg-[#1e40af]/20 border border-[#3b82f6]/20 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <span className="font-mono text-[22px] font-black tracking-[0.18em] uppercase text-white">
                NOMAD<span className="text-[#3b82f6]">XE</span>
              </span>
              <div className="mt-4 space-y-1">
                <h1 className="text-[17px] font-bold text-white">Reset your password</h1>
                <p className="text-[12px] text-[#93c5fd]/45">
                  {sent
                    ? 'Enter the code from your email below.'
                    : "Enter your email and we'll send a reset code."}
                </p>
              </div>
            </div>

            {/* Error from server action */}
            {searchParams.error && (
              <div className="mb-5 bg-red-950/25 border border-red-500/35 rounded-xl p-3.5 text-[12.5px] text-red-400">
                {decodeURIComponent(searchParams.error)}
              </div>
            )}

            {sent ? (
              /* OTP entry: email was sent, now collect the code + new password */
              <div className="space-y-4">
                <p className="text-[12px] text-[#93c5fd]/45 text-center -mt-2 mb-2">
                  Check your inbox for a 6-digit code.
                </p>
                <OtpResetForm prefillEmail={email} />
              </div>
            ) : (
              /* Step 1: collect email and send the OTP */
              <form action={requestPasswordReset} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email"
                    className="block text-[10.5px] font-semibold text-[#93c5fd]/55 uppercase tracking-[0.12em]">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    autoFocus
                    className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 transition-all"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold py-3.5 rounded-xl text-sm tracking-wide transition-all hover:shadow-[0_0_28px_rgba(59,130,246,0.45)] active:scale-[0.98]"
                >
                  Send Reset Code
                </button>

                <div className="text-center pt-1">
                  <Link href="/login" className="text-[11px] text-[#3b82f6]/50 hover:text-[#3b82f6] transition-colors">
                    ← Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
