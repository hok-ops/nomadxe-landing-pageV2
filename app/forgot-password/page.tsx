'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm?type=recovery&next=/reset-password`,
      });

      if (error) throw error;

      setMessage('RECOVERY_TRANSMITTED // Check your email for instructions.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-midnight relative overflow-hidden flex items-center justify-center p-6">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue/10 rounded-full blur-[120px] pointer-events-none" aria-hidden="true" />
      
      <div className="relative w-full max-w-md bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-3xl p-10 shadow-2xl overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue/50 to-transparent opacity-70" />

        <div className="text-center mb-10 mt-2">
          <p className="font-mono text-2xl tracking-[0.3em] uppercase text-white font-bold mb-3">
            RECOVER_ACCESS
          </p>
          <p className="text-xs text-blue/70 font-mono uppercase tracking-widest">
            Initiate Identity Reset
          </p>
        </div>

        <form onSubmit={handleResetRequest} className="flex flex-col gap-6 relative z-10">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-mono uppercase tracking-widest text-center">
              Recovery_Error // {error}
            </div>
          )}

          {message && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase tracking-widest text-center">
              Success // {message}
            </div>
          )}

          <div className="group">
            <label className="block font-mono text-[10px] text-white/40 mb-2 uppercase tracking-[0.2em] group-focus-within:text-blue/70">
              [ TARGET_EMAIL ]
            </label>
            <input 
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/20 border border-white/5 rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-blue/50 transition-all font-mono" 
              placeholder="operator@nomadxe.com" 
            />
          </div>

          <button 
            disabled={loading || !!message}
            className="w-full mt-4 bg-blue text-midnight font-bold tracking-widest uppercase py-4 rounded-xl transition-all shadow-blue-glow hover:scale-[1.02] disabled:opacity-50"
          >
            {loading ? 'TRANSMITTING...' : 'INITIATE_RECOVERY'}
          </button>
        </form>

        <div className="mt-8 text-center pt-8 border-t border-white/5 relative z-10">
          <Link href="/login" className="text-[10px] font-mono text-white/30 hover:text-white transition-colors uppercase tracking-[0.2em]">
            &larr; Abort_to_Identity_Gateway
          </Link>
        </div>
      </div>
    </div>
  );
}
