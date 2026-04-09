'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTheme } from '@/components/ThemeProvider';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VRMData {
  siteId: string;
  lastSeen: number;
  battery: { soc: number; voltage: number; current: number; power: number; state: number };
  solar: {
    power: number; voltage: number;
    yieldToday: number; mpptState: number; mpptStateLabel: string;
  };
  dcLoad: number;
  sparkline: number[];
}

interface Props {
  device: { siteId: string; name: string };
  initialData: VRMData | null;
  displayName?: string | null;
  onRename?: (siteId: string, newName: string) => Promise<void>;
}

// ── MPPT state → visual config ────────────────────────────────────────────────
// NomadXE trailers are DC-only. The MPPT charger state is the primary
// system state signal — no inverter/VEBus present.

const MPPT_STYLE: Record<number, { color: string; glow: string; border: string }> = {
  0:  { color: '#6b7280', glow: 'rgba(107,114,128,0.15)', border: '#374151' },  // Off
  2:  { color: '#ef4444', glow: 'rgba(239,68,68,0.20)',   border: '#991b1b' },  // Fault
  3:  { color: '#f59e0b', glow: 'rgba(245,158,11,0.20)',  border: '#b45309' },  // Bulk
  4:  { color: '#f59e0b', glow: 'rgba(245,158,11,0.18)',  border: '#b45309' },  // Absorption
  5:  { color: '#22c55e', glow: 'rgba(34,197,94,0.18)',   border: '#15803d' },  // Float
  6:  { color: '#22c55e', glow: 'rgba(34,197,94,0.18)',   border: '#15803d' },  // Storage
  7:  { color: '#3b82f6', glow: 'rgba(59,130,246,0.18)',  border: '#1d4ed8' },  // Equalize
};

function getMpptStyle(state: number) {
  return MPPT_STYLE[state] ?? MPPT_STYLE[0];
}

function getBatteryColor(soc: number, light = false) {
  if (soc >= 75) return light ? '#16a34a' : '#22c55e';
  if (soc >= 25) return light ? '#2563eb' : '#3b82f6';
  return               light ? '#dc2626' : '#ef4444';
}

// ── Solar Sparkline ───────────────────────────────────────────────────────────

function SolarSparkline({ data }: { data: number[] }) {
  if (data.length < 2) {
    return (
      <div className="h-9 flex items-center">
        <span className="text-[10px] text-[#93c5fd]/20 font-mono uppercase tracking-widest">No trend data</span>
      </div>
    );
  }
  const W = 200, H = 36;
  const max = Math.max(...data, 1);
  const step = W / (data.length - 1);
  const pts = data.map((v, i) => ({ x: +(i * step).toFixed(1), y: +(H - (v / max) * (H - 4)).toFixed(1) }));
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `M${pts[0].x},${H} ${pts.map(p => `L${p.x},${p.y}`).join(' ')} L${pts[pts.length - 1].x},${H} Z`;
  const uid = data.slice(0, 3).join('-');

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${uid})`} />
      <polyline points={polyline} fill="none" stroke="#22c55e" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill="#22c55e" />
    </svg>
  );
}

// ── Flow Arrow ────────────────────────────────────────────────────────────────

function FlowArrow({ active, color = '#3b82f6' }: { active: boolean; color?: string }) {
  const c = active ? color : '#1e3a5f';
  return (
    <>
      {/* Mobile: vertical down arrow */}
      <div className="lg:hidden flex justify-center py-1 flex-shrink-0">
        <svg width="14" height="30" viewBox="0 0 14 30">
          {active && (
            <style>{`@keyframes fav{from{stroke-dashoffset:12}to{stroke-dashoffset:0}}.fav{animation:fav .65s linear infinite}`}</style>
          )}
          <line x1="7" y1="2" x2="7" y2="20" stroke={c} strokeWidth="1.5"
            strokeDasharray={active ? '5 3.5' : 'none'}
            className={active ? 'fav' : ''} />
          <polygon points="3,18 7,30 11,18" fill={c} />
        </svg>
      </div>
      {/* Desktop: horizontal right arrow */}
      <div className="hidden lg:flex items-center justify-center flex-shrink-0 w-12">
        <svg width="48" height="14" viewBox="0 0 48 14">
          {active && (
            <style>{`@keyframes fa{from{stroke-dashoffset:12}to{stroke-dashoffset:0}}.fa{animation:fa .65s linear infinite}`}</style>
          )}
          <line x1="2" y1="7" x2="38" y2="7" stroke={c} strokeWidth="1.5"
            strokeDasharray={active ? '5 3.5' : 'none'}
            className={active ? 'fa' : ''} />
          <polygon points="38,3 48,7 38,11" fill={c} />
        </svg>
      </div>
    </>
  );
}

// ── Battery SOC bar ───────────────────────────────────────────────────────────

function SocBar({ soc, light }: { soc: number; light: boolean }) {
  const color = getBatteryColor(soc, light);
  const pct   = Math.max(0, Math.min(100, soc));
  return (
    <div className="w-full h-1.5 bg-[#0a0f1e] rounded-full overflow-hidden border border-[#1e3a5f]/60">
      <div
        className="h-full rounded-full transition-all duration-1000"
        style={{ width: `${pct}%`, backgroundColor: color, boxShadow: light ? 'none' : `0 0 6px ${color}` }}
      />
    </div>
  );
}

// ── Offline overlay ───────────────────────────────────────────────────────────

function OfflineOverlay({ staleSince }: { staleSince: number }) {
  const mins = Math.floor((Date.now() / 1000 - staleSince) / 60);
  return (
    <div className="absolute inset-0 z-20 rounded-2xl flex flex-col items-center justify-center gap-3"
      style={{ background: 'rgba(8,12,20,0.90)', backdropFilter: 'blur(2px)' }}>
      <style>{`
        @keyframes op{0%,100%{border-color:rgba(239,68,68,.55);box-shadow:0 0 0 0 rgba(239,68,68,0)}
        50%{border-color:rgba(75,85,99,.35);box-shadow:0 0 20px 3px rgba(239,68,68,.15)}}
        .op{animation:op 2.2s ease-in-out infinite}
      `}</style>
      <div className="absolute inset-0 rounded-2xl border-2 op" />
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
      <div className="text-center space-y-1">
        <div className="text-red-400 font-black text-xs tracking-[0.35em] uppercase font-mono">Signal Lost</div>
        <div className="text-[#93c5fd]/45 text-[11px] font-mono">
          {mins < 60 ? `No data for ${mins}m` : `Offline ${Math.floor(mins / 60)}h ${mins % 60}m`}
          {mins >= 30 ? ' — check trailer' : ''}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-red-500/50 font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block" />
        Attempting reconnect…
      </div>
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({
  label, value, unit, color = '#93c5fd',
}: { label: string; value: string; unit: string; color?: string }) {
  return (
    <div className="bg-[#080c14] rounded-lg px-3 py-2.5 border border-[#1e3a5f]/50">
      <div className="text-[9px] text-[#93c5fd]/60 font-mono uppercase tracking-widest mb-1">{label}</div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-sm font-black tabular-nums" style={{ color }}>{value}</span>
        <span className="text-[10px] font-bold" style={{ color: color + 'b3' }}>{unit}</span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function NomadXECoreView({ device, initialData, displayName, onRename }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [data, setData]       = useState<VRMData | null>(initialData);
  const [lastPoll, setLastPoll] = useState(new Date());
  const [, setTick]           = useState(0);

  // Inline rename state
  const [editing, setEditing]   = useState(false);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraftName(displayName ?? device.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const cancelEdit = () => { setEditing(false); setDraftName(''); };

  const commitEdit = async () => {
    if (!onRename) { cancelEdit(); return; }
    const trimmed = draftName.trim();
    if (trimmed === (displayName ?? device.name)) { cancelEdit(); return; }
    setSaving(true);
    await onRename(device.siteId, trimmed);
    setSaving(false);
    setEditing(false);
  };

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/vrm/${device.siteId}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setData(json.data);
      } else {
        console.error(`[VRM poll] ${device.siteId} → HTTP ${res.status}`);
      }
    } catch (err) {
      console.error(`[VRM poll] ${device.siteId} fetch error:`, err);
    }
    setLastPoll(new Date());
  }, [device.siteId]);

  // Poll immediately on mount, then every 30 s
  useEffect(() => {
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [poll]);

  // 1 s clock tick for elapsed time display
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const nowS      = Date.now() / 1000;
  const lastSeenS = data?.lastSeen ?? 0;
  const staleS    = nowS - lastSeenS;
  const isOffline = lastSeenS > 0 && staleS > 15 * 60;

  const soc         = data?.battery.soc ?? 0;
  const batColor    = getBatteryColor(soc, isLight);
  const mppt        = getMpptStyle(data?.solar.mpptState ?? 0);
  const solarActive = (data?.solar.power ?? 0) > 5;
  const loadActive  = (data?.dcLoad ?? 0) > 5;
  const charging    = (data?.battery.state ?? 0) === 1;
  const discharging = (data?.battery.state ?? 0) === 2;

  const syncAgo = lastSeenS > 0
    ? staleS < 60    ? `${Math.floor(staleS)}s ago`
    : staleS < 3600  ? `${Math.floor(staleS / 60)}m ago`
    : `${Math.floor(staleS / 3600)}h ago`
    : '—';

  return (
    <div className="relative bg-[#0d1526] border border-[#1e3a5f] rounded-2xl overflow-hidden shadow-[0_20px_56px_rgba(0,0,0,0.55)]">

      {isOffline && <OfflineOverlay staleSince={lastSeenS} />}

      {/* Top shimmer */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#3b82f6]/20 to-transparent" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 sm:px-6 py-4 border-b border-[#1e3a5f]/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`flex-shrink-0 w-2 h-2 rounded-full ${isOffline ? 'bg-red-500' : 'bg-emerald-400 animate-pulse'}`}
            style={isOffline ? {} : { boxShadow: '0 0 7px #4ade80' }}
          />

          {/* Inline device name — click pencil to edit */}
          {editing ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <input
                ref={inputRef}
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                onBlur={commitEdit}
                disabled={saving}
                maxLength={80}
                className="bg-[#080c14] border border-[#3b82f6]/60 rounded-md px-2 py-0.5 text-white font-bold text-sm outline-none focus:ring-1 focus:ring-[#3b82f6]/40 w-48 disabled:opacity-50"
              />
              {saving && (
                <svg className="animate-spin flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group/name min-w-0">
              <span className="text-white font-bold text-sm truncate">
                {displayName ?? device.name}
              </span>
              {onRename && (
                <button
                  onClick={startEdit}
                  title="Rename device"
                  className="flex-shrink-0 opacity-0 group-hover/name:opacity-100 transition-opacity text-[#93c5fd]/40 hover:text-[#3b82f6] focus:opacity-100"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          <span className="hidden sm:inline text-[10px] font-mono text-[#93c5fd]/60 uppercase tracking-widest flex-shrink-0">
            Site {device.siteId}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-[#93c5fd]/60 uppercase tracking-widest flex-shrink-0">
          {isOffline
            ? <span className="text-red-400 font-bold">Offline · VRM {syncAgo}</span>
            : <>
                <span title={`VRM device last reported ${syncAgo}`}>
                  Synced {lastPoll.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="text-[#93c5fd]/35" title="When Victron device last sent telemetry to VRM">
                  VRM {syncAgo}
                </span>
              </>
          }
        </div>
      </div>

      <div className="p-4 sm:p-6">

        {/* ── Power Flow: Solar → Battery → DC Loads (row on desktop, column on mobile) ── */}
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-3 lg:gap-0">

          {/* Solar Card */}
          <div className="flex-1 min-w-0 bg-[#080c14] border border-[#1e3a5f]/50 rounded-xl p-5">

            <div className="flex items-center gap-2 mb-4">
              {/* Sun icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
                <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
                <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
              </svg>
              <span className="text-[10px] font-bold text-[#22c55e]/85 uppercase tracking-[0.3em] font-mono">Solar</span>
            </div>

            {/* Primary wattage */}
            <div className="mb-0.5">
              <span className="text-4xl font-black tabular-nums leading-none"
                style={{ color: solarActive ? (isLight ? '#16a34a' : '#22c55e') : (isLight ? '#94a3b8' : '#374151') }}>
                {+(data?.solar.power ?? 0).toFixed(2)}
              </span>
              <span className="text-sm font-bold text-[#22c55e]/70 ml-1">W</span>
            </div>

            {/* Stats row */}
            <div className="flex gap-3 mt-2 mb-1 text-[11px] font-mono">
              <span className="text-[#93c5fd]/65">{(data?.solar.voltage ?? 0).toFixed(1)} V</span>
            </div>

            {/* Yield today */}
            <div className="text-[10px] font-mono text-[#22c55e]/70 uppercase tracking-widest mt-2 mb-3">
              Today: {(data?.solar.yieldToday ?? 0).toFixed(2)} kWh
            </div>

            {/* Sparkline */}
            <div>
              <div className="text-[9px] text-[#93c5fd]/60 font-mono uppercase tracking-widest mb-1.5">
                6h Harvest Trend
              </div>
              <SolarSparkline data={data?.sparkline ?? []} />
            </div>
          </div>

          {/* Arrow: Solar → Battery */}
          <FlowArrow active={solarActive} color="#22c55e" />

          {/* ── Battery Hub (center) ── */}
          <div
            className="flex-[1.15] min-w-0 bg-[#080c14] rounded-xl p-5 flex flex-col"
            style={{
              border: `1px solid ${charging ? '#22c55e30' : discharging ? '#3b82f630' : '#1e3a5f80'}`,
            }}
          >
            {/* Label + MPPT state badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {/* Battery icon */}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={batColor} strokeWidth="1.8">
                  <rect x="2" y="7" width="18" height="10" rx="2" />
                  <path d="M22 11v2" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] font-mono" style={{ color: batColor + 'cc' }}>
                  Battery
                </span>
              </div>

              {/* MPPT state pill */}
              {data && (
                <span
                  className="text-[10px] font-black font-mono uppercase tracking-wider px-2.5 py-1 rounded-md"
                  style={{
                    color: mppt.color,
                    background: mppt.glow,
                    border: `1px solid ${mppt.border}40`,
                  }}
                >
                  {data.solar.mpptStateLabel}
                </span>
              )}
            </div>

            {/* SOC — primary number */}
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-5xl font-black tabular-nums text-white leading-none">{soc}</span>
              <span className="text-xl font-bold text-[#93c5fd]/65">%</span>
            </div>

            {/* SOC bar */}
            <SocBar soc={soc} light={isLight} />

            {/* Charge direction label */}
            <div className="mt-2 mb-4 text-[10px] font-mono uppercase tracking-widest" style={{
              color: charging
                ? (isLight ? '#16a34a' : '#22c55ecc')
                : discharging
                  ? (isLight ? '#d97706' : '#f59e0bcc')
                  : (isLight ? '#64748b'  : '#93c5fd80'),
            }}>
              {charging ? '↑ Charging' : discharging ? '↓ On Battery' : 'Standby'}
            </div>

            {/* Voltage / Current / Power stats */}
            <div className="grid grid-cols-3 gap-2 mt-auto">
              <StatPill
                label="Voltage" unit="V"
                value={(data?.battery.voltage ?? 0).toFixed(2)}
                color={isLight ? '#2563eb' : '#93c5fd'}
              />
              <StatPill
                label="Current" unit="A"
                value={`${(data?.battery.current ?? 0) >= 0 ? '+' : ''}${(data?.battery.current ?? 0).toFixed(1)}`}
                color={charging ? (isLight ? '#16a34a' : '#22c55e') : discharging ? (isLight ? '#d97706' : '#f59e0b') : (isLight ? '#2563eb' : '#93c5fd')}
              />
              <StatPill
                label="Power" unit="W"
                value={(Math.abs(data?.battery.power ?? 0)).toFixed(2)}
                color={isLight ? '#2563eb' : '#93c5fd'}
              />
            </div>
          </div>

          {/* Arrow: Battery → DC Loads */}
          <FlowArrow active={loadActive} color="#f59e0b" />

          {/* DC Loads Card */}
          <div className="flex-1 min-w-0 bg-[#080c14] border border-[#1e3a5f]/50 rounded-xl p-5 flex flex-col">

            <div className="flex items-center gap-2 mb-4">
              {/* Plug icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
              </svg>
              <span className="text-[10px] font-bold text-[#f59e0b]/85 uppercase tracking-[0.3em] font-mono">DC Loads</span>
            </div>

            {/* Primary wattage */}
            <div className="mb-0.5">
              <span className="text-4xl font-black tabular-nums leading-none"
                style={{ color: loadActive ? (isLight ? '#d97706' : '#f59e0b') : (isLight ? '#94a3b8' : '#374151') }}>
                {+(data?.dcLoad ?? 0).toFixed(2)}
              </span>
              <span className="text-sm font-bold text-[#f59e0b]/70 ml-1">W</span>
            </div>

            <div className="text-[10px] font-mono text-[#93c5fd]/65 mt-2 uppercase tracking-widest">
              DC System Load
            </div>

            {/* Solar coverage / surplus */}
            {solarActive && loadActive && (() => {
              const sW = data?.solar.power ?? 0;
              const lW = data?.dcLoad ?? 1;
              const surplus = sW >= lW;
              const pct = Math.round((sW / Math.max(lW, 1)) * 100);
              return (
                <div className="mt-auto pt-4">
                  <div className="text-[9px] font-mono uppercase tracking-widest mb-1.5"
                    style={{ color: surplus ? 'rgba(34,197,94,0.75)' : 'rgba(147,197,253,0.65)' }}>
                    {surplus ? 'Solar Surplus' : 'Solar Coverage'}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-[#0a0f1e] rounded-full overflow-hidden border border-[#1e3a5f]/40">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: surplus ? '100%' : `${pct}%`,
                          backgroundColor: surplus ? '#22c55e' : '#f59e0b',
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-black tabular-nums"
                      style={{ color: surplus ? '#22c55e' : '#f59e0b' }}>
                      {surplus ? `+${+(sW - lW).toFixed(2)}W` : `${pct}%`}
                    </span>
                  </div>
                  <div className="text-[9px] font-mono mt-1"
                    style={{ color: surplus ? 'rgba(34,197,94,0.7)' : 'rgba(245,158,11,0.7)' }}>
                    {surplus
                      ? `${pct}% of load — excess charging battery`
                      : 'battery supplementing load'}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
