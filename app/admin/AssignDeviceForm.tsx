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
  assignmentMap = {},
}: {
  users: AuthUser[];
  devices: Device[];
  assignmentMap?: Record<string, number[]>;
}) {
  const [userId, setUserId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deviceSearch, setDeviceSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  // Derive already-assigned device IDs for the selected user.
  const alreadyAssigned = new Set<number>(userId ? (assignmentMap[userId] ?? []) : []);

  // Hard guard — Norman error prevention: never allow selecting an already-assigned device
  const toggleDevice = (id: number) => {
    if (alreadyAssigned.has(id)) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setError(null);
  };

  // When the user changes, clear device selections so there is no stale state
  const handleUserChange = (newUserId: string) => {
    setUserId(newUserId);
    setSelectedIds(new Set());
    setError(null);
    setSuccess(null);
  };

  const filteredDevices = deviceSearch.trim()
    ? devices.filter(d =>
        d.name.toLowerCase().includes(deviceSearch.toLowerCase()) ||
        d.vrm_site_id.toLowerCase().includes(deviceSearch.toLowerCase())
      )
    : devices;

  // Split into two visual groups
  const availableDevices = filteredDevices.filter(d => !alreadyAssigned.has(d.id));
  const assignedDevices  = filteredDevices.filter(d =>  alreadyAssigned.has(d.id));

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

    const failed    = results.filter(r => !r.ok);
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
          &#x26A0; {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg px-3 py-2.5 text-[11px] text-emerald-400">
          &#x2713; {success}
        </div>
      )}

      {/* Client selector */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-widest text-[#93c5fd]/75 font-bold">
          Client
        </label>
        <select
          value={userId}
          onChange={(e) => handleUserChange(e.target.value)}
          className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#3b82f6] transition-colors"
        >
          <option value="">&#8212; select client &#8212;</option>
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
            No devices registered yet &#8212; add one below first.
          </p>
        ) : (
          <>
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2.5" opacity="0.4">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={deviceSearch}
                onChange={e => setDeviceSearch(e.target.value)}
                placeholder="Search by name or site ID..."
                className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-[#93c5fd]/25 outline-none focus:border-[#3b82f6]/60 transition-colors font-mono"
              />
              {deviceSearch && (
                <button
                  type="button"
                  onClick={() => setDeviceSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#93c5fd]/30 hover:text-white text-xs transition-colors"
                >
                  &#x2715;
                </button>
              )}
            </div>

            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">

              {/* Available devices - selectable */}
              {availableDevices.map((d) => {
                const checked = selectedIds.has(d.id);
                return (
                  <label
                    key={d.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                      checked
                        ? 'border-[#3b82f6]/50 bg-[#1e40af]/15'
                        : 'border-[#1e3a5f] hover:border-[#3b82f6]/30 bg-[#080c14]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDevice(d.id)}
                      className="w-3.5 h-3.5 accent-[#3b82f6] flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">{d.name}</div>
                      <div className="text-[10px] text-[#93c5fd]/30 font-mono">{d.vrm_site_id}</div>
                    </div>
                  </label>
                );
              })}

              {/* Divider - only shown when a user is selected and they have assignments */}
              {userId && assignedDevices.length > 0 && (
                <div className="flex items-center gap-2 pt-1 pb-0.5">
                  <div className="flex-1 h-px bg-[#1e3a5f]/60" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#93c5fd]/30 flex-shrink-0">
                    Already assigned
                  </span>
                  <div className="flex-1 h-px bg-[#1e3a5f]/60" />
                </div>
              )}

              {/* Already-assigned devices - non-interactive, visually distinct */}
              {assignedDevices.map((d) => (
                <div
                  key={d.id}
                  title="Already assigned to this user"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#1e3a5f]/40 bg-[#0a0f1e]/60 cursor-not-allowed opacity-60 select-none"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" className="flex-shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#93c5fd]/40 truncate">{d.name}</div>
                    <div className="text-[10px] text-[#93c5fd]/20 font-mono">{d.vrm_site_id}</div>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500/70 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                    Assigned
                  </span>
                </div>
              ))}

              {filteredDevices.length === 0 && (
                <p className="text-[11px] text-[#93c5fd]/40 italic px-1 py-2">
                  No devices match &quot;{deviceSearch}&quot;
                </p>
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
          ? 'Assigning...'
          : selectedIds.size > 1
            ? `Assign ${selectedIds.size} Devices`
            : 'Assign Device'}
      </button>
    </form>
  );
}
