'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function ActivateAccountPage() {
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Update Password
      const { error: authError } = await supabase.auth.updateUser({
        password: password,
      });

      if (authError) throw authError;

      // 2. Update Profile Name and Mark Active
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            full_name: fullName,
            is_active: true 
          })
          .eq('id', user.id);

        if (profileError) throw profileError;
      }

      router.push('/dashboard?success=Account_Activated');
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
            INITIALIZE_NODE
          </p>
          <p className="text-xs text-blue/70 font-mono uppercase tracking-widest">
            Complete Operator Profile
          </p>
        </div>

        <form onSubmit={handleActivation} className="flex flex-col gap-6 relative z-10">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-mono uppercase tracking-widest text-center">
              Activation_Error // {error}
            </div>
          )}

          <div className="group">
            <label className="block font-mono text-[10px] text-white/40 mb-2 uppercase tracking-[0.2em] group-focus-within:text-blue/70">
              [ CALLSIGN / FULL_NAME ]
            </label>
            <input 
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-black/20 border border-white/5 rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-blue/50 transition-all font-mono" 
              placeholder="John_Doe" 
            />
          </div>

          <div className="group">
            <label className="block font-mono text-[10px] text-white/40 mb-2 uppercase tracking-[0.2em] group-focus-within:text-blue/70">
              [ SET_ACCESS_KEY ]
            </label>
            <input 
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/20 border border-white/5 rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-blue/50 transition-all font-mono" 
              placeholder="••••••••" 
            />
          </div>

          <button 
            disabled={loading}
            className="w-full mt-4 bg-blue text-midnight font-bold tracking-widest uppercase py-4 rounded-xl transition-all shadow-blue-glow hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
          >
            {loading ? 'SYNCING...' : 'FINALIZE_ACTIVATION'}
          </button>
        </form>
      </div>
    </div>
  );
}
