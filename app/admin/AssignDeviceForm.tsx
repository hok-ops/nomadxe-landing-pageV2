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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deviceSearch, setDeviceSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const filteredDevices = deviceSearch.trim()
    ? devices.filter(d =>
        d.name.toLowerCase().includes(deviceSearch.toLowerCase()) ||
        d.vrm_site_id.toLowerCase().includes(deviceSearch.toLowerCase())
      )
    : devices;

  const toggleDevice = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || selectedIds.size === 0) {
      setError('Select a client and at least one device');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const results = await Promise.all(
      Array.from(selectedIds).map(deviceId =>
        fetch('/api/admin/assign-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, deviceId }),
        }).then(async res => ({
          deviceId,
          ok: res.ok,
          data: await res.json(),
        }))
      )
    );

    const failed = results.filter(r => !r.ok);
    const succeeded = results.filter(r => r.ok);

    if (failed.length > 0) {
      const msgs = failed.map(r => {
        const name = devices.find(d => d.id === r.deviceId)?.name ?? `#${r.deviceId}`;
        return `${name}: ${r.data.error ?? 'failed'}`;
      });
      setError(msgs.join(' · '));
    }

    if (succeeded.length > 0) {
      const names = succeeded.map(r => devices.find(d => d.id === r.deviceId)?.name ?? `#${r.deviceId}`);
      setSuccess(`Assigned: ${names.join(', ')}`);
      setUserId('');
      setSelectedIds(new Set());
      router.refresh();
    }

    setLoading(false);
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

      {/* Client selector */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-widest text-[#93c5fd]/75 font-bold">
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

      {/* Device multi-select */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase tracking-widest text-[#93c5fd]/75 font-bold">
            Victron Devices
          </label>
          {selectedIds.size > 0 && (
            <span className="text-[10px] text-[#3b82f6]/60 font-mono">
              {selectedIds.size} selected
            </span>
          )}
        </div>

        {devices.length === 0 ? (
          <p className="text-[11px] text-amber-400/60 italic">
            No devices registered yet — add one below first.
          </p>
        ) : (
          <>
            {/* Search input */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2.5" opacity="0.4">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={deviceSearch}
                onChange={e => setDeviceSearch(e.target.value)}
                placeholder="Search by name or site ID…"
                className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-[#93c5fd]/25 outline-none focus:border-[#3b82f6]/60 transition-colors font-mono"
              />
              {deviceSearch && (
                <button
                  type="button"
                  onClick={() => setDeviceSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#93c5fd]/30 hover:text-white text-xs transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredDevices.length === 0 ? (
                <p className="text-[11px] text-[#93c5fd]/40 italic px-1 py-2">
                  No devices match &ldquo;{deviceSearch}&rdquo;
                </p>
              ) : (
                filteredDevices.map((d) => {
                  const checked = selectedIds.has(d.id);
                  return (
                    <label
                      key={d.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                        checked
                          ? 'border-[#3b82f6]/50 bg-[#1e40af]/15'
                          : 'border-[#1e3a5f] hover:border-[#1e3a5f]/80 bg-[#080c14]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDevice(d.id)}
                        className="w-3.5 h-3.5 accent-[#3b82f6] flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{d.name}</div>
                        <div className="text-[10px] text-[#93c5fd]/30 font-mono">{d.vrm_site_id}</div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || !userId || selectedIds.size === 0 || devices.length === 0}
        className="w-full border border-[#1e40af] text-[#93c5fd] hover:bg-[#1e40af]/30 font-bold py-3 rounded-lg text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading
          ? 'Assigning…'
          : selectedIds.size > 1
            ? `Assign ${selectedIds.size} Devices`
            : 'Assign Device'}
      </button>
    </form>
  );
}
