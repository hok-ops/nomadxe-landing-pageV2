'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  // Multi-select: ordered array so cards render in selection order
  const [selectedIds, setSelectedIds] = useState<string[]>(
    devices.length === 1 ? [devices[0].siteId] : []
  );
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const prevSelectedRef = useRef<string[]>(selectedIds);

  const pollDevice = useCallback(async (siteId: string) => {
    try {
      const res = await fetch(`/api/vrm/${siteId}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setDataMap(prev => ({ ...prev, [siteId]: json.data }));
      }
    } catch { /* keep last data */ }
  }, []);

  useEffect(() => {
    const id = setInterval(() => devices.forEach(d => pollDevice(d.siteId)), 30_000);
    return () => clearInterval(id);
  }, [devices, pollDevice]);

  // Auto-scroll newly added card into view in the right panel
  useEffect(() => {
    const prev = prevSelectedRef.current;
    const added = selectedIds.find(id => !prev.includes(id));
    prevSelectedRef.current = selectedIds;

    if (!added || !detailPanelRef.current) return;
    const card = detailPanelRef.current.querySelector(`[data-site-id="${added}"]`);
    if (card) {
      // Small delay so the card has rendered before scrolling
      setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }, [selectedIds]);

  const toggleSite = (siteId: string) => {
    setSelectedIds(prev =>
      prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]
    );
  };

  const onlineCount = devices.filter(d => {
    const data = dataMap[d.siteId];
    return data ? (Date.now() / 1000 - data.lastSeen) < 15 * 60 : false;
  }).length;

  const hasMany      = devices.length > 3;
  const hasSelection = selectedIds.length > 0;

  return (
    <div className="bg-[#080c14] relative" style={{ minHeight: '100dvh' }}>
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.022]"
        style={{ backgroundImage: 'linear-gradient(#3b82f6 1px,transparent 1px),linear-gradient(to right,#3b82f6 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 pt-6">

        {/* Header — fixed height so panels below can use calc() */}
        <header className="flex items-center justify-between py-5 border-b border-[#1e3a5f]/60 mb-6 mt-16">
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-1.5 group w-fit">
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

        {/* ── Empty state ── */}
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

        {/* ── 1 device — full card, no fleet chrome ── */}
        {devices.length === 1 && (
          <div className="pb-10">
            <NomadXECoreView device={devices[0]} initialData={dataMap[devices[0].siteId] ?? null} />
          </div>
        )}

        {/* ── 2–3 devices — simple stack ── */}
        {devices.length > 1 && !hasMany && (
          <div className="space-y-8 pb-10">
            {devices.map(d => (
              <NomadXECoreView key={d.siteId} device={d} initialData={dataMap[d.siteId] ?? null} />
            ))}
          </div>
        )}

        {/* ── 4+ devices — dual-panel fleet view ── */}
        {hasMany && (
          <div className="flex gap-5 items-start">

            {/* ── LEFT: scrollable fleet sidebar ── */}
            <div
              className="flex-shrink-0 flex flex-col"
              style={{ width: hasSelection ? '288px' : '100%' }}
            >
              {/* Sidebar toolbar */}
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <span className="text-[10px] font-bold text-[#93c5fd]/40 uppercase tracking-widest font-mono">
                  Fleet · {devices.length} units
                </span>
                {hasSelection && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-[#3b82f6]/50">
                      {selectedIds.length} open
                    </span>
                    <button
                      onClick={() => setSelectedIds([])}
                      className="text-[10px] text-[#93c5fd]/40 hover:text-white font-mono uppercase tracking-widest transition-colors"
                    >
                      ✕ Close all
                    </button>
                  </div>
                )}
              </div>

              {/* Tile list — independently scrollable */}
              <div
                className="overflow-y-auto pr-1 space-y-2.5"
                style={{ height: 'calc(100vh - 14rem)' }}
              >
                {devices.map(d => (
                  <FleetTile
                    key={d.siteId}
                    device={d}
                    data={dataMap[d.siteId] ?? null}
                    selected={selectedIds.includes(d.siteId)}
                    onClick={() => toggleSite(d.siteId)}
                  />
                ))}
              </div>
            </div>

            {/* ── RIGHT: independently scrollable detail stack ── */}
            {hasSelection && (
              <div
                ref={detailPanelRef}
                className="flex-1 min-w-0 overflow-y-auto space-y-6 pr-1"
                style={{ height: 'calc(100vh - 14rem)' }}
              >
                {selectedIds.map(siteId => {
                  const device = devices.find(d => d.siteId === siteId);
                  if (!device) return null;
                  return (
                    <div key={siteId} data-site-id={siteId} className="relative">
                      {/* Per-card close button */}
                      <button
                        onClick={() => toggleSite(siteId)}
                        className="absolute top-3 right-3 z-10 w-6 h-6 rounded-md bg-[#080c14]/80 border border-[#1e3a5f] text-[#93c5fd]/40 hover:text-white hover:border-[#3b82f6]/50 text-xs flex items-center justify-center transition-all"
                        title="Close"
                      >
                        ✕
                      </button>
                      <NomadXECoreView
                        device={device}
                        initialData={dataMap[siteId] ?? null}
                      />
                    </div>
                  );
                })}

                {/* Bottom padding so last card isn't flush against viewport edge */}
                <div className="h-8" />
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
