'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { VRMData } from './NomadXECoreView';
import { useTheme } from '@/components/ThemeProvider';
import { formatWatts, getDcLoadSignalDetail, getDcLoadSignalTitle, hasMissingDcLoadSignal } from '@/lib/telemetryHealth';

function getBatteryColor(soc: number, light: boolean) {
  if (soc >= 80) return light ? '#16a34a' : '#22c55e';
  if (soc >= 60) return light ? '#d97706' : '#f59e0b';
  if (soc >= 30) return light ? '#ea580c' : '#fb923c';
  return light ? '#dc2626' : '#ef4444';
}

function getLedgerBatteryTone(soc: number) {
  if (soc >= 80) return { color: '#22c55e', label: 'Healthy battery' };
  if (soc >= 60) return { color: '#f59e0b', label: 'Battery alert' };
  if (soc >= 30) return { color: '#fb923c', label: 'Low battery' };
  return { color: '#ef4444', label: 'Critical battery' };
}

function formatSyncAge(lastSeen: number) {
  if (lastSeen <= 0) return 'Awaiting first report';
  const staleS = Date.now() / 1000 - lastSeen;
  if (staleS < 60) return `${Math.floor(staleS)}s ago`;
  if (staleS < 3600) return `${Math.floor(staleS / 60)}m ago`;
  return `${Math.floor(staleS / 3600)}h ago`;
}

type TileWeather = {
  code: number;
  label: string;
};

const TILE_WEATHER_TTL_MS = 30 * 60_000;
const tileWeatherCache = new Map<string, { data: TileWeather | null; fetchedAt: number }>();
const tileWeatherInflight = new Map<string, Promise<TileWeather | null>>();

function isCloudyWeatherCode(code: number) {
  return code === 2 || code === 3 || (code >= 45 && code <= 99);
}

function weatherLabelForCode(code: number) {
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if (code >= 45 && code <= 48) return 'Fog/clouds';
  if (code >= 51 && code <= 67) return 'Wet/cloudy';
  if (code >= 71 && code <= 86) return 'Snow/clouds';
  if (code >= 95) return 'Storm/clouds';
  return 'Cloud watch';
}

async function fetchTileWeather(lat: number, lon: number): Promise<TileWeather | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = tileWeatherCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < TILE_WEATHER_TTL_MS) return cached.data;

  const inflight = tileWeatherInflight.get(key);
  if (inflight) return inflight;

  const request = fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code&daily=weather_code&timezone=auto&forecast_days=1`
  )
    .then(async (response) => {
      if (!response.ok) return null;
      const json = await response.json();
      const dailyCode = Array.isArray(json?.daily?.weather_code) ? Number(json.daily.weather_code[0]) : NaN;
      const currentCode = Number(json?.current?.weather_code);
      const code = Number.isFinite(dailyCode) ? dailyCode : currentCode;
      return Number.isFinite(code) ? { code, label: weatherLabelForCode(code) } : null;
    })
    .catch(() => null)
    .then((data) => {
      tileWeatherCache.set(key, { data, fetchedAt: Date.now() });
      tileWeatherInflight.delete(key);
      return data;
    });

  tileWeatherInflight.set(key, request);
  return request;
}

function getBatteryFlowState(charging: boolean, discharging: boolean, noData: boolean) {
  if (noData) {
    return { symbol: '---', label: 'No Data', detail: 'Awaiting telemetry', color: '#64748b', active: false };
  }
  if (charging) {
    return { symbol: 'CHG', label: 'Charging', detail: 'Solar charging battery', color: '#22c55e', active: true };
  }
  if (discharging) {
    return { symbol: 'BAT', label: 'Battery Draw', detail: 'Battery powering load', color: '#f59e0b', active: true };
  }
  return { symbol: 'STBY', label: 'Standby', detail: 'Battery at rest', color: '#93c5fd', active: false };
}

function CloudWeatherCue({ label }: { label: string }) {
  return (
    <span
      className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-slate-400/30 bg-slate-200/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.15em] text-slate-700"
      title="Cloudy weather can reduce solar harvest today."
    >
      <svg width="13" height="9" viewBox="0 0 26 18" fill="none" aria-hidden="true">
        <path d="M7.5 16h11.2a5.1 5.1 0 0 0 .5-10.2A7.1 7.1 0 0 0 5.6 7.5 4.4 4.4 0 0 0 7.5 16Z" fill="currentColor" opacity="0.72" />
      </svg>
      {label}
    </span>
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
  hoverEnabled?: boolean;
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
  const loadSignalMissing = hasMissingDcLoadSignal(data);

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
        <Row
          label="Load"
          value={loadSignalMissing ? getDcLoadSignalTitle(data) : `${data.dcLoad.toFixed(1)} W`}
          color={loadSignalMissing ? '#fb923c' : '#f59e0b'}
        />
        {loadSignalMissing && (
          <div className="pt-1 text-[10px] leading-4 text-amber-200/80">
            {getDcLoadSignalDetail(data)}
          </div>
        )}
        <Row label="Site ID" value={device.siteId} color="#93c5fd60" />
      </div>
    </div>
  );
}

export default function FleetTile({ device, data, selected, hoverEnabled = true, onClick, index = 0 }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const effectiveHoverEnabled = hoverEnabled && !selected;
  const [hovered, setHovered] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [entered, setEntered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tileWeather, setTileWeather] = useState<TileWeather | null>(null);
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
  const tileShellClass = isLight
    ? `relative w-full overflow-hidden rounded-xl border bg-white p-3.5 text-left text-slate-950 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-all duration-200 focus:outline-none ${
        effectiveHoverEnabled ? 'hover:-translate-y-px hover:border-blue-300 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12)]' : ''
      } ${
        selected
          ? 'border-blue-500 ring-4 ring-blue-500/18 shadow-[0_0_0_1px_rgba(37,99,235,0.38),0_18px_44px_rgba(37,99,235,0.14)]'
          : 'border-slate-200'
      }`
    : `relative w-full overflow-hidden rounded-xl border bg-[#f7f1e6] p-3.5 text-left text-[#15120c] shadow-[0_16px_34px_rgba(0,0,0,0.22)] transition-all duration-200 focus:outline-none ${
        effectiveHoverEnabled ? 'hover:-translate-y-px hover:shadow-[0_22px_44px_rgba(0,0,0,0.28)]' : ''
      } ${
        selected
          ? 'border-[#2563eb] ring-4 ring-[#2563eb]/35 shadow-[0_0_0_1px_rgba(37,99,235,0.75),0_24px_54px_rgba(37,99,235,0.24)]'
          : `border-[#d8cdb9] ${effectiveHoverEnabled ? 'hover:border-[#15120c]/35' : ''}`
      }`;
  const dividerClass = isLight ? 'border-slate-200' : 'border-[#15120c]/10';
  const tileMuted = isLight ? 'text-slate-500' : 'text-[#7b6a52]';
  const tileSubtle = isLight ? 'text-slate-500/85' : 'text-[#7b6a52]/75';
  const tilePrimary = isLight ? 'text-slate-950' : 'text-[#15120c]';
  const tileMetricClass = isLight ? 'rounded-lg bg-slate-50 px-2.5 py-2' : 'rounded-lg bg-[#15120c]/5 px-2.5 py-2';
  const tileBarBg = isLight ? 'bg-slate-200' : 'bg-[#15120c]/10';
  const solarW = data?.solar.power ?? 0;
  const mpptLabel = data?.solar.mpptStateLabel ?? 'Off';
  const mpptColor = MPPT_LABEL_COLOR[mpptLabel] ?? '#4b5563';
  const charging = (data?.battery.state ?? 0) === 1;
  const discharging = (data?.battery.state ?? 0) === 2;
  const dcLoadW = data?.dcLoad ?? 0;
  const hasDirectLoadReading = data?.hasDcLoadReading !== false;
  const noDirectLoadReading = Boolean(data) && !hasDirectLoadReading;
  const loadSignalMissing = hasMissingDcLoadSignal(data);
  const batteryVoltage = data?.battery.voltage ?? 0;
  const batteryFlow = getBatteryFlowState(charging, discharging, noData);
  const batteryFlowWidth = noData ? 100 : Math.max(18, Math.min(100, Math.abs(data?.battery.current ?? 0) * 5 + 18));
  const location = data?.location ?? 'Location pending';
  const syncAge = formatSyncAge(lastSeenS);
  const priorityLabel = noData ? 'No Data' : isOffline ? 'Offline' : loadSignalMissing ? 'No DC Read' : soc < 80 ? 'Alert' : 'Healthy';
  const priorityColor = noData ? '#64748b' : isOffline ? '#f43f5e' : loadSignalMissing ? '#ea580c' : soc < 80 ? '#f59e0b' : '#10b981';
  const cloudyWeather = tileWeather && isCloudyWeatherCode(tileWeather.code) ? tileWeather : null;

  useEffect(() => {
    let cancelled = false;
    const lat = data?.lat;
    const lon = data?.lon;
    if (lat == null || lon == null) {
      setTileWeather(null);
      return () => { cancelled = true; };
    }

    fetchTileWeather(lat, lon).then((weather) => {
      if (!cancelled) setTileWeather(weather);
    });

    return () => { cancelled = true; };
  }, [data?.lat, data?.lon]);

  const handleMouseEnter = () => {
    if (!effectiveHoverEnabled) return;
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
        className={tileShellClass}
      >
        {selected && (
          <span className="pointer-events-none absolute inset-x-3 top-0 h-1 rounded-b-full bg-[#2563eb] shadow-[0_0_18px_rgba(37,99,235,0.85)]" />
        )}
        <div className={`flex items-start justify-between gap-3 border-b pb-3 ${dividerClass}`}>
          <div className="min-w-0">
            <div className={`text-[9px] font-black uppercase tracking-[0.26em] ${tileMuted}`}>{device.siteId}</div>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <span className={`truncate text-[17px] font-black ${tilePrimary}`}>{device.displayName ?? device.name}</span>
              {selected && (
                <span className="rounded-md border border-[#2563eb]/25 bg-[#2563eb] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white shadow-[0_0_12px_rgba(37,99,235,0.28)]">
                  Reviewing
                </span>
              )}
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
              <span className={`truncate text-[11px] font-bold ${tileMuted}`}>{location}</span>
              {cloudyWeather && <CloudWeatherCue label={cloudyWeather.label} />}
            </div>
            <div className={`mt-1 text-[10px] font-black uppercase tracking-[0.18em] ${tileSubtle}`}>{syncAge}</div>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
            <span className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[#15120c]/10 bg-white/55'}`} style={{ color: priorityColor }}>
              {priorityLabel}
            </span>
            <span className={`rounded-md border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[#15120c]/10 bg-[#15120c]/5'}`} style={{ color: mpptColor }}>
              {mpptLabel}
            </span>
          </div>
        </div>

        <div className="grid gap-3 pt-3 sm:grid-cols-[0.78fr_1fr]">
          <div>
            <div className="text-4xl font-black leading-none tabular-nums" style={{ color: ledgerBattery.color }}>{soc}%</div>
            <div className={`mt-1 text-[10px] font-black uppercase tracking-[0.22em] ${tileMuted}`}>{ledgerBattery.label}</div>
            <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${tileBarBg}`}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, soc))}%`, background: ledgerBattery.color }} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className={tileMetricClass}>
                <div className={`text-[9px] font-black uppercase tracking-[0.18em] ${tileMuted}`}>Solar</div>
                <div className="mt-1 text-sm font-black tabular-nums">{formatWatts(solarW)}</div>
              </div>
              <div className={`rounded-lg px-2.5 py-2 ${
                loadSignalMissing
                  ? 'border border-[#f59e0b]/35 bg-[#f59e0b]/10'
                  : isLight ? 'bg-slate-50' : 'bg-[#15120c]/5'
              }`}>
                <div className={`text-[9px] font-black uppercase tracking-[0.18em] ${tileMuted}`}>Load</div>
                <div className="mt-1 text-sm font-black tabular-nums">{noData ? 'Pending' : loadSignalMissing ? 'No read' : formatWatts(dcLoadW)}</div>
                {loadSignalMissing && (
                  <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-[#b45309]">
                    {noDirectLoadReading ? `Est. ${formatWatts(dcLoadW)}` : 'Verify signal'}
                  </div>
                )}
              </div>
            </div>
            <div className={tileMetricClass}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${tileMuted}`}>Voltage</span>
                <span className="text-xs font-black tabular-nums">
                  {noData ? 'Pending' : `${batteryVoltage.toFixed(2)} V`}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${tileMuted}`}>Battery Status</span>
                <span
                  className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em]"
                  style={{ color: batteryFlow.color }}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${batteryFlow.active ? 'animate-pulse' : ''}`}
                    style={{ background: batteryFlow.color, boxShadow: batteryFlow.active ? `0 0 12px ${batteryFlow.color}` : 'none' }}
                  />
                  {batteryFlow.symbol}
                </span>
              </div>
              <div className={`relative mt-2 h-1.5 overflow-hidden rounded-full ${tileBarBg}`}>
                <div
                  className={`h-full rounded-full transition-all duration-700 ${batteryFlow.active ? 'animate-pulse' : ''}`}
                  style={{ width: `${batteryFlowWidth}%`, background: batteryFlow.color, opacity: batteryFlow.active ? 0.86 : 0.48 }}
                />
              </div>
              <div className={`mt-1 text-[9px] font-bold ${tileSubtle}`}>{batteryFlow.detail}</div>
            </div>
          </div>
        </div>
      </button>
      {modemAccessUrl && (
        <form
          action={modemAccessUrl}
          method="post"
          target="_blank"
          onSubmit={(event) => event.stopPropagation()}
        >
          <button
            type="submit"
            onClick={(event) => event.stopPropagation()}
            className={`mt-1.5 flex w-full items-center justify-center rounded-lg border px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-[0.28em] transition-colors ${isLight ? 'border-slate-200 bg-white text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50' : 'border-[#1e3a5f] bg-[#08111f] text-[#22c55e]/80 hover:text-white hover:border-[#22c55e]/40'}`}
          >
            Modem Login
          </button>
        </form>
      )}
      {effectiveHoverEnabled && hovered && mounted && data && !noData && createPortal(
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
