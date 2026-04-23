'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import NomadXECoreView, { type VRMData } from '@/components/dashboard/NomadXECoreView';
import FleetTile from '@/components/dashboard/FleetTile';
import FleetFilter, { type FleetFilters, EMPTY_FILTERS, deviceMatchesFilters, hasActiveFilters } from '@/components/dashboard/FleetFilter';
import ReadingKey from '@/components/dashboard/ReadingKey';
import ThemeToggle from '@/components/ThemeToggle';

export interface Device { siteId: string; name: string; displayName: string | null }
interface Props {
  devices: Device[];
  initialDataMap: Record<string, VRMData | null>;
}

export default function DashboardClient({ devices, initialDataMap }: Props) {
  const [dataMap, setDataMap] = useState<Record<string, VRMData | null>>(initialDataMap);
  const [displayNames, setDisplayNames] = useState<Record<string, string | null>>(
    Object.fromEntries(devices.map(d => [d.siteId, d.displayName]))
  );

  const handleDeviceData = useCallback((siteId: string, freshData: VRMData) => {
    setDataMap(prev => ({ ...prev, [siteId]: freshData }));
  }, []);

  const handleRename = async (siteId: string, newName: string) => {
    const trimmed = newName.trim();
    try {
      const res = await fetch(`/api/devices/${siteId}/display-name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (res.ok) {
        setDisplayNames(prev => ({ ...prev, [siteId]: trimmed || null }));
      }
    } catch { /* keep existing name */ }
  };

  const [selectedIds, setSelectedIds] = useState<string[]>(
    devices.length === 1 ? [devices[0].siteId] : []
  );
  const [mobileView, setMobileView] = useState<'fleet' | 'detail'>('fleet');
  const [filters, setFilters] = useState<FleetFilters>(EMPTY_FILTERS);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const prevSelectedRef = useRef<string[]>(selectedIds);

  const pollDevice = useCallback(async (siteId: string) => {
    try {
      const res = await fetch(`/api/vrm/${siteId}`, { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login?error=Session+expired.+Please+sign+in+again.';
        return;
      }
      if (res.ok) {
        const json = await res.json();
        if (json.data) setDataMap(prev => ({ ...prev, [siteId]: json.data }));
      }
    } catch { /* network error */ }
  }, []);

  const devicesRef = useRef(devices);
  useEffect(() => { devicesRef.current = devices; }, [devices]);

  // VRM logs telemetry every 1–5 min; polling faster wastes API quota and CPU.
  // We tick every 5 min and jitter each device's fetch across a short window to
  // avoid a thundering herd when many trailers are assigned.
  useEffect(() => {
    const POLL_MS = 5 * 60_000;
    const JITTER_MAX_MS = 4_000;
    const fanOut = () => {
      devicesRef.current.forEach((d, i) => {
        const delay = Math.min(i * 180, JITTER_MAX_MS) + Math.random() * 250;
        setTimeout(() => pollDevice(d.siteId), delay);
      });
    };
    const id = setInterval(fanOut, POLL_MS);
    return () => clearInterval(id);
  }, [pollDevice]);

  useEffect(() => {
    const prev = prevSelectedRef.current;
    const added = selectedIds.find(id => !prev.includes(id));
    prevSelectedRef.current = selectedIds;
    if (!added || !detailPanelRef.current) return;
    const card = detailPanelRef.current.querySelector(`[data-site-id="${added}"]`);
    if (card) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [selectedIds]);

  const toggleSite = (siteId: string) => {
    setSelectedIds(prev => {
      const next = prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId];
      setMobileView(next.length > 0 ? 'detail' : 'fleet');
      return next;
    });
  };

  const closeAll = () => { setSelectedIds([]); setMobileView('fleet'); };

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  const nowS = Date.now() / 1000;
  const onlineCount = devices.filter(d => {
    const data = dataMap[d.siteId];
    return data ? (nowS - data.lastSeen) < 15 * 60 : false;
  }).length;

  const filteredDevices = devices.filter(d => deviceMatchesFilters(d, dataMap[d.siteId] ?? null, filters));

  const sortedDevices = [...filteredDevices].sort((a, b) => {
    const da = dataMap[a.siteId];
    const db = dataMap[b.siteId];
    const nameA = (a.displayName ?? a.name).toLowerCase();
    const nameB = (b.displayName ?? b.name).toLowerCase();
    switch (filters.sort) {
      case 'name-asc':
        return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
      case 'name-desc':
        return nameA > nameB ? -1 : nameA < nameB ? 1 : 0;
      case 'battery': {
        const socA = da?.battery.soc ?? -1;
        const socB = db?.battery.soc ?? -1;
        return socB - socA;
      }
      case 'solar': {
        const solA = da?.solar.power ?? -1;
        const solB = db?.solar.power ?? -1;
        return solB - solA;
      }
      case 'status': {
        const rank = (d: VRMData | null) => {
          if (!d || d.lastSeen === 0) return 2;
          return (nowS - d.lastSeen) > 15 * 60 ? 1 : 0;
        };
        return rank(da) - rank(db);
      }
      default:
        return 0;
    }
  });

  const filtersActive = hasActiveFilters(filters);
  const hasMany      = devices.length > 3;
  const hasSelection = selectedIds.length > 0;

  return (
    <div className="nx-page bg-[#080c14] relative" style={{ minHeight: '100dvh' }}>
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.022]"
        style={{ backgroundImage: 'linear-gradient(#3b82f6 1px,transparent 1px),linear-gradient(to right,#3b82f6 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="fixed top-0 left-0 right-0 h-[3px] z-[100] animate-nx-bar" style={{
        background:'linear-gradient(90deg,#1e40af,#3b82f6,#60a5fa,#3b82f6,#1e40af)',
        backgroundSize:'300% 100%',
      }} />

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 pt-6">

        <header className="nx-hdr flex items-center justify-between py-5 border-b border-[#1e3a5f]/60 mb-6 mt-16">
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-1.5 group w-fit">
              <span className="w-2 h-2 rounded-full bg-[#3b82f6] shadow-[0_0_8px_#3b82f6]" />
              <span className="text-[10px] font-bold text-[#3b82f6]/60 group-hover:text-[#3b82f6] uppercase tracking-[0.5em] font-mono transition-colors">NomadXE</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Power Base Readings</h1>
            <p className="text-xs text-[#93c5fd]/40 mt-1 font-mono uppercase tracking-widest">
              <span className="text-[#93c5fd]/75">{onlineCount}/{devices.length} online &middot; {devices.length} unit{devices.length !== 1 ? 's' : ''} assigned</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ReadingKey />
            <Link href="/"
              className="text-[10px] font-bold font-mono border border-[#1e3a5f] text-[#93c5fd]/50 hover:text-white hover:border-[#3b82f6]/50 px-4 sm:px-5 py-2.5 rounded-lg transition-all uppercase tracking-widest">
              &larr; Home
            </Link>
          </div>
        </header>

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

        {devices.length === 1 && (
          <div className="pb-10">
            <NomadXECoreView device={devices[0]} initialData={dataMap[devices[0].siteId] ?? null} displayName={displayNames[devices[0].siteId] ?? null} onRename={handleRename} onData={handleDeviceData} />
          </div>
        )}

        {devices.length > 1 && !hasMany && (
          <div className="space-y-8 pb-10">
            {devices.map(d => (
              <NomadXECoreView key={d.siteId} device={d} initialData={dataMap[d.siteId] ?? null} displayName={displayNames[d.siteId] ?? null} onRename={handleRename} onData={handleDeviceData} />
            ))}
          </div>
        )}

        {hasMany && (
          <>
            <div className="lg:hidden pb-10">
              {mobileView === 'detail' && (
                <div className="flex items-center justify-between mb-4">
                  <button onClick={closeAll} className="flex items-center gap-2 text-[10px] font-bold text-[#93c5fd]/65 hover:text-white font-mono uppercase tracking-widest transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                    Fleet &middot; {devices.length} units
                  </button>
                  <span className="text-[10px] font-mono text-[#93c5fd]/50">{selectedIds.length} open</span>
                </div>
              )}
              {mobileView === 'fleet' && (
                <>
                  <FleetFilter filters={filters} onChange={setFilters} />
                  {sortedDevices.length === 0 && filtersActive ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <p className="text-[#93c5fd]/40 text-sm mb-3">No devices match your filters</p>
                      <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-[10px] font-mono font-bold text-[#3b82f6] hover:text-white uppercase tracking-widest transition-colors">Clear filters</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 items-start content-start">
                      {sortedDevices.map((d, i) => (
                        <FleetTile key={d.siteId} index={i} device={d} data={dataMap[d.siteId] ?? null} selected={selectedIds.includes(d.siteId)} onClick={() => toggleSite(d.siteId)} />
                      ))}
                    </div>
                  )}
                </>
              )}
              {mobileView === 'detail' && (
                <div className="space-y-6">
                  {selectedIds.map(siteId => {
                    const device = devices.find(d => d.siteId === siteId);
                    if (!device) return null;
                    return (
                      <div key={siteId} className="relative">
                        <button onClick={() => toggleSite(siteId)} className="absolute top-3 right-3 z-10 w-6 h-6 rounded-md bg-[#080c14]/80 border border-[#1e3a5f] text-[#93c5fd]/40 hover:text-white hover:border-[#3b82f6]/50 text-xs flex items-center justify-center transition-all" title="Close">&#x2715;</button>
                        <NomadXECoreView device={device} initialData={dataMap[siteId] ?? null} displayName={displayNames[siteId] ?? null} onRename={handleRename} onData={handleDeviceData} />
                      </div>
                    );
                  })}
                  <div className="h-4" />
                </div>
              )}
            </div>

            <div className="hidden lg:flex gap-5 items-start">
              <div className="flex-shrink-0 flex flex-col" style={{ width: hasSelection ? '300px' : '100%' }}>
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <span className="text-[10px] font-bold text-[#93c5fd]/65 uppercase tracking-widest font-mono">Fleet &middot; {devices.length} units</span>
                  {hasSelection && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-[#93c5fd]/65">{selectedIds.length} open</span>
                      <button onClick={closeAll} className="text-[10px] text-[#93c5fd]/65 hover:text-white font-mono uppercase tracking-widest transition-colors">&#x2715; Close all</button>
                    </div>
                  )}
                </div>
                <FleetFilter filters={filters} onChange={setFilters} />
                {sortedDevices.length === 0 && filtersActive ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-[#93c5fd]/40 text-sm mb-3">No devices match your filters</p>
                    <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-[10px] font-mono font-bold text-[#3b82f6] hover:text-white uppercase tracking-widest transition-colors">Clear filters</button>
                  </div>
                ) : (
                  <div
                    className={`overflow-y-auto pr-1 ${hasSelection ? 'space-y-2.5' : 'grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 items-start content-start'}`}
                    style={{ height: 'calc(100vh - 17rem)' }}
                  >
                    {sortedDevices.map((d, i) => (
                      <FleetTile key={d.siteId} index={i} device={d} data={dataMap[d.siteId] ?? null} selected={selectedIds.includes(d.siteId)} onClick={() => toggleSite(d.siteId)} />
                    ))}
                  </div>
                )}
              </div>
              {hasSelection && (
                <div ref={detailPanelRef} className="flex-1 min-w-0 overflow-y-auto space-y-6 pr-1" style={{ height: 'calc(100vh - 14rem)' }}>
                  {selectedIds.map(siteId => {
                    const device = devices.find(d => d.siteId === siteId);
                    if (!device) return null;
                    return (
                      <div key={siteId} data-site-id={siteId} className="relative">
                        <button onClick={() => toggleSite(siteId)} className="absolute top-3 right-3 z-10 w-6 h-6 rounded-md bg-[#080c14]/80 border border-[#1e3a5f] text-[#93c5fd]/40 hover:text-white hover:border-[#3b82f6]/50 text-xs flex items-center justify-center transition-all" title="Close">&#x2715;</button>
                        <NomadXECoreView device={device} initialData={dataMap[siteId] ?? null} displayName={displayNames[siteId] ?? null} onRename={handleRename} onData={handleDeviceData} />
                      </div>
                    );
                  })}
                  <div className="h-8" />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
