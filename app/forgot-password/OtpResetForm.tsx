'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

export default function OtpResetForm({ prefillEmail }: { prefillEmail: string }) {
  const [email, setEmail]       = useState(prefillEmail);
  const [digits, setDigits]     = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const inputRefs               = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const supabase = createClient();

  // Handle digit input — auto-advance on entry, auto-retreat on backspace
  const handleDigit = (i: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    if (char && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  // Handle paste of full 6-digit code
  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      inputRefs.current[5]?.focus();
      e.preventDefault();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < 6)     { setError('Enter the full 6-digit code from your email'); return; }
    if (!email)              { setError('Email is required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }

    setLoading(true);
    setError(null);

    try {
      // 1. Exchange OTP code for a session
      const { error: otpErr } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery',
      });
      if (otpErr) throw new Error(otpErr.message === 'Token has expired or is invalid'
        ? 'That code is incorrect or has expired. Request a new one.'
        : otpErr.message
      );

      // 2. Update password (session is now active)
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

      {/* Email (editable in case user needs to correct it) */}
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
        />
      </div>

      {/* 6-digit OTP boxes */}
      <div className="space-y-1.5">
        <label className="block text-[10.5px] font-semibold text-[#93c5fd]/55 uppercase tracking-[0.12em]">
          6-digit code from email
        </label>
        <div className="flex gap-2 justify-between" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className="w-12 h-14 text-center text-xl font-black text-white bg-[#080c14] border border-[#1e3a5f] rounded-xl outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 transition-all tabular-nums"
            />
          ))}
        </div>
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
          minLength={8}
          className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 transition-all"
          placeholder="Min. 8 characters"
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
