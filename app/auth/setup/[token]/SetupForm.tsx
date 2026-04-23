'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface Props {
  token: string;
  userId: string;
}

export default function SetupForm({ token, userId }: Props) {
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Confirm the Supabase session is present (set by /auth/confirm before redirect here)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      } else {
        setError('Session not found. Please use the activation link from your email.');
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { setError('Full name is required'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm)  { setError('Passwords do not match'); return; }

    setLoading(true);
    setError(null);

    try {
      // 1. Set the password — requires active Supabase session
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) throw new Error(pwErr.message);

      // 2. Server: update profile + invalidate token
      const res = await fetch('/api/auth/use-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          type: 'invite',
          profileUpdate: { full_name: fullName.trim(), is_active: true, status: 'active' },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);

      router.push('/login?success=Account+activated+—+sign+in+to+continue');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-950/25 border border-red-500/35 rounded-xl p-3.5 text-[12.5px] text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-[10.5px] font-semibold text-[#93c5fd]/55 uppercase tracking-[0.12em]">
          Full Name
        </label>
        <input
          required
          value={fullName}
          onChange={e => setFullName(e.target.value)}
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
          value={password}
          onChange={e => setPassword(e.target.value)}
          minLength={8}
          className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 transition-all"
          placeholder="Min. 8 characters"
        />
      </div>

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
        disabled={loading || !sessionReady}
        className="w-full mt-2 bg-[#2563eb] hover:bg-[#3b82f6] disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm tracking-wide transition-all hover:shadow-[0_0_28px_rgba(59,130,246,0.45)] active:scale-[0.98]"
      >
        {loading ? 'Activating…' : 'Activate Account'}
      </button>
    </form>
  );
}
