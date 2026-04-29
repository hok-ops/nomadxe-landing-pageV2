'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import NomadXECoreView, { type VRMData } from '@/components/dashboard/NomadXECoreView';
import FleetTile from '@/components/dashboard/FleetTile';
import FleetFilter, { type FleetFilters, EMPTY_FILTERS, deviceMatchesFilters, hasActiveFilters } from '@/components/dashboard/FleetFilter';
import FleetIntelligenceBriefing from '@/components/dashboard/FleetIntelligenceBriefing';
import FleetMapView from '@/components/dashboard/FleetMapView';
import LeaseCommandCenter from '@/components/dashboard/LeaseCommandCenter';
import ReadingKey from '@/components/dashboard/ReadingKey';
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/components/ToastProvider';
import { formatWatts, getDcLoadSignalTitle, hasMissingDcLoadSignal } from '@/lib/telemetryHealth';
import { assessAssetIntelligence, assessFleetIntelligence } from '@/lib/assetIntelligence';
import type { LeaseOperationsData } from '@/lib/leaseOperations';

export interface Device {
  siteId: string;
  name: string;
  displayName: string | null;
  teltonikaRmsDeviceId: string | null;
  routerAccessUrl: string | null;
}
interface Props {
  devices: Device[];
  initialDataMap: Record<string, VRMData | null>;
  isAdmin: boolean;
  leaseOperations: LeaseOperationsData;
}

type BriefingQueueKey = 'battery' | 'load' | 'offline' | 'charging' | 'healthy';

type BriefingDeviceState = {
  device: Device;
  data: VRMData | null;
  state: 'healthy' | 'battery' | 'load' | 'offline';
  reason: string;
  batterySoc: number | null;
  staleMinutes: number | null;
};

const BATTERY_ALERT_SOC = 80;

const BRIEFING_QUEUE_CONFIG: Record<BriefingQueueKey, {
  label: string;
  helper: string;
  tone: string;
  empty: string;
}> = {
  battery: {
    label: 'Battery Attention',
    helper: 'Live units below 80%',
    tone: '#f59e0b',
    empty: 'No live units are below the 80% battery threshold.',
  },
  offline: {
    label: 'Offline',
    helper: 'Stale or missing telemetry',
    tone: '#fb7185',
    empty: 'No offline or no-telemetry units right now.',
  },
  load: {
    label: 'Load Signal',
    helper: 'Missing DC load reads',
    tone: '#fb923c',
    empty: 'Every live unit has a usable DC load signal.',
  },
  charging: {
    label: 'Charging',
    helper: 'Solar is covering load',
    tone: '#38bdf8',
    empty: 'No units are actively charging right now.',
  },
  healthy: {
    label: 'Healthy',
    helper: 'Live and at least 80%',
    tone: '#22c55e',
    empty: 'No units meet the healthy threshold yet.',
  },
};

function formatSoc(value: number | null) {
  if (value === null) return 'No SOC';
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function isChargingData(data: VRMData) {
  return data.battery.state === 1 || data.solar.power > data.dcLoad;
}

function getDeviceState(device: Device, data: VRMData | null, nowS: number): BriefingDeviceState {
  if (!data || data.lastSeen === 0) {
    return { device, data, state: 'offline', reason: 'No telemetry yet', batterySoc: null, staleMinutes: null };
  }

  const staleSeconds = Math.max(0, nowS - data.lastSeen);
  const staleMinutes = Math.floor(staleSeconds / 60);
  if (staleSeconds > 15 * 60) {
    return { device, data, state: 'offline', reason: `${staleMinutes}m stale`, batterySoc: data.battery.soc, staleMinutes };
  }
  if (data.battery.soc < BATTERY_ALERT_SOC) {
    return {
      device,
      data,
      state: 'battery',
      reason: `Battery below 80%: ${formatSoc(data.battery.soc)}`,
      batterySoc: data.battery.soc,
      staleMinutes,
    };
  }
  if (hasMissingDcLoadSignal(data)) {
    return {
      device,
      data,
      state: 'load',
      reason: `${getDcLoadSignalTitle(data)}: ${formatWatts(data.dcLoad)}`,
      batterySoc: data.battery.soc,
      staleMinutes,
    };
  }

  return {
    device,
    data,
    state: 'healthy',
    reason: `${formatSoc(data.battery.soc)} battery`,
    batterySoc: data.battery.soc,
    staleMinutes,
  };
}

function buildBriefing(devices: Device[], dataMap: Record<string, VRMData | null>, nowS: number) {
  const states = devices.map((device) => getDeviceState(device, dataMap[device.siteId] ?? null, nowS));
  const battery = states
    .filter((item) => item.state === 'battery')
    .sort((a, b) => (a.batterySoc ?? 999) - (b.batterySoc ?? 999));
  const offline = states
    .filter((item) => item.state === 'offline')
    .sort((a, b) => (b.staleMinutes ?? 9999) - (a.staleMinutes ?? 9999));
  const load = states
    .filter((item) => item.state === 'load')
    .sort((a, b) => (a.device.displayName ?? a.device.name).localeCompare(b.device.displayName ?? b.device.name));
  const charging = states
    .filter((item) => item.data && item.state !== 'offline' && isChargingData(item.data))
    .sort((a, b) => (a.batterySoc ?? 999) - (b.batterySoc ?? 999));
  const healthy = states
    .filter((item) => item.state === 'healthy')
    .sort((a, b) => (a.device.displayName ?? a.device.name).localeCompare(b.device.displayName ?? b.device.name));
  const queues = { battery, load, offline, charging, healthy };
  const priority = battery[0] ?? load[0] ?? offline[0] ?? charging[0] ?? healthy[0] ?? null;
  const alertParts = [
    battery.length > 0 ? `${battery.length} battery ${battery.length === 1 ? 'alert' : 'alerts'}` : null,
    load.length > 0 ? `${load.length} load ${load.length === 1 ? 'signal' : 'signals'}` : null,
    offline.length > 0 ? `${offline.length} offline` : null,
  ].filter(Boolean);
  const opening = alertParts.length > 0
    ? `${alertParts.join(' and ')}. ${healthy.length} healthy.`
    : `${healthy.length} units healthy. No battery, load, or offline alerts.`;

  return { states, queues, battery, load, offline, charging, healthy, priority, opening };
}

function getDefaultBriefingQueue(briefing: ReturnType<typeof buildBriefing>): BriefingQueueKey {
  if (briefing.battery.length > 0) return 'battery';
  if (briefing.load.length > 0) return 'load';
  if (briefing.offline.length > 0) return 'offline';
  if (briefing.charging.length > 0) return 'charging';
  return 'healthy';
}

function BriefingMetric({
  label,
  count,
  tone,
  helper,
  active,
  isLight,
  onClick,
}: {
  label: string;
  count: number;
  tone: string;
  helper: string;
  active: boolean;
  isLight: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`rounded-xl border px-4 py-3 text-left transition-all hover:-translate-y-px ${
        active
          ? isLight
            ? 'border-slate-900 bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)]'
            : 'border-white/25 bg-white/[0.08] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
          : isLight
            ? 'border-slate-200 bg-white/75 text-slate-950 hover:border-slate-400'
            : 'border-white/10 bg-black/20 text-white hover:border-white/20'
      }`}
    >
      <div className={`text-[9px] font-mono font-black uppercase tracking-[0.28em] ${
        active ? 'text-white/60' : isLight ? 'text-slate-500' : 'text-[#93c5fd]/45'
      }`}>
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tabular-nums" style={{ color: active ? '#ffffff' : tone }}>{count}</div>
      <div className={`mt-1 text-[10px] font-bold ${active ? 'text-white/55' : isLight ? 'text-slate-500' : 'text-slate-500'}`}>
        {helper}
      </div>
    </button>
  );
}

function ShiftBriefingPanel({
  briefing,
  isLight,
  onOpenDevice,
}: {
  briefing: ReturnType<typeof buildBriefing>;
  isLight: boolean;
  onOpenDevice: (siteId: string) => void;
}) {
  const [activeQueue, setActiveQueue] = useState<BriefingQueueKey>(() => getDefaultBriefingQueue(briefing));
  const activeConfig = BRIEFING_QUEUE_CONFIG[activeQueue];
  const activeItems = briefing.queues[activeQueue];
  const queueLead = activeItems[0] ?? briefing.priority;
  const queueLeadName = queueLead ? (queueLead.device.displayName ?? queueLead.device.name) : 'No units in this queue';
  const queueLeadReason = queueLead?.reason ?? activeConfig.empty;

  return (
    <section className={`mb-6 overflow-hidden rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] ${
      isLight
        ? 'border-slate-200 bg-[linear-gradient(135deg,#ffffff,#f8fafc)] text-slate-950'
        : 'border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.15),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(5,8,18,0.98))] text-white'
    }`}>
      <div className="grid gap-5 xl:grid-cols-[1fr_0.72fr]">
        <div>
          <div className={`text-[10px] font-black uppercase tracking-[0.42em] ${isLight ? 'text-amber-700' : 'text-amber-200'}`}>
            Shift Briefing
          </div>
          <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight md:text-4xl" style={{ fontFamily: 'var(--font-playfair)' }}>
            {briefing.opening}
          </h2>
          <p className={`mt-3 max-w-2xl text-sm leading-6 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Pick a queue to filter the list on the right, then open the trailer that needs attention. Healthy means live, at least 80% battery, and a usable DC load signal.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {(['battery', 'load', 'offline', 'charging', 'healthy'] as BriefingQueueKey[]).map((key) => {
              const config = BRIEFING_QUEUE_CONFIG[key];
              return (
                <BriefingMetric
                  key={key}
                  label={config.label}
                  count={briefing.queues[key].length}
                  tone={config.tone}
                  helper={config.helper}
                  active={activeQueue === key}
                  isLight={isLight}
                  onClick={() => setActiveQueue(key)}
                />
              );
            })}
          </div>
        </div>
        <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/25'}`}>
          <div className={`text-[10px] font-black uppercase tracking-[0.28em] ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/45'}`}>
            Selected Queue
          </div>
          <div className="mt-3 text-2xl font-black">{activeConfig.label}</div>
          <div className={`mt-2 text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            First unit: <span className="font-black">{queueLeadName}</span>. {queueLeadReason}
          </div>
          <div className={`mt-4 overflow-hidden rounded-lg border ${
            isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/[0.04]'
          }`}>
            <div className={`flex items-center justify-between gap-3 border-b px-3 py-2 ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <span className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: activeConfig.tone }}>
                {activeConfig.label}
              </span>
              <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {activeItems.length} unit{activeItems.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {activeItems.length === 0 ? (
                <div className={`px-3 py-4 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {activeConfig.empty}
                </div>
              ) : (
                <div className="space-y-2">
                  {activeItems.map((item) => (
                    <button
                      key={`${activeQueue}-${item.device.siteId}`}
                      type="button"
                      onClick={() => onOpenDevice(item.device.siteId)}
                      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                        isLight
                          ? 'border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-white'
                          : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-black">{item.device.displayName ?? item.device.name}</span>
                        <span className="text-[10px] font-mono font-black tabular-nums" style={{ color: activeConfig.tone }}>
                          {formatSoc(item.batterySoc)}
                        </span>
                      </div>
                      <div className={`mt-1 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {item.device.siteId} - {item.reason}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function DashboardClient({ devices, initialDataMap, isAdmin, leaseOperations }: Props) {
  const [dataMap, setDataMap] = useState<Record<string, VRMData | null>>(initialDataMap);
  const [displayNames, setDisplayNames] = useState<Record<string, string | null>>(
    Object.fromEntries(devices.map(d => [d.siteId, d.displayName]))
  );
  const { showToast } = useToast();
  const { theme } = useTheme();
  const isLight = theme === 'light';

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
      if (res.status === 401) {
        window.location.href = '/login?error=Session+expired.+Please+sign+in+again.';
        return;
      }
      if (res.ok) {
        setDisplayNames(prev => ({ ...prev, [siteId]: trimmed || null }));
      } else {
        showToast('Could not save device name. Please try again.', 'error');
      }
    } catch {
      showToast('Network error. Device name not saved.', 'error');
    }
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

  const intelligenceDevices = useMemo(
    () => devices.map((device) => ({
      ...device,
      displayName: displayNames[device.siteId] ?? device.displayName,
    })),
    [devices, displayNames]
  );
  const intelligenceAssets = useMemo(
    () => intelligenceDevices.map((device) => assessAssetIntelligence({ device, data: dataMap[device.siteId] ?? null })),
    [intelligenceDevices, dataMap]
  );
  const fleetIntelligence = useMemo(() => assessFleetIntelligence(intelligenceAssets), [intelligenceAssets]);
  const fleetPollMs = fleetIntelligence.telemetryPlan.pollIntervalMs;
  const handleTicketCreated = useCallback(() => {
    window.location.reload();
  }, []);

  // VRM logs telemetry every 1-5 min. The intelligence plan can increase
  // cadence for watch states while backing off when VRM is stale.
  useEffect(() => {
    const JITTER_MAX_MS = 4_000;
    const fanOut = () => {
      const selected = new Set(selectedIds);
      const pollTargets = selected.size > 0
        ? devicesRef.current.filter((device) => selected.has(device.siteId))
        : devicesRef.current;

      pollTargets.forEach((d, i) => {
        const delay = Math.min(i * 180, JITTER_MAX_MS) + Math.random() * 250;
        setTimeout(() => pollDevice(d.siteId), delay);
      });
    };
    fanOut(); // immediate on mount, then follow the adaptive cadence
    const id = setInterval(fanOut, fleetPollMs);
    return () => clearInterval(id);
  }, [pollDevice, fleetPollMs, selectedIds]);

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
      const next = prev.includes(siteId) ? [] : [siteId];
      setMobileView(next.length > 0 ? 'detail' : 'fleet');
      return next;
    });
  };

  const openSite = (siteId: string) => {
    setSelectedIds([siteId]);
    setMobileView('detail');
    setTimeout(() => {
      document.querySelector(`[data-site-id="${siteId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const closeAll = () => { setSelectedIds([]); setMobileView('fleet'); };

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  const nowS = Date.now() / 1000;
  const briefing = buildBriefing(devices, dataMap, nowS);
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
            {isAdmin && (
              <Link href="/admin"
                className="text-[10px] font-bold font-mono border border-[#2563eb]/45 bg-[#1e40af]/22 text-[#bfdbfe] hover:text-white hover:border-[#3b82f6]/70 hover:bg-[#2563eb]/30 px-4 sm:px-5 py-2.5 rounded-lg transition-all uppercase tracking-widest">
                Admin
              </Link>
            )}
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
          <div className="space-y-6 pb-10">
            <ShiftBriefingPanel briefing={briefing} isLight={isLight} onOpenDevice={openSite} />
            <LeaseCommandCenter
              devices={intelligenceDevices}
              dataMap={dataMap}
              operations={leaseOperations}
              fleetIntelligence={fleetIntelligence}
              onTicketCreated={handleTicketCreated}
            />
            <NomadXECoreView device={devices[0]} initialData={dataMap[devices[0].siteId] ?? null} displayName={displayNames[devices[0].siteId] ?? null} onRename={handleRename} onData={handleDeviceData} />
          </div>
        )}

        {devices.length > 1 && !hasMany && (
          <div className="space-y-6 pb-10">
            <ShiftBriefingPanel briefing={briefing} isLight={isLight} onOpenDevice={openSite} />
            <LeaseCommandCenter
              devices={intelligenceDevices}
              dataMap={dataMap}
              operations={leaseOperations}
              fleetIntelligence={fleetIntelligence}
              onTicketCreated={handleTicketCreated}
            />
            <FleetIntelligenceBriefing devices={intelligenceDevices} dataMap={dataMap} onOpenDevice={openSite} />
            <FleetMapView devices={intelligenceDevices} dataMap={dataMap} selectedId={selectedIds[0] ?? null} onSelect={openSite} />
            {devices.map(d => (
              <div key={d.siteId} data-site-id={d.siteId}>
                <NomadXECoreView device={d} initialData={dataMap[d.siteId] ?? null} displayName={displayNames[d.siteId] ?? null} onRename={handleRename} onData={handleDeviceData} />
              </div>
            ))}
          </div>
        )}

        {hasMany && (
          <>
            <ShiftBriefingPanel briefing={briefing} isLight={isLight} onOpenDevice={openSite} />
            <LeaseCommandCenter
              devices={intelligenceDevices}
              dataMap={dataMap}
              operations={leaseOperations}
              fleetIntelligence={fleetIntelligence}
              onTicketCreated={handleTicketCreated}
            />
            <FleetIntelligenceBriefing devices={intelligenceDevices} dataMap={dataMap} onOpenDevice={openSite} />
            <FleetMapView devices={sortedDevices.map((device) => ({ ...device, displayName: displayNames[device.siteId] ?? device.displayName }))} dataMap={dataMap} selectedId={selectedIds[0] ?? null} onSelect={openSite} />
            <div className="lg:hidden pb-10">
              {mobileView === 'detail' && (
                <div className="flex items-center justify-between mb-4">
                  <button onClick={closeAll} className="flex items-center gap-2 text-[10px] font-bold text-[#93c5fd]/65 hover:text-white font-mono uppercase tracking-widest transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                    Fleet &middot; {devices.length} units
                  </button>
                  <span className="text-[10px] font-mono text-[#93c5fd]/50">{selectedIds.length} open &middot; 1 max</span>
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
                    <div className="grid grid-cols-1 gap-3 items-start content-start">
                      {sortedDevices.map((d, i) => (
                        <FleetTile key={d.siteId} index={i} device={d} data={dataMap[d.siteId] ?? null} selected={selectedIds.includes(d.siteId)} hoverEnabled={!hasSelection} onClick={() => toggleSite(d.siteId)} />
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
                      <div key={siteId} data-site-id={siteId} className="relative">
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
              <div className="flex-shrink-0 flex flex-col" style={{ width: hasSelection ? '390px' : '100%' }}>
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <span className="text-[10px] font-bold text-[#93c5fd]/65 uppercase tracking-widest font-mono">Fleet &middot; {devices.length} units</span>
                  {hasSelection && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-[#93c5fd]/65">{selectedIds.length} open &middot; 1 max</span>
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
                    className={`overflow-y-auto pr-1 ${hasSelection ? 'space-y-2.5' : 'grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3 items-start content-start'}`}
                    style={{ height: hasSelection ? 'calc(100vh - 20rem)' : 'auto', maxHeight: hasSelection ? undefined : 'none' }}
                  >
                    {sortedDevices.map((d, i) => (
                      <FleetTile key={d.siteId} index={i} device={d} data={dataMap[d.siteId] ?? null} selected={selectedIds.includes(d.siteId)} hoverEnabled={!hasSelection} onClick={() => toggleSite(d.siteId)} />
                    ))}
                  </div>
                )}
              </div>
              {hasSelection && (
                <div ref={detailPanelRef} className="flex-1 min-w-0 overflow-y-auto space-y-6 pr-1" style={{ height: 'calc(100vh - 20rem)' }}>
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
