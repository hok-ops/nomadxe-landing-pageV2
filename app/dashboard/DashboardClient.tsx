'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import NomadXECoreView, { type VRMData } from '@/components/dashboard/NomadXECoreView';
import FleetTile from '@/components/dashboard/FleetTile';

interface Device { siteId: string; name: string }

interface Props {
  devices: Device[];
  initialDataMap: Record<string, VRMData | null>;
}

export default function DashboardClient({ devices, initialDataMap }: Props) {
  const [dataMap, setDataMap] = useState<Record<string, VRMData | null>>(initialDataMap);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(
    devices.length === 1 ? devices[0].siteId : null
  );

  const pollDevice = useCallback(async (siteId: string) => {
    try {
      const res = await fetch(`/api/vrm/${siteId}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setDataMap(prev => ({ ...prev, [siteId]: json.data }));
      }
    } catch { /* keep last data */ }
  }, []);

  // Poll all devices every 30s
  useEffect(() => {
    const id = setInterval(() => {
      devices.forEach(d => pollDevice(d.siteId));
    }, 30_000);
    return () => clearInterval(id);
  }, [devices, pollDevice]);

  const selectedDevice = devices.find(d => d.siteId === selectedSiteId) ?? null;
  const onlineCount  = devices.filter(d => {
    const data = dataMap[d.siteId];
    if (!data) return false;
    return (Date.now() / 1000 - data.lastSeen) < 15 * 60;
  }).length;

  const hasMany = devices.length > 3;

  return (
    <div className="min-h-screen bg-[#080c14] pt-28 pb-24 relative">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.022]"
        style={{ backgroundImage: 'linear-gradient(#3b82f6 1px,transparent 1px),linear-gradient(to right,#3b82f6 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">

        {/* Header */}
        <header className="flex items-center justify-between mb-8 pb-6 border-b border-[#1e3a5f]/60">
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-2 group w-fit">
              <span className="w-2 h-2 rounded-full bg-[#3b82f6] shadow-[0_0_8px_#3b82f6]" />
              <span className="text-[10px] font-bold text-[#3b82f6]/60 group-hover:text-[#3b82f6] uppercase tracking-[0.5em] font-mono transition-colors">NomadXE</span>
            </Link>
            <h1 className="text-2xl font-black text-white tracking-tight">Core Diagnostics</h1>
            <p className="text-xs text-[#93c5fd]/40 mt-1 font-mono uppercase tracking-widest">
              {onlineCount}/{devices.length} online · {devices.length} unit{devices.length !== 1 ? 's' : ''} assigned
            </p>
          </div>
          <Link href="/"
            className="text-[10px] font-bold font-mono border border-[#1e3a5f] text-[#93c5fd]/50 hover:text-white hover:border-[#3b82f6]/50 px-5 py-2.5 rounded-lg transition-all uppercase tracking-widest">
            ← Home
          </Link>
        </header>

        {/* Empty state */}
        {devices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1e3a5f]/30 border border-[#1e3a5f] flex items-center justify-center mb-6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
                <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-4 0v2" />
              </svg>
            </div>
            <h2 className="text-white font-bold text-lg mb-2">No Devices Assigned</h2>
            <p className="text-[#93c5fd]/40 text-sm max-w-sm">
              Your account has no Victron units assigned yet. Contact your administrator to link your trailer.
            </p>
          </div>
        )}

        {/* Single device — no fleet UI needed */}
        {devices.length === 1 && (
          <NomadXECoreView
            device={devices[0]}
            initialData={dataMap[devices[0].siteId] ?? null}
          />
        )}

        {/* Fleet view: 2–3 devices — simple stack, no master-detail */}
        {devices.length > 1 && !hasMany && (
          <div className="space-y-8">
            {devices.map(d => (
              <NomadXECoreView key={d.siteId} device={d} initialData={dataMap[d.siteId] ?? null} />
            ))}
          </div>
        )}

        {/* Fleet view: 4+ devices — master-detail */}
        {hasMany && (
          <div className={`flex gap-6 ${selectedDevice ? 'items-start' : ''}`}>

            {/* LEFT: Fleet sidebar / grid */}
            <div className={`transition-all duration-300 ${selectedDevice ? 'w-72 flex-shrink-0' : 'flex-1'}`}>

              {/* Sidebar header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-[#93c5fd]/40 uppercase tracking-widest font-mono">
                  Fleet · {devices.length} units
                </span>
                {selectedDevice && (
                  <button
                    onClick={() => setSelectedSiteId(null)}
                    className="text-[10px] text-[#3b82f6]/50 hover:text-[#3b82f6] font-mono uppercase tracking-widest transition-colors"
                  >
                    ✕ Close
                  </button>
                )}
              </div>

              {/* Tile grid — 1 col in sidebar, responsive grid in full view */}
              <div className={`gap-3 ${
                selectedDevice
                  ? 'flex flex-col'
                  : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
              }`}>
                {devices.map(d => (
                  <FleetTile
                    key={d.siteId}
                    device={d}
                    data={dataMap[d.siteId] ?? null}
                    selected={d.siteId === selectedSiteId}
                    onClick={() => setSelectedSiteId(prev => prev === d.siteId ? null : d.siteId)}
                  />
                ))}
              </div>
            </div>

            {/* RIGHT: Detail panel */}
            {selectedDevice && (
              <div className="flex-1 min-w-0">
                <NomadXECoreView
                  key={selectedDevice.siteId}
                  device={selectedDevice}
                  initialData={dataMap[selectedDevice.siteId] ?? null}
                />
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
