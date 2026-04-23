import { createAdminClient } from '@/utils/supabase/admin';
import ResetForm from './ResetForm';
import Link from 'next/link';

export const metadata = { title: 'Reset Password | NomadXE' };

interface Props {
  params: { token: string };
}

async function validateToken(token: string) {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from('auth_tokens')
    .select('user_id, expires_at, used_at')
    .eq('token', token)
    .eq('type', 'recovery')
    .single();
  return data ?? null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />
      <div className="relative z-10 w-full max-w-[420px]">{children}</div>
    </div>
  );
}

function ErrorState({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <Shell>
      <div className="bg-[#0d1526] border border-[#1e3a5f] rounded-2xl p-10 text-center space-y-6">
        <div className="w-12 h-12 rounded-xl bg-red-900/20 border border-red-500/20 flex items-center justify-center mx-auto">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <h1 className="text-white font-bold text-lg mb-2">{title}</h1>
          <p className="text-[#93c5fd]/50 text-sm leading-relaxed">{body}</p>
        </div>
        {cta}
      </div>
    </Shell>
  );
}

export default async function ResetPage({ params }: Props) {
  const record = await validateToken(params.token);

  if (!record) {
    return (
      <ErrorState
        title="Invalid Reset Link"
        body="This password reset link is invalid or does not exist."
        cta={
          <Link href="/forgot-password"
            className="inline-block bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold px-6 py-3 rounded-xl text-sm transition-all">
            Request New Link
          </Link>
        }
      />
    );
  }

  if (record.used_at) {
    return (
      <ErrorState
        title="Link Already Used"
        body="This password reset link has already been used. If you need to reset again, request a new link."
        cta={
          <div className="flex flex-col gap-3 items-center">
            <Link href="/forgot-password"
              className="inline-block bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold px-6 py-3 rounded-xl text-sm transition-all">
              Request New Link
            </Link>
            <Link href="/login" className="text-sm text-[#3b82f6]/70 hover:text-[#3b82f6] transition-colors">
              ← Back to Sign In
            </Link>
          </div>
        }
      />
    );
  }

  if (new Date(record.expires_at) < new Date()) {
    return (
      <ErrorState
        title="Reset Link Expired"
        body="This password reset link expired after 24 hours. Request a new one below."
        cta={
          <div className="flex flex-col gap-3 items-center">
            <Link href="/forgot-password"
              className="inline-block bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold px-6 py-3 rounded-xl text-sm transition-all">
              Request New Link
            </Link>
            <Link href="/login" className="text-sm text-[#3b82f6]/70 hover:text-[#3b82f6] transition-colors">
              ← Back to Sign In
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <Shell>
      <div className="bg-[#0d1526] border border-[#1e3a5f]/80 rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)]">
        <div className="h-px w-full rounded-t-2xl bg-gradient-to-r from-transparent via-[#3b82f6]/30 to-transparent" />
        <div className="px-8 pt-10 pb-8 sm:px-10 sm:pt-12 sm:pb-10">

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
              <p className="text-[12px] text-[#93c5fd]/45">Choose a new password for your account.</p>
            </div>
          </div>

          <ResetForm token={params.token} />
        </div>
      </div>
      <p className="text-center text-[9.5px] text-[#93c5fd]/18 mt-5 font-mono uppercase tracking-[0.22em]">
        Secure · NomadXE
      </p>
    </Shell>
  );
}
