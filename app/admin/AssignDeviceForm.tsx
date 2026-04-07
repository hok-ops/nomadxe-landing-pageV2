'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Device {
  id: number;
  name: string;
  vrm_site_id: string;
}

interface AuthUser {
  id: string;
  email: string | undefined;
}

export function AssignDeviceForm({
  users,
  devices,
}: {
  users: AuthUser[];
  devices: Device[];
}) {
  const [userId, setUserId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !deviceId) {
      setError('Select both a client and a device');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/admin/assign-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, deviceId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        return;
      }

      const deviceName = devices.find(d => String(d.id) === String(deviceId))?.name ?? 'Device';
      setSuccess(`${deviceName} assigned successfully`);
      setUserId('');
      setDeviceId('');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-950/30 border border-red-500/30 rounded-lg px-3 py-2.5 text-[11px] text-red-400 leading-relaxed">
          ⚠ {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg px-3 py-2.5 text-[11px] text-emerald-400">
          ✓ {success}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-widest text-[#3b82f6]/60 font-bold">
          Client
        </label>
        <select
          value={userId}
          onChange={(e) => { setUserId(e.target.value); setError(null); }}
          className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#3b82f6] transition-colors"
        >
          <option value="">— select client —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email ?? u.id}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-widest text-[#3b82f6]/60 font-bold">
          Victron Device
        </label>
        {devices.length === 0 ? (
          <p className="text-[11px] text-amber-400/60 italic">
            No devices registered yet — add one below first.
          </p>
        ) : (
          <select
            value={deviceId}
            onChange={(e) => { setDeviceId(e.target.value); setError(null); }}
            className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#3b82f6] transition-colors"
          >
            <option value="">— select device —</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.vrm_site_id}
              </option>
            ))}
          </select>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || !userId || !deviceId || devices.length === 0}
        className="w-full border border-[#1e40af] text-[#93c5fd] hover:bg-[#1e40af]/30 font-bold py-3 rounded-lg text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Assigning…' : 'Assign Device'}
      </button>
    </form>
  );
}
