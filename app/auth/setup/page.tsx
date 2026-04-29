import { cookies } from 'next/headers';
import Link from 'next/link';
import SetupForm from './SetupForm';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { AUTH_TOKEN_COOKIE_NAMES } from '@/lib/authTokenCookies';

export const metadata = { title: 'Activate Account | NomadXE' };

async function validateToken(token: string) {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from('auth_tokens')
    .select('user_id, expires_at, used_at')
    .eq('token', token)
    .eq('type', 'invite')
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
        <div>
          <h1 className="text-white font-bold text-lg mb-2">{title}</h1>
          <p className="text-[#93c5fd]/50 text-sm leading-relaxed">{body}</p>
        </div>
        {cta ?? (
          <Link href="/login" className="inline-block text-sm text-[#3b82f6]/70 hover:text-[#3b82f6] transition-colors">
            Back to Sign In
          </Link>
        )}
      </div>
    </Shell>
  );
}

export default async function SetupPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_TOKEN_COOKIE_NAMES.invite)?.value;

  if (!token) {
    return (
      <ErrorState
        title="Invalid Invitation Link"
        body="This activation session is missing or expired. Please use the latest invite email from your administrator."
      />
    );
  }

  const record = await validateToken(token);
  if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
    return (
      <ErrorState
        title="Invitation Expired"
        body="This activation link is invalid, expired, or already used. Ask your administrator to resend your invitation."
      />
    );
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== record.user_id) {
    return (
      <ErrorState
        title="Session Mismatch"
        body="This activation session does not match the signed-in account. Open the latest invite email in this browser."
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
              <h1 className="text-[17px] font-bold text-white">Activate your account</h1>
              <p className="text-[12px] text-[#93c5fd]/45">Set your name and password to complete setup.</p>
            </div>
          </div>
          <SetupForm />
        </div>
      </div>
      <p className="text-center text-[9.5px] text-[#93c5fd]/18 mt-5 font-mono uppercase tracking-[0.22em]">
        Secure - Invite-only - NomadXE
      </p>
    </Shell>
  );
}
