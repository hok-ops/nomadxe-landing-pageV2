'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { VRMData } from './NomadXECoreView';
import { useTheme } from '@/components/ThemeProvider';

// Module-level cache — geocode is called once per unique location per session.
const geocodeCache = new Map<string, string>();

const US_STATES: Record<string, string> = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA',
  'Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD',
  'Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO',
  'Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ',
  'New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH',
  'Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
  'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
  'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
};

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`,
      { headers: { 'Accept-Language': 'en-US,en' } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const a = json.address ?? {};
    const city = a.city ?? a.town ?? a.village ?? a.suburb ?? a.neighbourhood ?? a.county ?? '';
    const state = a.state ?? '';
    const zip = a.postcode ?? '';
    const stateCode = US_STATES[state] ?? state;
    const label = [city, stateCode, zip].filter(Boolean).join(', ');
    if (label) geocodeCache.set(key, label);
    return label || null;
  } catch {
    return null;
  }
}

function getBatteryColor(soc: number, light: boolean) {
  if (soc >= 75) return light ? '#16a34a' : '#22c55e';
  if (soc >= 25) return light ? '#2563eb' : '#3b82f6';
  return               light ? '#dc2626' : '#ef4444';
}

const MPPT_LABEL_COLOR: Record<string, string> = {
  Float: '#22c55e', Storage: '#22c55e',
  Bulk: '#f59e0b', Absorption: '#f59e0b',
  Fault: '#ef4444', Off: '#9ca3af',
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
  /** Position in the rendered list, used to stagger mount-in. */
  index?: number;
}

// ── Hover detail popup (fixed positioning to escape overflow clipping) ─────────

function HoverDetail({
  data, device, isOffline, noData, isLight,
  fixedStyle,
}: {
  data: VRMData; device: Props['device'];
  isOffline: boolean; noData: boolean; isLight: boolean;
  fixedStyle: React.CSSProperties;
}) {
  const soc         = data.battery.soc;
  const batColor    = getBatteryColor(soc, isLight);
  const mpptLabel   = data.solar.mpptStateLabel ?? 'Off';
  const mpptColor   = MPPT_LABEL_COLOR[mpptLabel] ?? '#9ca3af';
  const charging    = data.battery.state === 1;
  const discharging = data.battery.state === 2;

  const nowS    = Date.now() / 1000;
  const staleS  = nowS - (data.lastSeen ?? 0);
  const syncAgo = data.lastSeen > 0
    ? staleS < 60   ? `${Math.floor(staleS)}s ago`
    : staleS < 3600 ? `${Math.floor(staleS / 60)}m ago`
    : `${Math.floor(staleS / 3600)}h ago`
    : '—';

  const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] font-mono text-[#93c5fd]/45 uppercase tracking-widest flex-shrink-0">{label}</span>
      <span className="text-[11px] font-black tabular-nums font-mono" style={{ color: color ?? '#e2e8f0' }}>{value}</span>
    </div>
  );

  return (
    <div
      className="bg-[#060a12] border border-[#3b82f6]/25 rounded-xl p-3.5 shadow-2xl pointer-events-none"
      style={{
        ...fixedStyle,
        boxShadow: '0 0 0 1px rgba(59,130,246,0.1), 0 20px 40px rgba(0,0,0,0.8)',
        minWidth: '220px',
      }}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-[12px] font-bold text-white truncate">{device.displayName ?? device.name}</span>
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex-shrink-0"
          style={{ color: mpptColor, background: mpptColor + '18', border: `1px solid ${mpptColor}30` }}>
          {mpptLabel}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${noData ? 'bg-[#4b5563]' : isOffline ? 'bg-red-500' : 'bg-emerald-400'}`} />
        <span className={`text-[10px] font-mono font-semibold ${noData ? 'text-[#6b7280]' : isOffline ? 'text-red-400' : 'text-emerald-400'}`}>
          {noData ? 'No data' : isOffline ? `Offline · ${syncAgo}` : `Live · ${syncAgo}`}
        </span>
      </div>
      <div className="border-t border-[#1e3a5f]/40 pt-2.5 mb-2.5 space-y-1.5">
        <div className="text-[9px] font-mono font-bold text-[#93c5fd]/30 uppercase tracking-widest mb-1">Battery</div>
        <Row label="SOC" value={`${soc}%`} color={batColor} />
        <Row label="Voltage" value={`${data.battery.voltage.toFixed(2)} V`} color="#93c5fd" />
        <Row label="Current" value={`${data.battery.current >= 0 ? '+' : ''}${data.battery.current.toFixed(1)} A`} color={charging ? '#22c55e' : discharging ? '#f59e0b' : '#93c5fd'} />
        <Row label="Power" value={`${Math.abs(data.battery.power).toFixed(1)} W`} color={charging ? '#22c55e' : discharging ? '#f59e0b' : '#93c5fd'} />
      </div>
      <div className="border-t border-[#1e3a5f]/40 pt-2.5 mb-2.5 space-y-1.5">
        <div className="text-[9px] font-mono font-bold text-[#93c5fd]/30 uppercase tracking-widest mb-1">Solar</div>
        <Row label="Output" value={`${data.solar.power.toFixed(1)} W`} color="#22c55e" />
        <Row label="Panel V" value={`${data.solar.voltage.toFixed(1)} V`} color="#22c55e88" />
        <Row label="Today" value={`${data.solar.yieldToday.toFixed(2)} kWh`} color="#22c55e88" />
      </div>
      <div className="border-t border-[#1e3a5f]/40 pt-2.5 space-y-1.5">
        <div className="text-[9px] font-mono font-bold text-[#93c5fd]/30 uppercase tracking-widest mb-1">DC Load</div>
        <Row label="Load" value={`${data.dcLoad.toFixed(1)} W`} color="#f59e0b" />
        <Row label="Site ID" value={device.siteId} color="#93c5fd60" />
      </div>
    </div>
  );
}

// ── Tile ──────────────────────────────────────────────────────────────────────

export default function FleetTile({ device, data, selected, onClick, index = 0 }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [hovered, setHovered] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [entered, setEntered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const tileRef = useRef<HTMLDivElement>(null);

  // Portal target is document.body — only available after mount (SSR safety).
  useEffect(() => { setMounted(true); }, []);

  // Reverse-geocode once when GPS coordinates become available.
  // Stagger by tile index (1.1s apart) to stay within Nominatim's 1 req/sec limit.
  useEffect(() => {
    if (data?.lat == null || data?.lon == null) return;
    const lat = data.lat;
    const lon = data.lon;
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    // Already cached — update immediately without waiting.
    if (geocodeCache.has(key)) { setLocation(geocodeCache.get(key)!); return; }
    const delay = index * 1100;
    const t = setTimeout(() => {
      reverseGeocode(lat, lon).then(result => { if (result) setLocation(result); });
    }, delay);
    return () => clearTimeout(t);
  }, [data?.lat, data?.lon, index]);

  // Mount stagger — tiles appear in a gentle cascade. Cap delay so large
  // fleets don't wait forever; respect reduced-motion by skipping the fade.
  useEffect(() => {
    if (typeof window === 'undefined') { setEntered(true); return; }
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { setEntered(true); return; }
    const delay = Math.min(index * 35, 450);
    const t = setTimeout(() => setEntered(true), delay);
    return () => clearTimeout(t);
  }, [index]);

  const nowS      = Date.now() / 1000;
  const lastSeenS = data?.lastSeen ?? 0;
  const isOffline = lastSeenS > 0 && (nowS - lastSeenS) > 15 * 60;
  const noData    = lastSeenS === 0;
  const soc        = data?.battery.soc ?? 0;
  const batColor   = getBatteryColor(soc, isLight);
  const solarW     = data?.solar.power ?? 0;
  const solarActive = solarW > 5;
  const mpptLabel  = data?.solar.mpptStateLabel ?? 'Off';
  const mpptColor  = MPPT_LABEL_COLOR[mpptLabel] ?? '#4b5563';
  const charging   = (data?.battery.state ?? 0) === 1;
  const discharging = (data?.battery.state ?? 0) === 2;

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
        onClick={onClick}
        className={`w-full text-left rounded-xl border p-3 transition-all duration-200 focus:outline-none ${
          selected
            ? isOffline
              ? 'border-red-500/50 bg-red-950/20 shadow-[0_0_0_2px_rgba(59,130,246,0.5),0_0_0_1px_rgba(239,68,68,0.3)]'
              : 'border-[#3b82f6]/70 bg-[#1e40af]/15 shadow-[0_0_0_2px_rgba(59,130,246,0.4)]'
            : 'border-[#1e3a5f] bg-[#080c14] hover:border-[#1e3a5f]/80 hover:bg-[#0d1526] hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(0,0,0,0.5)]'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${noData ? 'bg-[#4b5563]' : isOffline ? 'bg-red-500' : 'bg-emerald-400 animate-pulse'}`}
              style={(!noData && !isOffline) ? { boxShadow: '0 0 5px #4ade80' } : {}}
            />
            <span className="text-[13px] font-bold text-white truncate">{device.displayName ?? device.name}</span>
          </div>
          {selected && (
            <span className="flex-shrink-0 ml-1 text-[8px] font-black font-mono uppercase tracking-wider text-[#3b82f6] bg-[#3b82f6]/15 border border-[#3b82f6]/30 px-1.5 py-0.5 rounded">OPEN</span>
          )}
          {!selected && (
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex-shrink-0 ml-2"
              style={{ color: mpptColor, background: mpptColor + '18', border: `1px solid ${mpptColor}30` }}>
              {mpptLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={batColor} strokeWidth="2">
            <rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2" />
          </svg>
          <div className="flex-1 h-1.5 bg-[#0a0f1e] rounded-full overflow-hidden border border-[#1e3a5f]/60">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.max(0, Math.min(100, soc))}%`, backgroundColor: batColor, boxShadow: isLight ? 'none' : `0 0 4px ${batColor}` }} />
          </div>
          <span className="text-[12px] font-black tabular-nums flex-shrink-0" style={{ color: batColor }}>
            {soc}<span className="text-[9px] font-bold opacity-50">%</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke={solarActive ? (isLight ? '#16a34a' : '#22c55e') : (isLight ? '#94a3b8' : '#6b7280')} strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
              <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
            </svg>
            <span className="text-[11px] font-mono font-bold" style={{ color: solarActive ? (isLight ? '#16a34a' : '#22c55e') : (isLight ? '#94a3b8' : '#6b7280') }}>
              {solarW.toFixed(2)}W
            </span>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-widest" style={{
            color: charging ? (isLight ? '#16a34a' : '#22c55ecc')
              : discharging ? (isLight ? '#d97706' : '#f59e0bcc')
              : (isLight ? '#64748b' : '#93c5fd80'),
          }}>
            {charging ? '↑ chg' : discharging ? '↓ bat' : noData ? '—' : 'stby'}
          </span>
        </div>
        <div className="mt-1 text-[9px] font-mono text-[#93c5fd]/50 truncate">
          {location ?? device.siteId}
        </div>
      </button>
      {modemAccessUrl && (
        <a
          href={modemAccessUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="mt-1.5 flex items-center justify-center rounded-lg border border-[#1e3a5f] bg-[#08111f] px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-[0.28em] text-[#22c55e]/80 hover:text-white hover:border-[#22c55e]/40 transition-colors"
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
