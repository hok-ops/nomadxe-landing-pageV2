import { cookies } from 'next/headers';
import Link from 'next/link';
import ResetForm from './ResetForm';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { AUTH_TOKEN_COOKIE_NAMES } from '@/lib/authTokenCookies';

export const metadata = { title: 'Reset Password | NomadXE' };

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

function ErrorState({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <div className="bg-[#0d1526] border border-[#1e3a5f] rounded-2xl p-10 text-center space-y-6">
        <div>
          <h1 className="text-white font-bold text-lg mb-2">{title}</h1>
          <p className="text-[#93c5fd]/50 text-sm leading-relaxed">{body}</p>
        </div>
        <div className="flex flex-col gap-3 items-center">
          <Link href="/forgot-password"
            className="inline-block bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold px-6 py-3 rounded-xl text-sm transition-all">
            Request New Link
          </Link>
          <Link href="/login" className="text-sm text-[#3b82f6]/70 hover:text-[#3b82f6] transition-colors">
            Back to Sign In
          </Link>
        </div>
      </div>
    </Shell>
  );
}

export default async function ResetPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_TOKEN_COOKIE_NAMES.recovery)?.value;

  if (!token) {
    return (
      <ErrorState
        title="Invalid Reset Link"
        body="This password reset session is missing or expired. Request a fresh reset link to continue."
      />
    );
  }

  const record = await validateToken(token);
  if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
    return (
      <ErrorState
        title="Reset Link Expired"
        body="This password reset link is invalid, expired, or already used."
      />
    );
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== record.user_id) {
    return (
      <ErrorState
        title="Session Mismatch"
        body="This reset session does not match the signed-in account. Open the latest reset email in this browser."
      />
    );
  }

  return (
    <Shell>
      <div className="bg-[#0d1526] border border-[#1e3a5f]/80 rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)]">
        <div className="h-px w-full rounded-t-2xl bg-gradient-to-r from-transparent via-[#3b82f6]/30 to-transparent" />
        <div className="px-8 pt-10 pb-8 sm:px-10 sm:pt-12 sm:pb-10">
          <div className="text-center mb-10">
            <span className="font-mono text-[22px] font-black tracking-[0.18em] uppercase text-white">
              NOMAD<span className="text-[#3b82f6]">XE</span>
            </span>
            <div className="mt-4 space-y-1">
              <h1 className="text-[17px] font-bold text-white">Reset your password</h1>
              <p className="text-[12px] text-[#93c5fd]/45">Choose a new password for your account.</p>
            </div>
          </div>
          <ResetForm />
        </div>
      </div>
      <p className="text-center text-[9.5px] text-[#93c5fd]/18 mt-5 font-mono uppercase tracking-[0.22em]">
        Secure - NomadXE
      </p>
    </Shell>
  );
}
