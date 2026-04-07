'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RemoveDeviceButton({
  assignmentId,
  deviceName,
}: {
  assignmentId: number;
  deviceName: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRemove = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/assign-device', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      });
      if (res.ok) router.refresh();
    } catch {
      // Silently fail — refresh will show current state
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      title={`Remove ${deviceName}`}
      className="text-[11px] text-[#93c5fd]/20 hover:text-red-400 transition-colors leading-none px-1 disabled:opacity-40"
    >
      ×
    </button>
  );
}
