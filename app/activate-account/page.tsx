'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { activateAccount } from './actions';

export default function ActivateAccountPage() {
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setSessionError(true);
      setChecking(false);
    });
  }, []);

  const handleActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await activateAccount(fullName, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <span className="font-mono text-[#3b82f6]/50 text-sm animate-pulse tracking-widest">
          VERIFYING SESSION...
        </span>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#0d1526] border border-[#1e3a5f] rounded-2xl p-10 text-center space-y-6">
          <div className="w-12 h-12 rounded-xl bg-red-900/20 border border-red-500/20 flex items-center justify-center mx-auto">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg mb-2">Invite Link Expired</h1>
            <p className="text-[#93c5fd]/50 text-sm leading-relaxed">
              This activation link is invalid or has already been used. Please ask your administrator to send a new invite.
            </p>
          </div>
          <a href="/login" className="inline-block text-sm text-[#3b82f6]/70 hover:text-[#3b82f6] transition-colors">
            ← Back to Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-6 relative overflow-hidden">
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="bg-[#0d1526] border border-[#1e3a5f]/80 rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)]">
          <div className="h-px w-full rounded-t-2xl bg-gradient-to-r from-transparent via-[#3b82f6]/30 to-transparent" />

          <div className="px-8 pt-10 pb-8 sm:px-10 sm:pt-12 sm:pb-10">
            <div className="text-center mb-10">
              <div className="w-12 h-12 rounded-xl bg-[#1e40af]/20 border border-[#3b82f6]/20 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <span className="font-mono text-[22px] font-black tracking-[0.18em] uppercase text-white">
                NOMAD<span className="text-[#3b82f6]">XE</span>
              </span>
              <div className="mt-4 space-y-1">
                <h1 className="text-[17px] font-bold text-white">Activate your account</h1>
                <p className="text-[12px] text-[#93c5fd]/45">Set your name and password to complete setup.</p>
              </div>
            </div>

            {error && (
              <div className="mb-5 bg-red-950/25 border border-red-500/35 rounded-xl p-3.5 text-[12.5px] text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleActivation} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10.5px] font-semibold text-[#93c5fd]/55 uppercase tracking-[0.12em]">
                  Full Name
                </label>
                <input
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 transition-all"
                  placeholder="Jane Smith"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10.5px] font-semibold text-[#93c5fd]/55 uppercase tracking-[0.12em]">
                  Create Password
                </label>
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 transition-all"
                  placeholder="Min. 8 characters"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-[#2563eb] hover:bg-[#3b82f6] disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm tracking-wide transition-all hover:shadow-[0_0_28px_rgba(59,130,246,0.45)] active:scale-[0.98]"
              >
                {loading ? 'Activating…' : 'Activate Account'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-[9.5px] text-[#93c5fd]/18 mt-5 font-mono uppercase tracking-[0.22em]">
          Secure · Invite-only · NomadXE
        </p>
      </div>
    </div>
  );
}
