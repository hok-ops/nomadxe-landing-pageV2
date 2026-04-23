'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteUserButton({ userId, email }: { userId: string; email: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`Permanently delete ${email}?\n\nThis removes the account, profile, and all device assignments. It cannot be undone.`)) {
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

      // Refresh the page data to reflect the removed user
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Network error — check console');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleDelete}
        disabled={loading}
        className="text-[10px] font-bold px-3 py-2 rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? '…' : 'Delete'}
      </button>

      {/* Inline error tooltip — visible without page refresh */}
      {error && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-[#1a0a0a] border border-red-500/50 text-red-300 text-[10px] rounded-lg px-3 py-2 shadow-xl w-[220px] leading-relaxed">
          <span className="font-bold text-red-400">Error: </span>{error}
          <button
            onClick={() => setError(null)}
            className="block mt-1 text-[9px] text-red-400/60 hover:text-red-400"
          >
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}
