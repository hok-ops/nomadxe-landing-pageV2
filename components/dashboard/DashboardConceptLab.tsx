'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Battery,
  BatteryCharging,
  Clock3,
  Gauge,
  Home,
  KeyRound,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Zap,
} from 'lucide-react';
import FleetTile from '@/components/dashboard/FleetTile';
import type { VRMData } from '@/lib/vrm';

type PreviewDevice = {
  siteId: string;
  name: string;
  displayName: string | null;
  teltonikaRmsDeviceId: string | null;
  routerAccessUrl: string | null;
};

type ConceptKey = 'signal-deck' | 'territory-board' | 'shift-briefing';

const PREVIEW_DEVICES: PreviewDevice[] = [
  { siteId: 'NX-201', name: 'West Gate', displayName: 'West Gate', teltonikaRmsDeviceId: null, routerAccessUrl: null },
  { siteId: 'NX-118', name: 'Pump Yard', displayName: 'Pump Yard', teltonikaRmsDeviceId: null, routerAccessUrl: null },
  { siteId: 'NX-330', name: 'South Stack', displayName: 'South Stack', teltonikaRmsDeviceId: null, routerAccessUrl: null },
  { siteId: 'NX-404', name: 'Ridge Event', displayName: 'Ridge Event', teltonikaRmsDeviceId: null, routerAccessUrl: null },
  { siteId: 'NX-088', name: 'East Laydown', displayName: 'East Laydown', teltonikaRmsDeviceId: null, routerAccessUrl: null },
  { siteId: 'NX-512', name: 'Summit Perimeter', displayName: 'Summit Perimeter', teltonikaRmsDeviceId: null, routerAccessUrl: null },
];

function buildPreviewData(): Record<string, VRMData> {
  const now = Math.floor(Date.now() / 1000);
  return {
    'NX-201': {
      siteId: 'NX-201',
      lastSeen: now - 80,
      battery: { soc: 87, voltage: 13.42, current: 18.4, power: 248.6, state: 1 },
      solar: { power: 412.2, voltage: 42.8, yieldToday: 3.64, mpptState: 5, mpptStateLabel: 'Float' },
      dcLoad: 96.4,
      sparkline: [35, 84, 210, 320, 388, 412],
      batterySparkline: [72, 74, 77, 80, 84, 87],
      lat: 39.792,
      lon: -104.963,
      location: 'Denver, CO 80216',
    },
    'NX-118': {
      siteId: 'NX-118',
      lastSeen: now - 22 * 60,
      battery: { soc: 39, voltage: 12.18, current: -7.9, power: -101.3, state: 2 },
      solar: { power: 0, voltage: 9.8, yieldToday: 1.12, mpptState: 0, mpptStateLabel: 'Off' },
      dcLoad: 118.2,
      hasDcLoadReading: false,
      sparkline: [220, 190, 120, 68, 20, 0],
      batterySparkline: [54, 51, 48, 45, 42, 39],
      lat: 38.835,
      lon: -104.821,
      location: 'Colorado Springs, CO 80903',
    },
    'NX-330': {
      siteId: 'NX-330',
      lastSeen: now - 105,
      battery: { soc: 64, voltage: 12.91, current: 6.8, power: 82.6, state: 1 },
      solar: { power: 188.3, voltage: 38.2, yieldToday: 2.06, mpptState: 4, mpptStateLabel: 'Absorption' },
      dcLoad: 78.9,
      sparkline: [12, 42, 91, 128, 170, 188],
      batterySparkline: [59, 60, 61, 62, 63, 64],
      lat: 38.262,
      lon: -104.611,
      location: 'Pueblo, CO 81003',
    },
    'NX-404': {
      siteId: 'NX-404',
      lastSeen: now - 65,
      battery: { soc: 91, voltage: 13.58, current: 11.1, power: 144.8, state: 1 },
      solar: { power: 356.7, voltage: 44.1, yieldToday: 4.12, mpptState: 6, mpptStateLabel: 'Storage' },
      dcLoad: 88.4,
      sparkline: [66, 120, 172, 250, 314, 356],
      batterySparkline: [84, 85, 87, 88, 90, 91],
      lat: 40.585,
      lon: -105.084,
      location: 'Fort Collins, CO 80524',
    },
    'NX-088': {
      siteId: 'NX-088',
      lastSeen: 0,
      battery: { soc: 0, voltage: 0, current: 0, power: 0, state: 0 },
      solar: { power: 0, voltage: 0, yieldToday: 0, mpptState: 0, mpptStateLabel: 'Off' },
      dcLoad: 0,
      sparkline: [],
      batterySparkline: [],
      lat: null,
      lon: null,
      location: null,
    },
    'NX-512': {
      siteId: 'NX-512',
      lastSeen: now - 95,
      battery: { soc: 72, voltage: 13.16, current: 3.7, power: 44.2, state: 1 },
      solar: { power: 229.5, voltage: 40.7, yieldToday: 2.74, mpptState: 3, mpptStateLabel: 'Bulk' },
      dcLoad: 132.9,
      sparkline: [18, 62, 118, 149, 204, 230],
      batterySparkline: [67, 68, 69, 70, 71, 72],
      lat: 39.191,
      lon: -106.817,
      location: 'Aspen, CO 81611',
    },
  };
}

type TilePreviewProps = {
  device: PreviewDevice;
  data: VRMData;
  selected?: boolean;
  onClick?: () => void;
};

function getStatus(data: VRMData) {
  const now = Date.now() / 1000;
  const lastSeen = data.lastSeen ?? 0;
  if (lastSeen === 0) {
    return {
      label: 'No Data',
      detail: 'Awaiting first report',
      tone: 'text-slate-300',
      dot: '#64748b',
      border: 'border-slate-500/20',
      bg: 'bg-slate-500/10',
      priority: 'Standby',
    };
  }

  const staleSeconds = now - lastSeen;
  if (staleSeconds > 15 * 60) {
    return {
      label: 'Offline',
      detail: `${Math.floor(staleSeconds / 60)}m stale`,
      tone: 'text-rose-200',
      dot: '#fb7185',
      border: 'border-rose-400/25',
      bg: 'bg-rose-400/10',
      priority: 'Review',
    };
  }

  return {
    label: 'Live',
    detail: staleSeconds < 60 ? `${Math.floor(staleSeconds)}s ago` : `${Math.floor(staleSeconds / 60)}m ago`,
    tone: 'text-emerald-200',
    dot: '#34d399',
    border: 'border-emerald-400/25',
    bg: 'bg-emerald-400/10',
    priority: data.battery.soc < 80 ? 'Alert' : 'Ready',
  };
}

function getBatteryTone(soc: number) {
  if (soc >= 80) return { color: '#4ade80', label: 'Ready' };
  if (soc >= 60) return { color: '#fbbf24', label: 'Alert' };
  if (soc >= 30) return { color: '#fb923c', label: 'Low' };
  return { color: '#fb7185', label: 'Critical' };
}

function formatWatts(value: number) {
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 1000) return `${(rounded / 1000).toFixed(1)} kW`;
  return `${rounded} W`;
}

function splitLocation(location: string | null) {
  if (!location) return { city: 'Location pending', region: 'No GPS fix yet' };
  const [city, region] = location.split(',').map((part) => part.trim());
  return { city, region: region || 'GPS resolved' };
}

function getPreviewBatteryFlow(data: VRMData) {
  if (data.lastSeen === 0) return { symbol: '---', label: 'No Data', detail: 'Awaiting telemetry', color: '#64748b', active: false };
  if (data.battery.state === 1) return { symbol: 'CHG', label: 'Charging', detail: 'Solar charging battery', color: '#22c55e', active: true };
  if (data.battery.state === 2) return { symbol: 'BAT', label: 'Battery Draw', detail: 'Battery powering load', color: '#f59e0b', active: true };
  return { symbol: 'STBY', label: 'Standby', detail: 'Battery at rest', color: '#93c5fd', active: false };
}

function PreviewCloudCue() {
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-slate-400/30 bg-slate-200/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.15em] text-slate-700">
      <svg width="13" height="9" viewBox="0 0 26 18" fill="none" aria-hidden="true">
        <path d="M7.5 16h11.2a5.1 5.1 0 0 0 .5-10.2A7.1 7.1 0 0 0 5.6 7.5 4.4 4.4 0 0 0 7.5 16Z" fill="currentColor" opacity="0.72" />
      </svg>
      Cloudy
    </span>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500">
        <Icon className="h-3 w-3" style={{ color }} />
        <span>{label}</span>
      </div>
      <div className="truncate text-sm font-black tabular-nums text-white">{value}</div>
    </div>
  );
}

function TileStylePanel({
  number,
  title,
  bestFor,
  selected = false,
  children,
}: {
  number: string;
  title: string;
  bestFor: string;
  selected?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border bg-[#070b13] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)] ${selected ? 'border-amber-300/45 shadow-[0_0_0_1px_rgba(250,204,21,0.12),0_18px_60px_rgba(0,0,0,0.24)]' : 'border-white/10'}`}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className={selected ? 'text-[10px] font-black uppercase tracking-[0.28em] text-amber-200' : 'text-[10px] font-black uppercase tracking-[0.28em] text-slate-500'}>Style {number}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black text-white">{title}</h3>
            {selected && (
              <span className="rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-amber-100">
                Selected
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-right text-[10px] uppercase tracking-[0.2em] text-slate-400">
          {bestFor}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function StatusRailTile({ device, data, selected = false, onClick }: TilePreviewProps) {
  const status = getStatus(data);
  const battery = getBatteryTone(data.battery.soc);
  const location = splitLocation(data.location);
  const netPower = data.solar.power - data.dcLoad;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`group w-full overflow-hidden rounded-lg border bg-[#080d16] text-left transition-all hover:-translate-y-0.5 hover:border-sky-300/35 ${selected ? 'border-sky-300/50 shadow-[0_0_0_2px_rgba(56,189,248,0.16)]' : 'border-white/10'}`}
    >
      <div className="grid grid-cols-[5px_1fr]">
        <div style={{ background: status.dot, boxShadow: `0 0 20px ${status.dot}` }} />
        <div className="min-w-0 p-3.5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[15px] font-black text-white">{device.displayName ?? device.name}</span>
                {selected && <span className="rounded-md border border-sky-300/30 bg-sky-300/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-sky-100">Open</span>}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{location.city} / {location.region}</span>
              </div>
            </div>
            <div className={`rounded-lg border px-2.5 py-1 text-right ${status.bg} ${status.border} ${status.tone}`}>
              <div className="text-[10px] font-black uppercase tracking-[0.18em]">{status.label}</div>
              <div className="mt-0.5 text-[9px] font-bold normal-case tracking-[0.08em] opacity-70">{status.detail}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MetricPill icon={Battery} label="SOC" value={`${data.battery.soc}%`} color={battery.color} />
            <MetricPill icon={Sun} label="Solar" value={formatWatts(data.solar.power)} color="#fbbf24" />
            <MetricPill icon={Zap} label="Net" value={formatWatts(netPower)} color={netPower >= 0 ? '#4ade80' : '#fb7185'} />
          </div>
        </div>
      </div>
    </button>
  );
}

function PowerLedgerTile({ device, data, selected = false, onClick }: TilePreviewProps) {
  const status = getStatus(data);
  const battery = getBatteryTone(data.battery.soc);
  const location = splitLocation(data.location);
  const flow = getPreviewBatteryFlow(data);
  const noDirectLoadReading = data.hasDcLoadReading === false;
  const cloudyPreview = device.siteId === 'NX-118' || device.siteId === 'NX-512';
  const flowWidth = data.lastSeen === 0 ? 100 : Math.max(18, Math.min(100, Math.abs(data.battery.current) * 5 + 18));

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-lg border bg-[#f7f1e6] p-3.5 text-left text-[#15120c] shadow-[0_18px_35px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 ${
        selected
          ? 'border-[#2563eb] ring-4 ring-[#2563eb]/35 shadow-[0_0_0_1px_rgba(37,99,235,0.75),0_24px_54px_rgba(37,99,235,0.24)]'
          : 'border-[#d8cdb9]'
      }`}
    >
      {selected && (
        <span className="pointer-events-none absolute inset-x-3 top-0 h-1 rounded-b-full bg-[#2563eb] shadow-[0_0_18px_rgba(37,99,235,0.85)]" />
      )}
      <div className="flex items-start justify-between gap-3 border-b border-[#15120c]/10 pb-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.26em] text-[#7b6a52]">{device.siteId}</div>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <span className="truncate text-lg font-black">{device.displayName ?? device.name}</span>
            {selected && (
              <span className="rounded-md border border-[#2563eb]/25 bg-[#2563eb] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white">
                Reviewing
              </span>
            )}
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate text-[11px] font-bold text-[#7b6a52]">{location.city}, {location.region}</span>
            {cloudyPreview && <PreviewCloudCue />}
          </div>
          <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#7b6a52]/70">{status.detail}</div>
        </div>
        <div className="rounded-lg border border-[#15120c]/10 bg-white/55 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: status.dot }}>
          {status.priority}
        </div>
      </div>

      <div className="grid grid-cols-[0.78fr_1fr] gap-3 pt-3">
        <div>
          <div className="text-4xl font-black leading-none tabular-nums" style={{ color: battery.color }}>{data.battery.soc}%</div>
          <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#7b6a52]">{battery.label} battery</div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#15120c]/10">
            <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, data.battery.soc))}%`, background: battery.color }} />
          </div>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-[#15120c]/5 px-2.5 py-2">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7b6a52]">Solar</div>
              <div className="mt-1 text-sm font-black tabular-nums">{formatWatts(data.solar.power)}</div>
            </div>
            <div className={`rounded-lg px-2.5 py-2 ${
              noDirectLoadReading ? 'border border-[#f59e0b]/35 bg-[#f59e0b]/10' : 'bg-[#15120c]/5'
            }`}>
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7b6a52]">Load</div>
              <div className="mt-1 text-sm font-black tabular-nums">{noDirectLoadReading ? 'No read' : formatWatts(data.dcLoad)}</div>
              {noDirectLoadReading && (
                <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-[#b45309]">
                  Est. {formatWatts(data.dcLoad)}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-lg bg-[#15120c]/5 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7b6a52]">Voltage</span>
              <span className="text-xs font-black tabular-nums">{data.lastSeen === 0 ? 'Pending' : `${data.battery.voltage.toFixed(2)} V`}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7b6a52]">Battery Status</span>
              <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: flow.color }}>
                <span className={`h-1.5 w-1.5 rounded-full ${flow.active ? 'animate-pulse' : ''}`} style={{ background: flow.color, boxShadow: flow.active ? `0 0 12px ${flow.color}` : 'none' }} />
                {flow.symbol}
              </span>
            </div>
            <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-[#15120c]/10">
              <div className={`h-full rounded-full transition-all duration-700 ${flow.active ? 'animate-pulse' : ''}`} style={{ width: `${flowWidth}%`, background: flow.color, opacity: flow.active ? 0.86 : 0.48 }} />
            </div>
            <div className="mt-1 text-[9px] font-bold text-[#7b6a52]/70">{flow.detail}</div>
          </div>
        </div>
      </div>
    </button>
  );
}

function FieldOpsTile({ device, data, selected = false }: TilePreviewProps) {
  const status = getStatus(data);
  const battery = getBatteryTone(data.battery.soc);
  const location = splitLocation(data.location);

  return (
    <button className={`relative w-full overflow-hidden rounded-lg border bg-[#101614] p-4 text-left transition-all hover:-translate-y-0.5 ${selected ? 'border-emerald-300/50 shadow-[0_0_0_2px_rgba(52,211,153,0.16)]' : 'border-white/10'}`}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${status.dot}, transparent)` }} />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{device.siteId}</span>
            <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${status.bg} ${status.border} ${status.tone}`}>{status.detail}</span>
          </div>
          <div className="truncate text-xl font-black text-white">{location.city}</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-400">{device.displayName ?? device.name} / {location.region}</div>
        </div>
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20">
          {status.label === 'Offline' ? <AlertTriangle className="h-5 w-5 text-rose-300" /> : <ShieldCheck className="h-5 w-5 text-emerald-300" />}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">Battery</div>
              <div className="mt-1 text-3xl font-black tabular-nums text-white">{data.battery.soc}%</div>
            </div>
            <BatteryCharging className="mb-1 h-5 w-5" style={{ color: battery.color }} />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, data.battery.soc))}%`, background: battery.color }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MetricPill icon={Sun} label="PV" value={formatWatts(data.solar.power)} color="#fde047" />
          <MetricPill icon={Gauge} label="Load" value={formatWatts(data.dcLoad)} color="#fb923c" />
          <MetricPill icon={Clock3} label="Sync" value={status.detail} color={status.dot} />
        </div>
      </div>
    </button>
  );
}

function CommandChipTile({ device, data, selected = false }: TilePreviewProps) {
  const status = getStatus(data);
  const battery = getBatteryTone(data.battery.soc);
  const location = splitLocation(data.location);
  const health = data.lastSeen === 0 ? 0 : Math.round((data.battery.soc * 0.7) + (data.solar.power > data.dcLoad ? 18 : 6) + (status.label === 'Live' ? 12 : 0));

  return (
    <button className={`w-full rounded-lg border bg-[#050608] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-200/35 ${selected ? 'border-cyan-200/55 shadow-[0_0_0_2px_rgba(103,232,249,0.15)]' : 'border-white/10'}`}>
      <div className="flex items-center gap-3">
        <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
          <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90" aria-hidden="true">
            <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
            <circle
              cx="24"
              cy="24"
              r="19"
              fill="none"
              stroke={battery.color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${Math.max(0, Math.min(100, health)) * 1.19} 119`}
            />
          </svg>
          <span className="absolute text-sm font-black tabular-nums text-white">{health}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[15px] font-black text-white">{device.displayName ?? device.name}</span>
            <span className="rounded-md border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: status.dot }}>
              {status.label}
            </span>
          </div>
          <div className="mt-1 truncate text-[11px] font-semibold text-slate-400">{location.city} / {device.siteId}</div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            <div className="rounded-md bg-white/[0.04] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.16em] text-slate-500">SOC</div>
              <div className="text-xs font-black tabular-nums text-white">{data.battery.soc}%</div>
            </div>
            <div className="rounded-md bg-white/[0.04] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.16em] text-slate-500">PV</div>
              <div className="text-xs font-black tabular-nums text-white">{formatWatts(data.solar.power)}</div>
            </div>
            <div className="rounded-md bg-white/[0.04] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.16em] text-slate-500">Load</div>
              <div className="text-xs font-black tabular-nums text-white">{formatWatts(data.dcLoad)}</div>
            </div>
            <div className="rounded-md bg-white/[0.04] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.16em] text-slate-500">Sync</div>
              <div className="text-xs font-black tabular-nums text-white">{status.detail}</div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function DashboardControlPreview() {
  return (
    <div className="rounded-xl border border-white/10 bg-[#080d16] p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300 hover:border-sky-300/40 hover:text-white">
            <Home className="h-3.5 w-3.5" />
            Home
          </Link>
          <button className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
            <Activity className="h-3.5 w-3.5" />
            Theme
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
            <KeyRound className="h-3.5 w-3.5" />
            Key
          </button>
          <Link href="/admin" className="inline-flex items-center gap-2 rounded-lg border border-blue-300/25 bg-blue-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-blue-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin
          </Link>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 xl:max-w-sm">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
          <span className="truncate text-[11px] font-semibold text-slate-500">Search by name, site ID, city, state, zip, status...</span>
        </div>
      </div>
    </div>
  );
}

function TileDesignLab({
  devices,
  dataMap,
}: {
  devices: PreviewDevice[];
  dataMap: Record<string, VRMData>;
}) {
  const live = devices[0];
  const watch = devices[1];
  const dark = devices[4];

  return (
    <section id="tile-styles" className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-sm lg:p-7">
      <div className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.45em] text-[#facc15]">Tile Design Lab</div>
          <h2 className="text-3xl font-black tracking-tight text-white" style={{ fontFamily: 'var(--font-playfair)' }}>Four sleek tile alternatives for Concept 03.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Style 02 is now the selected tile direction. It favors crisp numeric readability while still showing live state, city/state/zip, battery, solar, load, and sync age.
          </p>
        </div>
        <a href="#shift-briefing" className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-100 hover:bg-emerald-400/15">
          Concept 03 Direction
        </a>
      </div>

      <DashboardControlPreview />

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <TileStylePanel number="01" title="Status Rail" bestFor="Fast scan">
          <StatusRailTile device={live} data={dataMap[live.siteId]} selected />
          <StatusRailTile device={watch} data={dataMap[watch.siteId]} />
        </TileStylePanel>

        <TileStylePanel number="02" title="Power Ledger" bestFor="Readability" selected>
          <PowerLedgerTile device={live} data={dataMap[live.siteId]} selected />
          <PowerLedgerTile device={watch} data={dataMap[watch.siteId]} />
        </TileStylePanel>

        <TileStylePanel number="03" title="Field Ops Card" bestFor="Location">
          <FieldOpsTile device={live} data={dataMap[live.siteId]} selected />
          <FieldOpsTile device={dark} data={dataMap[dark.siteId]} />
        </TileStylePanel>

        <TileStylePanel number="04" title="Command Chip" bestFor="Dense fleets">
          <CommandChipTile device={live} data={dataMap[live.siteId]} selected />
          <CommandChipTile device={watch} data={dataMap[watch.siteId]} />
        </TileStylePanel>
      </div>
    </section>
  );
}

function ConceptCard({
  id,
  eyebrow,
  title,
  summary,
  memoryHook,
  children,
}: {
  id: ConceptKey;
  eyebrow: string;
  title: string;
  summary: string;
  memoryHook: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-sm lg:p-7">
      <div className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.45em] text-[#7dd3fc]">{eyebrow}</div>
          <h2 className="text-3xl font-black tracking-tight text-white" style={{ fontFamily: 'var(--font-playfair)' }}>{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{summary}</p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-[11px] uppercase tracking-[0.28em] text-slate-300">
          Memory Hook
          <div className="mt-1 text-[13px] font-bold tracking-[0.1em] text-white">{memoryHook}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

function StatBadge({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-3">
      <div className="text-[9px] uppercase tracking-[0.35em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">
        {value}
        <span className="ml-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: accent, boxShadow: `0 0 18px ${accent}` }} />
      </div>
    </div>
  );
}

function TileDeck({
  devices,
  dataMap,
  selectedId,
  onSelect,
  columns = 'md:grid-cols-2 xl:grid-cols-3',
}: {
  devices: PreviewDevice[];
  dataMap: Record<string, VRMData>;
  selectedId: string;
  onSelect: (siteId: string) => void;
  columns?: string;
}) {
  return (
    <div className={`grid gap-3 ${columns}`}>
      {devices.map((device, index) => (
        <FleetTile
          key={device.siteId}
          index={index}
          device={device}
          data={dataMap[device.siteId]}
          selected={selectedId === device.siteId}
          onClick={() => onSelect(device.siteId)}
        />
      ))}
    </div>
  );
}

function SignalDeckPreview({
  devices,
  dataMap,
  selectedId,
  onSelect,
}: {
  devices: PreviewDevice[];
  dataMap: Record<string, VRMData>;
  selectedId: string;
  onSelect: (siteId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="relative overflow-hidden rounded-[32px] border border-[#67e8f9]/20 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.28),_transparent_42%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(3,7,18,0.94))] p-6">
          <div className="absolute inset-0 bg-[linear-gradient(125deg,transparent_0%,rgba(255,255,255,0.05)_48%,transparent_100%)]" />
          <div className="relative">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.42em] text-[#67e8f9]">Fleet Pulse</div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-300">
                4 Live / 1 Review / 1 Offline
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <h3 className="max-w-xl text-4xl font-black leading-[0.95] text-white" style={{ fontFamily: 'var(--font-playfair)' }}>
                  Open with the fleet story, not the grid.
                </h3>
                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
                  This concept turns the first screen into a live pulse deck: what is healthy, what needs attention, and which units are moving from watch to action.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <StatBadge label="Avg SOC" value="71%" accent="#22c55e" />
                  <StatBadge label="Harvest" value="1.19 kW" accent="#38bdf8" />
                  <StatBadge label="Load" value="86 W" accent="#f59e0b" />
                </div>
              </div>
              <div className="grid gap-3">
                <div className="rounded-[24px] border border-red-400/20 bg-red-400/10 p-4">
                  <div className="text-[10px] uppercase tracking-[0.35em] text-red-200">Needs Review</div>
                  <div className="mt-2 text-xl font-black text-white">Pump Yard drifted offline 22m ago</div>
                  <div className="mt-2 text-xs text-red-100/70">Make the first issue impossible to miss without burying the rest of the fleet.</div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] uppercase tracking-[0.35em] text-sky-200">Weather Window</div>
                  <div className="mt-2 text-xl font-black text-white">Clear afternoon harvest across 4 Colorado sites</div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] uppercase tracking-[0.35em] text-emerald-200">Charging Momentum</div>
                  <div className="mt-2 text-xl font-black text-white">3 units recovering faster than yesterday</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[28px] border border-white/10 bg-[#090d16] p-5">
            <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">What Changes</div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <p>The top of the page becomes a high-signal briefing strip instead of a modest header plus summary bar.</p>
              <p>Operators feel the fleet condition before they start scanning tiles, which helps larger customer fleets orient faster.</p>
            </div>
          </div>
          <div className="rounded-[28px] border border-[#22c55e]/20 bg-[#08120f] p-5">
            <div className="text-[10px] uppercase tracking-[0.35em] text-emerald-300">Keep As-Is</div>
            <div className="mt-3 text-sm leading-6 text-emerald-100/80">
              Tile hover popovers and open-state styling remain untouched. Hover the tiles below to see that behavior preserved.
            </div>
          </div>
        </div>
      </div>

      <TileDeck devices={devices} dataMap={dataMap} selectedId={selectedId} onSelect={onSelect} />
    </div>
  );
}

function TerritoryBoardPreview({
  devices,
  dataMap,
  selectedId,
  onSelect,
}: {
  devices: PreviewDevice[];
  dataMap: Record<string, VRMData>;
  selectedId: string;
  onSelect: (siteId: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
      <div className="relative overflow-hidden rounded-[34px] border border-[#fbbf24]/20 bg-[radial-gradient(circle_at_18%_16%,_rgba(251,191,36,0.18),_transparent_25%),radial-gradient(circle_at_80%_26%,_rgba(56,189,248,0.18),_transparent_30%),linear-gradient(180deg,_rgba(12,16,24,0.98),_rgba(4,8,15,0.98))] p-6">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:36px_36px] opacity-35" />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.4em] text-amber-200">Territory Board</div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-300">
              Location-first
            </div>
          </div>
          <h3 className="max-w-sm text-3xl font-black leading-tight text-white">
            Group customers by territory, not just by device list.
          </h3>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
            This direction helps customers who think in jobsites and routes. It gives location visual weight without turning the dashboard into a generic map app.
          </p>

          <div className="relative mt-8 h-[340px] rounded-[28px] border border-white/10 bg-black/20 p-4">
            <div className="absolute left-[18%] top-[18%] h-4 w-4 rounded-full bg-[#67e8f9] shadow-[0_0_18px_rgba(103,232,249,0.8)]" />
            <div className="absolute left-[46%] top-[34%] h-4 w-4 rounded-full bg-[#fbbf24] shadow-[0_0_18px_rgba(251,191,36,0.8)]" />
            <div className="absolute left-[66%] top-[22%] h-4 w-4 rounded-full bg-[#22c55e] shadow-[0_0_18px_rgba(34,197,94,0.8)]" />
            <div className="absolute left-[30%] top-[66%] h-4 w-4 rounded-full bg-[#fb7185] shadow-[0_0_18px_rgba(251,113,133,0.8)]" />
            <div className="absolute left-[62%] top-[72%] h-4 w-4 rounded-full bg-[#c084fc] shadow-[0_0_18px_rgba(192,132,252,0.8)]" />
            <div className="absolute left-[19%] top-[21%] h-[2px] w-[30%] origin-left rotate-[18deg] bg-gradient-to-r from-[#67e8f9] to-transparent opacity-80" />
            <div className="absolute left-[48%] top-[37%] h-[2px] w-[18%] origin-left -rotate-[22deg] bg-gradient-to-r from-[#fbbf24] to-transparent opacity-80" />
            <div className="absolute left-[33%] top-[68%] h-[2px] w-[28%] origin-left rotate-[4deg] bg-gradient-to-r from-[#fb7185] to-transparent opacity-80" />

            <div className="absolute left-[6%] top-[10%] rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3">
              <div className="text-[9px] uppercase tracking-[0.35em] text-slate-400">Metro</div>
              <div className="mt-1 text-sm font-black text-white">2 live • 1 watch</div>
            </div>
            <div className="absolute right-[6%] top-[18%] rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3">
              <div className="text-[9px] uppercase tracking-[0.35em] text-slate-400">North</div>
              <div className="mt-1 text-sm font-black text-white">Strong harvest</div>
            </div>
            <div className="absolute left-[12%] bottom-[9%] rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3">
              <div className="text-[9px] uppercase tracking-[0.35em] text-slate-400">West Slope</div>
              <div className="mt-1 text-sm font-black text-white">1 offline site</div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <StatBadge label="Metro Fleet" value="3 Sites" accent="#67e8f9" />
          <StatBadge label="Longest Idle" value="22m" accent="#f87171" />
          <StatBadge label="Travel Radius" value="147 mi" accent="#fbbf24" />
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#090d16] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Territory Review Queue</div>
              <div className="mt-2 text-2xl font-black text-white">Cluster by location, then scan the unchanged tiles.</div>
            </div>
            <div className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-sky-200">
              Better for regional operators
            </div>
          </div>
          <TileDeck
            devices={devices}
            dataMap={dataMap}
            selectedId={selectedId}
            onSelect={onSelect}
            columns="md:grid-cols-2"
          />
        </div>
      </div>
    </div>
  );
}

function ShiftBriefingPreview({
  devices,
  dataMap,
  selectedId,
  onSelect,
}: {
  devices: PreviewDevice[];
  dataMap: Record<string, VRMData>;
  selectedId: string;
  onSelect: (siteId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-[34px] border border-[#f9a8d4]/20 bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.14),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(9,9,11,0.98))] p-6">
          <div className="text-[10px] uppercase tracking-[0.42em] text-pink-200">Shift Briefing</div>
          <h3 className="mt-3 text-4xl font-black leading-[0.95] text-white" style={{ fontFamily: 'var(--font-playfair)' }}>
            Feels like the morning handoff deck for a field ops team.
          </h3>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Instead of starting in a neutral grid, the landing page opens with a briefing: where you should look first, what changed since the last check-in, and which trailers are safely above the 80% battery threshold.
          </p>

          <div className="mt-6 space-y-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[9px] uppercase tracking-[0.35em] text-slate-400">Opening Line</div>
              <div className="mt-2 text-lg font-black text-white">Battery alerts and offline units move to the top of the handoff.</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[9px] uppercase tracking-[0.35em] text-slate-400">Operator Note</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">Style 02 Power Ledger tiles are selected for this concept so operators can compare battery, solar, load, voltage, and review status without hiding low-reserve trailers.</div>
            </div>
          </div>
        </div>

        <div className="rounded-[34px] border border-white/10 bg-[#090d16] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Briefing Lanes</div>
              <div className="mt-2 text-2xl font-black text-white">Battery alerts, charging now, offline now.</div>
            </div>
            <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-amber-100">
              Style 02 selected
            </div>
          </div>

          <div className="space-y-4">
            <Lane label="Watch Now" tone="border-red-400/20 bg-red-400/10 text-red-100" devices={devices.slice(1, 3)} dataMap={dataMap} selectedId={selectedId} onSelect={onSelect} />
            <Lane label="Charging Strong" tone="border-emerald-400/20 bg-emerald-400/10 text-emerald-100" devices={[devices[0], devices[3], devices[5]]} dataMap={dataMap} selectedId={selectedId} onSelect={onSelect} />
            <Lane label="Offline / No Data" tone="border-slate-300/20 bg-white/5 text-slate-100" devices={[devices[4]]} dataMap={dataMap} selectedId={selectedId} onSelect={onSelect} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Lane({
  label,
  tone,
  devices,
  dataMap,
  selectedId,
  onSelect,
}: {
  label: string;
  tone: string;
  devices: PreviewDevice[];
  dataMap: Record<string, VRMData>;
  selectedId: string;
  onSelect: (siteId: string) => void;
}) {
  return (
    <div className={`rounded-[24px] border p-3 ${tone}`}>
      <div className="mb-3 text-[10px] uppercase tracking-[0.35em]">{label}</div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {devices.map((device) => (
          <div key={device.siteId} className="min-w-[390px] flex-1">
            <PowerLedgerTile
              device={device}
              data={dataMap[device.siteId]}
              selected={selectedId === device.siteId}
              onClick={() => onSelect(device.siteId)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardConceptLab() {
  const previewData = buildPreviewData();
  const [selected, setSelected] = useState<Record<ConceptKey, string>>({
    'signal-deck': 'NX-201',
    'territory-board': 'NX-330',
    'shift-briefing': 'NX-118',
  });

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at top, rgba(56,189,248,0.18), transparent 28%), linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: 'auto, 52px 52px, 52px 52px' }} />

      <div className="relative z-10 mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-10">
        <div className="rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(180deg,_rgba(10,14,25,0.96),_rgba(5,8,18,0.98))] p-6 shadow-[0_35px_120px_rgba(0,0,0,0.35)] lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.5em] text-[#7dd3fc]">Concept Lab</div>
              <h1 className="max-w-4xl text-4xl font-black leading-[0.94] text-white md:text-5xl" style={{ fontFamily: 'var(--font-playfair)' }}>
                Three new landing-page directions for the NomadXE customer dashboard.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-[15px]">
                These concepts only rethink the landing shell. The tile behavior you already like stays intact: same hover telemetry popover, same selected tile state, same overall detail pattern. The goal is a stronger first impression and faster orientation for customers managing multiple trailers.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/dashboard" className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold tracking-[0.18em] text-slate-200 transition-colors hover:border-[#7dd3fc]/40 hover:text-white">
                Back To Live Dashboard
              </Link>
              <a href="#tile-styles" className="rounded-[20px] border border-[#22c55e]/20 bg-[#22c55e]/10 px-4 py-3 text-sm font-bold tracking-[0.18em] text-emerald-100 transition-colors hover:bg-[#22c55e]/15">
                Jump To Tile Styles
              </a>
            </div>
          </div>

          <div className="mt-8 grid gap-3 lg:grid-cols-4">
            <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Concept 01</div>
              <div className="mt-2 text-xl font-black text-white">Signal Deck</div>
              <div className="mt-2 text-sm text-slate-300">A fleet pulse banner that opens with story, not paperwork.</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Concept 02</div>
              <div className="mt-2 text-xl font-black text-white">Territory Board</div>
              <div className="mt-2 text-sm text-slate-300">A location-weighted shell for customers who think in jobsites and regions.</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Concept 03</div>
              <div className="mt-2 text-xl font-black text-white">Shift Briefing</div>
              <div className="mt-2 text-sm text-slate-300">An ops handoff layout that turns the dashboard into a daily briefing surface.</div>
            </div>
            <a href="#tile-styles" className="rounded-[24px] border border-amber-300/20 bg-amber-300/10 px-4 py-4 transition-colors hover:bg-amber-300/15">
              <div className="text-[10px] uppercase tracking-[0.35em] text-amber-200">Next Pass</div>
              <div className="mt-2 text-xl font-black text-white">Tile Styles</div>
              <div className="mt-2 text-sm text-amber-50/75">Four clearer tile shells for the selected Shift Briefing direction.</div>
            </a>
          </div>
        </div>

        <div className="mt-8 space-y-8">
          <TileDesignLab devices={PREVIEW_DEVICES} dataMap={previewData} />

          <ConceptCard
            id="signal-deck"
            eyebrow="Concept 01"
            title="Signal Deck"
            summary="Best when you want the dashboard to feel premium and clear immediately. Customers land on a strong pulse banner, see the priority issue fast, and then move into the same tile interactions they already understand."
            memoryHook="Pulse strip + alert stack"
          >
            <SignalDeckPreview
              devices={PREVIEW_DEVICES}
              dataMap={previewData}
              selectedId={selected['signal-deck']}
              onSelect={(siteId) => setSelected((prev) => ({ ...prev, 'signal-deck': siteId }))}
            />
          </ConceptCard>

          <ConceptCard
            id="territory-board"
            eyebrow="Concept 02"
            title="Territory Board"
            summary="Best when geography matters as much as telemetry. This layout treats the landing page like an operations territory wall: location clusters first, then the unchanged trailer tiles underneath."
            memoryHook="Cartographic field wall"
          >
            <TerritoryBoardPreview
              devices={PREVIEW_DEVICES.slice(0, 4)}
              dataMap={previewData}
              selectedId={selected['territory-board']}
              onSelect={(siteId) => setSelected((prev) => ({ ...prev, 'territory-board': siteId }))}
            />
          </ConceptCard>

          <ConceptCard
            id="shift-briefing"
            eyebrow="Concept 03"
            title="Shift Briefing"
            summary="Best when customers have multiple people checking the fleet throughout the day. This direction turns the landing page into a briefing handoff with clear queues instead of one uniform grid."
            memoryHook="Morning handoff deck"
          >
            <ShiftBriefingPreview
              devices={PREVIEW_DEVICES}
              dataMap={previewData}
              selectedId={selected['shift-briefing']}
              onSelect={(siteId) => setSelected((prev) => ({ ...prev, 'shift-briefing': siteId }))}
            />
          </ConceptCard>
        </div>
      </div>
    </div>
  );
}
