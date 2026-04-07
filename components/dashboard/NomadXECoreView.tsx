'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VRMData {
  siteId: string;
  lastSeen: number;
  battery: { soc: number; voltage: number; current: number; power: number };
  solar:   { power: number; voltage: number; yieldToday: number };
  inverterState: number;
  inverterStateLabel: string;
  acLoad: number;
  sparkline: number[];
}

interface Props {
  device: { siteId: string; name: string };
  initialData: VRMData | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OFFLINE_THRESHOLD_S = 15 * 60; // 15 minutes
const POLL_INTERVAL_MS    = 30_000;  // 30 seconds

// VEBus state → visual config
const INVERTER_STATES: Record<number, { label: string; color: string; glow: string; ring: string }> = {
  0:  { label: 'Off',          color: '#6b7280', glow: 'rgba(107,114,128,0.3)', ring: '#374151' },
  1:  { label: 'Low Power',    color: '#3b82f6', glow: 'rgba(59,130,246,0.3)',  ring: '#1d4ed8' },
  2:  { label: 'Fault',        color: '#ef4444', glow: 'rgba(239,68,68,0.4)',   ring: '#dc2626' },
  3:  { label: 'Bulk',         color: '#f59e0b', glow: 'rgba(245,158,11,0.3)',  ring: '#d97706' },
  4:  { label: 'Absorption',   color: '#f59e0b', glow: 'rgba(245,158,11,0.3)',  ring: '#d97706' },
  5:  { label: 'Float',        color: '#22c55e', glow: 'rgba(34,197,94,0.3)',   ring: '#16a34a' },
  6:  { label: 'Storage',      color: '#22c55e', glow: 'rgba(34,197,94,0.3)',   ring: '#16a34a' },
  9:  { label: 'Inverting',    color: '#3b82f6', glow: 'rgba(59,130,246,0.3)',  ring: '#1d4ed8' },
  10: { label: 'Power Assist', color: '#8b5cf6', glow: 'rgba(139,92,246,0.3)', ring: '#7c3aed' },
  11: { label: 'Power Supply', color: '#06b6d4', glow: 'rgba(6,182,212,0.3)',  ring: '#0891b2' },
};

function getBatteryColor(soc: number) {
  if (soc >= 75) return { stroke: '#22c55e', glow: 'rgba(34,197,94,0.6)'   };
  if (soc >= 25) return { stroke: '#3b82f6', glow: 'rgba(59,130,246,0.6)'  };
  return              { stroke: '#ef4444', glow: 'rgba(239,68,68,0.6)'    };
}

// ── Solar Sparkline (SVG area chart) ─────────────────────────────────────────

function SolarSparkline({ data }: { data: number[] }) {
  if (data.length < 2) {
    return <div className="h-9 flex items-center text-[10px] text-[#93c5fd]/25 font-mono">no data</div>;
  }

  const W = 140, H = 36;
  const max = Math.max(...data, 1);
  const step = W / (data.length - 1);
  const pts = data.map((v, i) => ({ x: i * step, y: H - (v / max) * (H - 4) }));
  const line = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `M${pts[0].x},${H} ${pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} L${pts[pts.length - 1].x},${H} Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${data.join('')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${data.join('')})`} />
      <polyline
        points={line}
        fill="none"
        stroke="#22c55e"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill="#22c55e" />
    </svg>
  );
}

// ── Flow Arrow ────────────────────────────────────────────────────────────────

function FlowArrow({
  axis,
  active,
  color = '#3b82f6',
  reverse = false,
}: {
  axis: 'h' | 'v';
  active: boolean;
  color?: string;
  reverse?: boolean;
}) {
  const dim = active ? color : '#1e3a5f';

  if (axis === 'h') {
    return (
      <div className="flex items-center justify-center w-14 flex-shrink-0">
        <svg width="56" height="16" viewBox="0 0 56 16">
          {active && (
            <style>{`
              @keyframes fh { from { stroke-dashoffset: 12; } to { stroke-dashoffset: 0; } }
              .fh { animation: fh 0.7s linear infinite; }
            `}</style>
          )}
          <line
            x1={reverse ? 50 : 4} y1="8"
            x2={reverse ? 4 : 44} y2="8"
            stroke={dim} strokeWidth="1.5"
            strokeDasharray={active ? '5 4' : 'none'}
            className={active ? 'fh' : ''}
          />
          <polygon
            points={reverse ? '6,4 0,8 6,12' : '50,4 56,8 50,12'}
            fill={dim}
          />
        </svg>
      </div>
    );
  }

  // Vertical
  return (
    <div className="flex justify-center items-center h-10">
      <svg width="16" height="40" viewBox="0 0 16 40">
        {active && (
          <style>{`
            @keyframes fv { from { stroke-dashoffset: 12; } to { stroke-dashoffset: 0; } }
            .fv { animation: fv 0.7s linear infinite; }
          `}</style>
        )}
        <line
          x1="8" y1={reverse ? 36 : 2}
          x2="8" y2={reverse ? 2 : 30}
          stroke={dim} strokeWidth="1.5"
          strokeDasharray={active ? '5 4' : 'none'}
          className={active ? 'fv' : ''}
        />
        <polygon
          points={reverse ? '4,4 8,0 12,4' : '4,32 8,40 12,32'}
          fill={dim}
        />
      </svg>
    </div>
  );
}

// ── Battery bar ───────────────────────────────────────────────────────────────

function BatteryBar({ soc }: { soc: number }) {
  const { stroke } = getBatteryColor(soc);
  const pct = Math.max(0, Math.min(100, soc));

  return (
    <div className="relative w-full h-2 bg-[#0d1526] rounded-full overflow-hidden border border-[#1e3a5f]">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
        style={{
          width: `${pct}%`,
          backgroundColor: stroke,
          boxShadow: `0 0 8px ${stroke}`,
        }}
      />
    </div>
  );
}

// ── Offline overlay ───────────────────────────────────────────────────────────

function OfflineOverlay({ staleSince }: { staleSince: number }) {
  const elapsed = Math.floor((Date.now() / 1000 - staleSince) / 60);
  return (
    <div className="absolute inset-0 z-20 rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]"
      style={{ background: 'rgba(8,12,20,0.88)' }}>
      <style>{`
        @keyframes offlinePulse {
          0%,100% { border-color: rgba(239,68,68,0.6); box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          50%      { border-color: rgba(107,114,128,0.4); box-shadow: 0 0 24px 4px rgba(239,68,68,0.2); }
        }
        .offline-ring { animation: offlinePulse 2s ease-in-out infinite; }
      `}</style>
      <div className="absolute inset-0 rounded-2xl border-2 offline-ring" />
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
      <div className="text-center">
        <div className="text-red-400 font-black text-sm tracking-[0.3em] uppercase font-mono">Signal Lost</div>
        <div className="text-[#93c5fd]/50 text-[11px] font-mono mt-1">
          {elapsed < 60
            ? `No data for ${elapsed}m — possible comms failure`
            : `Offline ${Math.floor(elapsed / 60)}h ${elapsed % 60}m — theft alert possible`}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-red-400/60 font-mono">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
        Attempting reconnect
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NomadXECoreView({ device, initialData }: Props) {
  const [data, setData]         = useState<VRMData | null>(initialData);
  const [lastPoll, setLastPoll] = useState<Date>(new Date());
  const [ticking, setTicking]   = useState(0); // force re-render for clock

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/vrm/${device.siteId}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setData(json.data);
      }
    } catch {
      // keep last data; heartbeat will trigger offline state
    }
    setLastPoll(new Date());
  }, [device.siteId]);

  // 30-second data poll
  useEffect(() => {
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [poll]);

  // 1-second clock tick for live elapsed time display
  useEffect(() => {
    const id = setInterval(() => setTicking(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const nowS       = Date.now() / 1000;
  const lastSeenS  = data?.lastSeen ?? 0;
  const staleS     = nowS - lastSeenS;
  const isOffline  = lastSeenS > 0 && staleS > OFFLINE_THRESHOLD_S;

  const inv        = INVERTER_STATES[data?.inverterState ?? -1] ?? INVERTER_STATES[0];
  const batColor   = getBatteryColor(data?.battery.soc ?? 0);
  const soc        = data?.battery.soc ?? 0;

  // Flow activity thresholds
  const solarActive    = (data?.solar.power ?? 0) > 10;
  const discharging    = (data?.battery.current ?? 0) < -0.5;
  const charging       = (data?.battery.current ?? 0) > 0.5;
  const loadActive     = (data?.acLoad ?? 0) > 10;

  const syncAgo = lastSeenS > 0
    ? staleS < 60
      ? `${Math.floor(staleS)}s ago`
      : staleS < 3600
        ? `${Math.floor(staleS / 60)}m ago`
        : `${Math.floor(staleS / 3600)}h ago`
    : '—';

  return (
    <div className="relative bg-[#0d1526] border border-[#1e3a5f] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.6)] overflow-hidden">

      {/* Offline overlay */}
      {isOffline && <OfflineOverlay staleSince={lastSeenS} />}

      {/* Top accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#3b82f6]/25 to-transparent" />

      {/* Card header */}
      <div className="flex items-center justify-between px-7 py-5 border-b border-[#1e3a5f]/60">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-red-500' : 'bg-emerald-400 animate-pulse'}`}
            style={isOffline ? {} : { boxShadow: '0 0 8px #4ade80' }} />
          <div>
            <span className="text-white font-bold text-sm">{device.name}</span>
            <span className="ml-2 text-[10px] font-mono text-[#3b82f6]/50 uppercase tracking-widest">
              Site {device.siteId}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-5 text-[10px] font-mono text-[#93c5fd]/40 uppercase tracking-widest">
          <span>Sync {syncAgo}</span>
          {!isOffline && (
            <span className="text-[#3b82f6]/50">
              {lastPoll.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          {isOffline && <span className="text-red-400/80 font-bold">OFFLINE</span>}
        </div>
      </div>

      <div className="p-7">
        {/* ── Power Flow: Solar → Inverter → Loads ── */}
        <div className="flex items-stretch gap-0 mb-4">

          {/* ── Solar Card ── */}
          <div className="flex-1 bg-[#080c14] border border-[#1e3a5f]/60 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
                <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
                <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
              </svg>
              <span className="text-[10px] font-bold text-[#22c55e]/70 uppercase tracking-[0.3em] font-mono">Solar</span>
            </div>

            {/* Primary: Power */}
            <div className="mb-1">
              <span
                className="text-3xl font-black tabular-nums"
                style={{ color: solarActive ? '#22c55e' : '#6b7280' }}
              >
                {data?.solar.power ?? 0}
              </span>
              <span className="text-sm font-bold text-[#22c55e]/50 ml-1">W</span>
            </div>

            {/* Secondary: Voltage */}
            <div className="text-[11px] text-[#93c5fd]/40 font-mono mb-3">
              {(data?.solar.voltage ?? 0).toFixed(1)} V
            </div>

            {/* Yield today */}
            <div className="text-[10px] font-mono text-[#22c55e]/50 uppercase tracking-widest mb-3">
              Today: {(data?.solar.yieldToday ?? 0).toFixed(2)} kWh
            </div>

            {/* 6-hour sparkline */}
            <div>
              <div className="text-[9px] text-[#93c5fd]/25 font-mono mb-1 uppercase tracking-widest">6h Yield Trend</div>
              <SolarSparkline data={data?.sparkline ?? []} />
            </div>
          </div>

          {/* Arrow: Solar → Inverter */}
          <FlowArrow axis="h" active={solarActive} color="#22c55e" />

          {/* ── Inverter Hub ── */}
          <div
            className="flex-shrink-0 w-44 bg-[#080c14] border rounded-xl p-5 flex flex-col items-center justify-center text-center"
            style={{ borderColor: inv.color + '40' }}
          >
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ background: inv.glow, border: `1px solid ${inv.color}30` }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={inv.color} strokeWidth="1.8">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>

            <div className="text-[9px] font-bold text-[#93c5fd]/40 uppercase tracking-[0.35em] font-mono mb-2">
              Inverter
            </div>

            {/* State badge */}
            <div
              className="px-3 py-1.5 rounded-lg text-[11px] font-black font-mono uppercase tracking-wider mb-3"
              style={{ color: inv.color, background: inv.glow, border: `1px solid ${inv.color}30` }}
            >
              {data ? inv.label : '—'}
            </div>

            {/* Charging / Discharging indicator */}
            <div className="text-[10px] font-mono text-[#93c5fd]/35">
              {charging   ? '↑ Charging battery'   : ''}
              {discharging ? '↓ Running on battery' : ''}
              {!charging && !discharging ? 'Standby' : ''}
            </div>
          </div>

          {/* Arrow: Inverter → Loads */}
          <FlowArrow axis="h" active={loadActive} color="#f59e0b" />

          {/* ── Loads Card ── */}
          <div className="flex-1 bg-[#080c14] border border-[#1e3a5f]/60 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
              </svg>
              <span className="text-[10px] font-bold text-[#f59e0b]/70 uppercase tracking-[0.3em] font-mono">Loads</span>
            </div>

            {/* AC Load */}
            <div className="mb-4">
              <div className="text-[9px] text-[#93c5fd]/30 font-mono uppercase tracking-widest mb-1">AC Consumption</div>
              <div>
                <span
                  className="text-3xl font-black tabular-nums"
                  style={{ color: loadActive ? '#f59e0b' : '#6b7280' }}
                >
                  {data?.acLoad ?? 0}
                </span>
                <span className="text-sm font-bold text-[#f59e0b]/50 ml-1">W</span>
              </div>
            </div>

            {/* Efficiency ratio (solar vs load) */}
            {solarActive && loadActive && (
              <div className="mt-3 p-3 rounded-lg bg-[#0d1526] border border-[#1e3a5f]/40">
                <div className="text-[9px] text-[#93c5fd]/30 font-mono uppercase tracking-widest mb-1">Solar Coverage</div>
                <div className="text-sm font-black"
                  style={{ color: (data?.solar.power ?? 0) >= (data?.acLoad ?? 0) ? '#22c55e' : '#f59e0b' }}>
                  {Math.min(100, Math.round(((data?.solar.power ?? 0) / Math.max(data?.acLoad ?? 1, 1)) * 100))}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Arrow: Inverter ↕ Battery */}
        <div className="flex" style={{ paddingLeft: 'calc(50% - 8px)' }}>
          <FlowArrow
            axis="v"
            active={charging || discharging}
            color={charging ? '#22c55e' : '#3b82f6'}
            reverse={discharging}
          />
        </div>

        {/* ── Battery Card (full width) ── */}
        <div className="bg-[#080c14] border border-[#1e3a5f]/60 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={batColor.stroke} strokeWidth="1.8">
                <rect x="2" y="7" width="18" height="10" rx="2" />
                <path d="M22 11v2" />
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] font-mono" style={{ color: batColor.stroke + 'aa' }}>
                Battery
              </span>
            </div>
            {/* SOC readout */}
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black tabular-nums text-white">{soc}</span>
              <span className="text-sm font-bold text-[#93c5fd]/40">%</span>
            </div>
          </div>

          {/* SOC bar */}
          <div className="mb-5">
            <BatteryBar soc={soc} />
          </div>

          {/* Battery metrics row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: 'Voltage',
                value: `${(data?.battery.voltage ?? 0).toFixed(2)}`,
                unit: 'V',
                color: '#93c5fd',
              },
              {
                label: 'Current',
                value: (data?.battery.current ?? 0) >= 0
                  ? `+${(data?.battery.current ?? 0).toFixed(1)}`
                  : `${(data?.battery.current ?? 0).toFixed(1)}`,
                unit: 'A',
                color: charging ? '#22c55e' : discharging ? '#f59e0b' : '#93c5fd',
              },
              {
                label: 'Power',
                value: `${Math.abs(data?.battery.power ?? 0)}`,
                unit: 'W',
                color: '#93c5fd',
              },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="bg-[#0d1526] rounded-lg p-3 border border-[#1e3a5f]/40">
                <div className="text-[9px] text-[#93c5fd]/30 font-mono uppercase tracking-widest mb-1.5">{label}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black tabular-nums" style={{ color }}>{value}</span>
                  <span className="text-[10px] font-bold" style={{ color: color + '70' }}>{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
