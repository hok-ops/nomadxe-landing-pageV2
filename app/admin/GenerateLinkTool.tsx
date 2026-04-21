'use client';

import { useState } from 'react';

export default function GenerateLinkTool({ users }: { users: { id: string; email: string | undefined }[] }) {
  const [type, setType]   = useState<'invite' | 'recovery'>('invite');
  const [email, setEmail] = useState('');
  const [link, setLink]   = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied]   = useState(false);

  const generate = async () => {
    setLoading(true); setLink(null); setError(null); setCopied(false);
    try {
      const res = await fetch('/api/admin/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setLink(data.link);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#0d1526] border border-[#1e3a5f]/60 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span className="text-[10px] font-bold text-amber-400/70 uppercase tracking-widest font-mono">
          Dev Tool — Generate Auth Link
        </span>
      </div>
      <p className="text-[11px] text-[#93c5fd]/35 font-mono">
        Generate the link that would be emailed — without sending an email. Use to test invite and reset flows.
      </p>

      {/* Type selector */}
      <div className="flex gap-2">
        {(['invite', 'recovery'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setType(t); setLink(null); setError(null); }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${
              type === t
                ? 'bg-[#1e40af]/30 border-[#3b82f6]/50 text-[#93c5fd]'
                : 'border-[#1e3a5f] text-[#93c5fd]/30 hover:border-[#1e3a5f]/80'
            }`}
          >
            {t === 'invite' ? 'Invite' : 'Password Reset'}
          </button>
        ))}
      </div>

      {/* Email input */}
      <div className="space-y-1.5">
        <label className="block text-[10px] font-semibold text-[#93c5fd]/40 uppercase tracking-widest">
          Email
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            list="admin-emails"
            placeholder="user@example.com"
            className="flex-1 bg-[#080c14] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#3b82f6] transition-all"
          />
          <datalist id="admin-emails">
            {users.map(u => u.email && <option key={u.id} value={u.email} />)}
          </datalist>
          <button
            type="button"
            onClick={generate}
            disabled={loading || !email}
            className="px-4 py-2.5 bg-[#1e40af]/40 hover:bg-[#1e40af]/60 disabled:opacity-40 border border-[#3b82f6]/30 text-[#93c5fd] text-[11px] font-bold rounded-lg transition-all"
          >
            {loading ? '…' : 'Generate'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-[11px] text-red-400 bg-red-950/20 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {link && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-emerald-400/60 font-mono uppercase tracking-widest">Link generated</span>
            <button
              type="button"
              onClick={copy}
              className="text-[10px] font-bold text-[#3b82f6]/60 hover:text-[#3b82f6] transition-colors"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[10px] font-mono text-[#3b82f6]/50 hover:text-[#3b82f6] break-all leading-relaxed border border-[#1e3a5f]/50 rounded-lg px-3 py-2 bg-[#080c14] transition-colors"
          >
            {link}
          </a>
          <p className="text-[10px] text-[#93c5fd]/25 font-mono">
            Click the link above or copy and open in a browser to test the full flow.
          </p>
        </div>
      )}
    </div>
  );
}
