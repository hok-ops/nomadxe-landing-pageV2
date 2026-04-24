'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

export default function OtpResetForm({ prefillEmail }: { prefillEmail: string }) {
  const [email, setEmail]       = useState(prefillEmail);
  const [code, setCode]         = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const router   = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode)            { setError('Enter the code from your email'); return; }
    if (!email)                  { setError('Email is required'); return; }
    if (password.length < 12)    { setError('Password must be at least 12 characters'); return; }
    if (password !== confirm)    { setError('Passwords do not match'); return; }

    setLoading(true);
    setError(null);

    try {
      const { error: otpErr } = await supabase.auth.verifyOtp({
        email,
        token: trimmedCode,
        type: 'recovery',
      });
      if (otpErr) throw new Error(
        otpErr.message.includes('expired') || otpErr.message.includes('invalid')
          ? 'That code is incorrect or has expired. Request a new one.'
          : otpErr.message
      );

      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) throw new Error(pwErr.message);

      router.push('/login?success=Password+updated+—+sign+in+with+your+new+password');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-950/25 border border-red-500/35 rounded-xl p-3.5 text-[12.5px] text-red-400 leading-relaxed">
          {error}
        </div>
      )}

      {/* Email */}
      <div className="space-y-1.5">
        <label className="block text-[10.5px] font-semibold text-[#93c5fd]/55 uppercase tracking-[0.12em]">
          Email address
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 transition-all"
          placeholder="you@example.com"
        />
      </div>

      {/* Code — single input, accepts any length */}
      <div className="space-y-1.5">
        <label className="block text-[10.5px] font-semibold text-[#93c5fd]/55 uppercase tracking-[0.12em]">
          Code from email
        </label>
        <input
          type="text"
          inputMode="numeric"
          required
          autoFocus
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-xl px-4 py-3.5 text-white text-2xl font-black tabular-nums tracking-[0.35em] text-center placeholder:text-[#93c5fd]/20 placeholder:text-sm placeholder:font-normal placeholder:tracking-normal outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 transition-all"
          placeholder="Enter code"
        />
      </div>

      {/* New password */}
      <div className="space-y-1.5">
        <label className="block text-[10.5px] font-semibold text-[#93c5fd]/55 uppercase tracking-[0.12em]">
          New Password
        </label>
        <input
          required
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          minLength={12}
          className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 transition-all"
          placeholder="Min. 12 characters"
        />
      </div>

      {/* Confirm password */}
      <div className="space-y-1.5">
        <label className="block text-[10.5px] font-semibold text-[#93c5fd]/55 uppercase tracking-[0.12em]">
          Confirm Password
        </label>
        <input
          required
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 transition-all"
          placeholder="Re-enter password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 bg-[#2563eb] hover:bg-[#3b82f6] disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm tracking-wide transition-all hover:shadow-[0_0_28px_rgba(59,130,246,0.45)] active:scale-[0.98]"
      >
        {loading ? 'Verifying…' : 'Set New Password'}
      </button>

      <div className="flex items-center justify-between pt-1 text-[11px]">
        <Link href="/forgot-password" className="text-[#3b82f6]/50 hover:text-[#3b82f6] transition-colors">
          ← Request a new code
        </Link>
        <Link href="/login" className="text-[#3b82f6]/50 hover:text-[#3b82f6] transition-colors">
          Back to Sign In
        </Link>
      </div>
    </form>
  );
}
