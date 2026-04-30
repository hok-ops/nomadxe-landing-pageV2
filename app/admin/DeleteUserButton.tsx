'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteUserButton({ userId, email }: { userId: string; email: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const router = useRouter();

  const canDelete = confirmation.trim() === email;

  const handleDelete = async () => {
    if (!canDelete) {
      setError('Type the account email exactly before deleting.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Server error ${res.status}`);
        return;
      }

      setOpen(false);
      setConfirmation('');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Network error; check console');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={loading}
        className="rounded-lg border border-red-500/20 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-red-400/60 transition-all hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? '...' : 'Delete'}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Delete user account"
          className="absolute right-0 top-full z-50 mt-2 w-[20rem] rounded-xl border border-red-500/35 bg-[#12090c] p-3 text-left shadow-2xl"
        >
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-200">Permanent delete</div>
          <p className="mt-2 text-[11px] leading-relaxed text-red-100/72">
            This removes the account and related access. Use suspension when the account may need to return later.
          </p>
          <label className="mt-3 block">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-red-200/65">
              Type {email}
            </span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-1 w-full rounded-lg border border-red-500/25 bg-[#080c14] px-3 py-2 text-xs text-white outline-none focus:border-red-300"
            />
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmation('');
                setError(null);
              }}
              className="rounded-lg border border-[#1e3a5f] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#93c5fd]/55 transition-colors hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || !canDelete}
              className="rounded-lg border border-red-500/35 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-red-300 transition-all hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[220px] rounded-lg border border-red-500/50 bg-[#1a0a0a] px-3 py-2 text-[10px] leading-relaxed text-red-300 shadow-xl">
          <span className="font-bold text-red-400">Error: </span>{error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="mt-1 block text-[9px] text-red-400/60 hover:text-red-400"
          >
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}
