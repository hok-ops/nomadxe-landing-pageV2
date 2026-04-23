'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import type { VRMData } from './NomadXECoreView';
import { useTheme } from '@/components/ThemeProvider';

interface Props {
  devices: { siteId: string }[];
  dataMap: Record<string, VRMData | null>;
}

/** Tweened number that glides between values instead of snapping. */
function useTweenedNumber(target: number, duration = 650) {
  const [value, setValue] = useState(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReduced = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { setValue(target); return; }

    const from = value;
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = (ts: number) => {
      const p = Math.min((ts - start) / duration, 1);
      setValue(from + (target - from) * ease(p));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

function Metric({
  label, value, unit, color, lightColor, accent, lightAccent, isLight,
}: {
  label: string; value: string; unit?: string;
  color: string; lightColor?: string;
  accent?: string; lightAccent?: string;
  isLight: boolean;
}) {
  const valueColor  = isLight ? (lightColor ?? color) : color;
  const accentColor = accent ? (isLight ? (lightAccent ?? accent) : accent) : undefined;
  return (
    <div
      className={`flex-1 min-w-[120px] px-4 py-3 border-l first:border-l-0 relative ${
        isLight ? 'border-slate-300/60' : 'border-[#1e3a5f]/40'
      }`}
    >
      {accentColor && (
        <div
          className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full"
          style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}${isLight ? '40' : '60'}` }}
        />
      )}
      <div
        className={`text-[9px] font-mono font-bold uppercase tracking-[0.3em] mb-1 ${
          isLight ? 'text-slate-600' : 'text-[#93c5fd]/50'
        }`}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg sm:text-xl font-black tabular-nums font-mono" style={{ color: valueColor }}>
          {value}
        </span>
        {unit && (
          <span className="text-[10px] font-bold font-mono" style={{ color: valueColor + (isLight ? 'cc' : '99') }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export default function FleetSummary({ devices, dataMap }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Tick every 5s so "online" status stays current even without new polls.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const nowS = Date.now() / 1000;
    let online = 0;
    let offline = 0;
    let noData = 0;
    let socSum = 0;
    let solarSum = 0;
    let dcSum = 0;
    let yieldSum = 0;
    let charging = 0;
    devices.forEach(d => {
      const data = dataMap[d.siteId];
      if (!data || data.lastSeen === 0) { noData++; return; }
      const isOffline = (nowS - data.lastSeen) > 15 * 60;
      if (isOffline) { offline++; return; }
      online++;
      socSum   += data.battery.soc;
      solarSum += data.solar.power;
      dcSum    += data.dcLoad;
      yieldSum += data.solar.yieldToday;
      if (data.battery.state === 1) charging++;
    });
    // Per-unit averages are the actionable view for fleet ops — a raw
    // fleet-total wattage blends great trailers with struggling ones and
    // hides problems. Yield Today stays a total because cumulative energy
    // harvested today IS a meaningful fleet-level number.
    const avgSoc    = online > 0 ? socSum   / online : 0;
    const avgSolar  = online > 0 ? solarSum / online : 0;
    const avgLoad   = online > 0 ? dcSum    / online : 0;
    const healthPct = devices.length > 0 ? Math.round((online / devices.length) * 100) : 0;
    return { online, offline, noData, avgSoc, avgSolar, avgLoad, yieldSum, charging, healthPct };
  }, [devices, dataMap]);

  const animatedSoc    = useTweenedNumber(stats.avgSoc);
  const animatedSolar  = useTweenedNumber(stats.avgSolar);
  const animatedDc     = useTweenedNumber(stats.avgLoad);
  const animatedYield  = useTweenedNumber(stats.yieldSum);

  const healthColor = isLight
    ? (stats.healthPct >= 90 ? '#16a34a' : stats.healthPct >= 50 ? '#2563eb' : '#d97706')
    : (stats.healthPct >= 90 ? '#22c55e' : stats.healthPct >= 50 ? '#3b82f6' : '#f59e0b');

  // Light-mode palette — sits on a soft white panel with slate borders and
  // darkened metric colors so every label passes contrast.
  const chargingColor = isLight ? '#16a34a' : '#22c55e';
  const loadColor     = isLight ? '#d97706' : '#f59e0b';
  const socColor      = isLight
    ? (animatedSoc >= 75 ? '#16a34a' : animatedSoc >= 25 ? '#2563eb' : '#dc2626')
    : (animatedSoc >= 75 ? '#22c55e' : animatedSoc >= 25 ? '#93c5fd' : '#ef4444');

  return (
    <div
      className={`mb-6 rounded-2xl overflow-hidden backdrop-blur-sm border ${
        isLight
          ? 'bg-white/85 border-slate-200 shadow-sm'
          : 'bg-[#080c14]/70 border-[#1e3a5f]/50'
      }`}
    >
      <div className="flex flex-wrap items-stretch">
        {/* Fleet health */}
        <div className="flex-1 min-w-[160px] px-4 py-3 relative">
          <div
            className={`text-[9px] font-mono font-bold uppercase tracking-[0.3em] mb-1 ${
              isLight ? 'text-slate-600' : 'text-[#93c5fd]/50'
            }`}
          >
            Fleet Health
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-xl sm:text-2xl font-black tabular-nums font-mono ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            >
              {stats.online}
              <span className={`text-sm ${isLight ? 'text-slate-400' : 'text-[#93c5fd]/40'}`}>
                /{devices.length}
              </span>
            </span>
            <span
              className="text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{
                color: healthColor,
                background: healthColor + (isLight ? '14' : '1a'),
                border: `1px solid ${healthColor}${isLight ? '40' : '33'}`,
              }}
            >
              {stats.healthPct}%
            </span>
          </div>
          <div
            className={`mt-2 h-1 rounded-full overflow-hidden border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0a0f1e] border-[#1e3a5f]/40'
            }`}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${stats.healthPct}%`,
                background: `linear-gradient(to right, ${healthColor}, ${healthColor}cc)`,
                boxShadow: isLight ? 'none' : `0 0 6px ${healthColor}70`,
              }}
            />
          </div>
          <div
            className={`mt-1.5 text-[9px] font-mono flex gap-2 ${
              isLight ? 'text-slate-500' : 'text-[#93c5fd]/40'
            }`}
          >
            <span>
              <span className={isLight ? 'text-emerald-700' : 'text-emerald-400'}>{stats.online}</span> live
            </span>
            {stats.offline > 0 && (
              <span>
                <span className={isLight ? 'text-red-700' : 'text-red-400'}>{stats.offline}</span> offline
              </span>
            )}
            {stats.noData > 0 && (
              <span>
                <span className={isLight ? 'text-slate-500' : 'text-[#6b7280]'}>{stats.noData}</span> no data
              </span>
            )}
          </div>
        </div>

        <Metric
          label="Avg SOC"
          value={animatedSoc.toFixed(0)}
          unit="%"
          color={socColor}
          accent={isLight ? '#2563eb' : '#3b82f6'}
          isLight={isLight}
        />
        <Metric
          label="Avg Solar"
          value={animatedSolar.toFixed(0)}
          unit="W"
          color={isLight ? '#16a34a' : '#22c55e'}
          accent={isLight ? '#16a34a' : '#22c55e'}
          isLight={isLight}
        />
        <Metric
          label="Avg Load"
          value={animatedDc.toFixed(0)}
          unit="W"
          color={loadColor}
          accent={loadColor}
          isLight={isLight}
        />
        <Metric
          label="Yield Today"
          value={animatedYield.toFixed(2)}
          unit="kWh"
          color={isLight ? '#2563eb' : '#93c5fd'}
          accent={isLight ? '#2563eb' : '#93c5fd'}
          isLight={isLight}
        />
        <div
          className={`flex-1 min-w-[120px] px-4 py-3 border-l ${
            isLight ? 'border-slate-300/60' : 'border-[#1e3a5f]/40'
          }`}
        >
          <div
            className={`text-[9px] font-mono font-bold uppercase tracking-[0.3em] mb-1 ${
              isLight ? 'text-slate-600' : 'text-[#93c5fd]/50'
            }`}
          >
            Charging
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className="text-lg sm:text-xl font-black tabular-nums font-mono"
              style={{ color: chargingColor }}
            >
              {stats.charging}
            </span>
            <span
              className="text-[10px] font-bold font-mono"
              style={{ color: chargingColor + (isLight ? 'cc' : '99') }}
            >
              of {stats.online}
            </span>
          </div>
          {stats.charging > 0 && (
            <div
              className={`mt-1.5 flex items-center gap-1 text-[9px] font-mono ${
                isLight ? 'text-emerald-700/80' : 'text-emerald-400/60'
              }`}
            >
              <span className="relative inline-flex w-1.5 h-1.5">
                <span
                  className={`absolute inline-block w-1.5 h-1.5 rounded-full animate-pulseRing ${
                    isLight ? 'bg-emerald-600' : 'bg-emerald-400'
                  }`}
                />
                <span
                  className={`relative inline-block w-1.5 h-1.5 rounded-full ${
                    isLight ? 'bg-emerald-600' : 'bg-emerald-400'
                  }`}
                />
              </span>
              Actively harvesting
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
