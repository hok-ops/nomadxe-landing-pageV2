'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { VRMData } from './NomadXECoreView';
import { useTheme } from '@/components/ThemeProvider';

function getBatteryColor(soc: number, light: boolean) {
  if (soc >= 75) return light ? '#16a34a' : '#22c55e';
  if (soc >= 25) return light ? '#2563eb' : '#3b82f6';
  return light ? '#dc2626' : '#ef4444';
}

function getLedgerBatteryTone(soc: number) {
  if (soc >= 75) return { color: '#22c55e', label: 'Strong battery' };
  if (soc >= 45) return { color: '#2563eb', label: 'Stable battery' };
  if (soc >= 25) return { color: '#f59e0b', label: 'Watch battery' };
  return { color: '#ef4444', label: 'Critical battery' };
}

function formatWatts(value: number) {
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 1000) return `${(rounded / 1000).toFixed(1)} kW`;
  return `${rounded} W`;
}

function formatSyncAge(lastSeen: number) {
  if (lastSeen <= 0) return 'Awaiting first report';
  const staleS = Date.now() / 1000 - lastSeen;
  if (staleS < 60) return `${Math.floor(staleS)}s ago`;
  if (staleS < 3600) return `${Math.floor(staleS / 60)}m ago`;
  return `${Math.floor(staleS / 3600)}h ago`;
}

function LedgerSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return <div className="mt-2 h-7 rounded-md bg-[#15120c]/5" />;
  }

  const width = 160;
  const height = 32;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-7 w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const MPPT_LABEL_COLOR: Record<string, string> = {
  Float: '#22c55e',
  Storage: '#22c55e',
  Bulk: '#f59e0b',
  Absorption: '#f59e0b',
  Fault: '#ef4444',
  Off: '#9ca3af',
};

interface Props {
  device: {
    siteId: string;
    name: string;
    displayName?: string | null;
    teltonikaRmsDeviceId?: string | null;
  };
  data: VRMData | null;
  selected: boolean;
  onClick: () => void;
  index?: number;
}

function HoverDetail({
  data,
  device,
  isOffline,
  noData,
  isLight,
  fixedStyle,
}: {
  data: VRMData;
  device: Props['device'];
  isOffline: boolean;
  noData: boolean;
  isLight: boolean;
  fixedStyle: React.CSSProperties;
}) {
  const soc = data.battery.soc;
  const batColor = getBatteryColor(soc, isLight);
  const mpptLabel = data.solar.mpptStateLabel ?? 'Off';
  const mpptColor = MPPT_LABEL_COLOR[mpptLabel] ?? '#9ca3af';
  const charging = data.battery.state === 1;
  const discharging = data.battery.state === 2;

  const nowS = Date.now() / 1000;
  const staleS = nowS - (data.lastSeen ?? 0);
  const syncAgo = data.lastSeen > 0
    ? staleS < 60
      ? `${Math.floor(staleS)}s ago`
      : staleS < 3600
        ? `${Math.floor(staleS / 60)}m ago`
        : `${Math.floor(staleS / 3600)}h ago`
    : '-';

  const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="flex items-center justify-between gap-3">
      <span className="flex-shrink-0 text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/45">{label}</span>
      <span className="font-mono text-[11px] font-black tabular-nums" style={{ color: color ?? '#e2e8f0' }}>{value}</span>
    </div>
  );

  return (
    <div
      className="pointer-events-none rounded-xl border border-[#3b82f6]/25 bg-[#060a12] p-3.5 shadow-2xl"
      style={{
        ...fixedStyle,
        boxShadow: '0 0 0 1px rgba(59,130,246,0.1), 0 20px 40px rgba(0,0,0,0.8)',
        minWidth: '220px',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-[12px] font-bold text-white">{device.displayName ?? device.name}</span>
        <span
          className="flex-shrink-0 rounded-md px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider"
          style={{ color: mpptColor, background: mpptColor + '18', border: `1px solid ${mpptColor}30` }}
        >
          {mpptLabel}
        </span>
      </div>
      <div className="mb-3 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${noData ? 'bg-[#4b5563]' : isOffline ? 'bg-red-500' : 'bg-emerald-400'}`} />
        <span className={`font-mono text-[10px] font-semibold ${noData ? 'text-[#6b7280]' : isOffline ? 'text-red-400' : 'text-emerald-400'}`}>
          {noData ? 'No data' : isOffline ? `Offline - ${syncAgo}` : `Live - ${syncAgo}`}
        </span>
      </div>
      <div className="mb-2.5 space-y-1.5 border-t border-[#1e3a5f]/40 pt-2.5">
        <div className="mb-1 font-mono text-[9px] font-bold uppercase tracking-widest text-[#93c5fd]/30">Battery</div>
        <Row label="SOC" value={`${soc}%`} color={batColor} />
        <Row label="Voltage" value={`${data.battery.voltage.toFixed(2)} V`} color="#93c5fd" />
        <Row label="Current" value={`${data.battery.current >= 0 ? '+' : ''}${data.battery.current.toFixed(1)} A`} color={charging ? '#22c55e' : discharging ? '#f59e0b' : '#93c5fd'} />
        <Row label="Power" value={`${Math.abs(data.battery.power).toFixed(1)} W`} color={charging ? '#22c55e' : discharging ? '#f59e0b' : '#93c5fd'} />
      </div>
      <div className="mb-2.5 space-y-1.5 border-t border-[#1e3a5f]/40 pt-2.5">
        <div className="mb-1 font-mono text-[9px] font-bold uppercase tracking-widest text-[#93c5fd]/30">Solar</div>
        <Row label="Output" value={`${data.solar.power.toFixed(1)} W`} color="#22c55e" />
        <Row label="Panel V" value={`${data.solar.voltage.toFixed(1)} V`} color="#22c55e88" />
        <Row label="Today" value={`${data.solar.yieldToday.toFixed(2)} kWh`} color="#22c55e88" />
      </div>
      <div className="space-y-1.5 border-t border-[#1e3a5f]/40 pt-2.5">
        <div className="mb-1 font-mono text-[9px] font-bold uppercase tracking-widest text-[#93c5fd]/30">DC Load</div>
        <Row label="Load" value={`${data.dcLoad.toFixed(1)} W`} color="#f59e0b" />
        <Row label="Site ID" value={device.siteId} color="#93c5fd60" />
      </div>
    </div>
  );
}

export default function FleetTile({ device, data, selected, onClick, index = 0 }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [hovered, setHovered] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [entered, setEntered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (typeof window === 'undefined') { setEntered(true); return; }
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { setEntered(true); return; }
    const delay = Math.min(index * 35, 450);
    const t = setTimeout(() => setEntered(true), delay);
    return () => clearTimeout(t);
  }, [index]);

  const nowS = Date.now() / 1000;
  const lastSeenS = data?.lastSeen ?? 0;
  const isOffline = lastSeenS > 0 && (nowS - lastSeenS) > 15 * 60;
  const noData = lastSeenS === 0;
  const soc = data?.battery.soc ?? 0;
  const ledgerBattery = getLedgerBatteryTone(soc);
  const solarW = data?.solar.power ?? 0;
  const mpptLabel = data?.solar.mpptStateLabel ?? 'Off';
  const mpptColor = MPPT_LABEL_COLOR[mpptLabel] ?? '#4b5563';
  const charging = (data?.battery.state ?? 0) === 1;
  const discharging = (data?.battery.state ?? 0) === 2;
  const dcLoadW = data?.dcLoad ?? 0;
  const loadRatio = dcLoadW > 0 ? solarW / dcLoadW : 0;
  const location = data?.location ?? 'Location pending';
  const syncAge = formatSyncAge(lastSeenS);
  const priorityLabel = noData ? 'No Data' : isOffline ? 'Review' : soc < 45 ? 'Watch' : 'Clean';
  const priorityColor = noData ? '#64748b' : isOffline ? '#f43f5e' : soc < 45 ? '#f59e0b' : '#10b981';

  const handleMouseEnter = () => {
    if (tileRef.current) {
      const rect = tileRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const showAbove = spaceAbove > 280 || spaceAbove > spaceBelow;
      setPopupStyle(
        showAbove
          ? { position: 'fixed', left: rect.left, bottom: window.innerHeight - rect.top + 8, width: Math.max(rect.width, 220), zIndex: 9999 }
          : { position: 'fixed', left: rect.left, top: rect.bottom + 8, width: Math.max(rect.width, 220), zIndex: 9999 }
      );
    }
    setHovered(true);
  };

  const modemAccessUrl = device.teltonikaRmsDeviceId
    ? `/access/device/${encodeURIComponent(device.teltonikaRmsDeviceId)}`
    : null;

  return (
    <div
      ref={tileRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.35s cubic-bezier(.22,1,.36,1), transform 0.35s cubic-bezier(.22,1,.36,1)',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`w-full rounded-xl border bg-[#f7f1e6] p-3.5 text-left text-[#15120c] shadow-[0_16px_34px_rgba(0,0,0,0.22)] transition-all duration-200 focus:outline-none hover:-translate-y-px hover:shadow-[0_22px_44px_rgba(0,0,0,0.28)] ${
          selected
            ? 'border-[#15120c] ring-2 ring-[#3b82f6]/55'
            : 'border-[#d8cdb9] hover:border-[#15120c]/35'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#15120c]/10 pb-3">
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-[0.26em] text-[#7b6a52]">{device.siteId}</div>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <span className="truncate text-[17px] font-black text-[#15120c]">{device.displayName ?? device.name}</span>
              {selected && (
                <span className="rounded-md border border-[#15120c]/10 bg-white/50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-[#2563eb]">
                  Open
                </span>
              )}
            </div>
            <div className="mt-1 truncate text-[11px] font-bold text-[#7b6a52]">{location}</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#7b6a52]/75">{syncAge}</div>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
            <span className="rounded-lg border border-[#15120c]/10 bg-white/55 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: priorityColor }}>
              {priorityLabel}
            </span>
            <span className="rounded-md border border-[#15120c]/10 bg-[#15120c]/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em]" style={{ color: mpptColor }}>
              {mpptLabel}
            </span>
          </div>
        </div>

        <div className="grid gap-3 pt-3 sm:grid-cols-[0.78fr_1fr]">
          <div>
            <div className="text-4xl font-black leading-none tabular-nums" style={{ color: ledgerBattery.color }}>{soc}%</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#7b6a52]">{ledgerBattery.label}</div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#15120c]/10">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, soc))}%`, background: ledgerBattery.color }} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[#15120c]/5 px-2.5 py-2">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7b6a52]">Solar</div>
                <div className="mt-1 text-sm font-black tabular-nums">{formatWatts(solarW)}</div>
              </div>
              <div className="rounded-lg bg-[#15120c]/5 px-2.5 py-2">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7b6a52]">Load</div>
                <div className="mt-1 text-sm font-black tabular-nums">{formatWatts(dcLoadW)}</div>
              </div>
            </div>
            <div className="rounded-lg bg-[#15120c]/5 px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7b6a52]">Coverage</span>
                <span className="text-xs font-black tabular-nums">
                  {noData ? 'Pending' : loadRatio >= 1 ? `${loadRatio.toFixed(1)}x load` : (charging ? 'Charging' : discharging ? 'Battery draw' : 'Load draw')}
                </span>
              </div>
              <LedgerSparkline values={data?.sparkline ?? []} color="#b45309" />
            </div>
          </div>
        </div>
      </button>
      {modemAccessUrl && (
        <a
          href={modemAccessUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="mt-1.5 flex items-center justify-center rounded-lg border border-[#1e3a5f] bg-[#08111f] px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-[0.28em] text-[#22c55e]/80 transition-colors hover:border-[#22c55e]/40 hover:text-white"
        >
          Modem Login
        </a>
      )}
      {hovered && mounted && data && !noData && createPortal(
        <HoverDetail
          data={data}
          device={device}
          isOffline={isOffline}
          noData={noData}
          isLight={isLight}
          fixedStyle={popupStyle}
        />,
        document.body
      )}
    </div>
  );
}
