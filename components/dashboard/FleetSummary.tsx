'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import type { VRMData } from './NomadXECoreView';

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
  label, value, unit, color = '#93c5fd', accent,
}: { label: string; value: string; unit?: string; color?: string; accent?: string }) {
  return (
    <div
      className="flex-1 min-w-[120px] px-4 py-3 border-l border-[#1e3a5f]/40 first:border-l-0 relative"
    >
      {accent && (
        <div
          className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full"
          style={{ background: accent, boxShadow: `0 0 6px ${accent}60` }}
        />
      )}
      <div className="text-[9px] font-mono font-bold text-[#93c5fd]/50 uppercase tracking-[0.3em] mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg sm:text-xl font-black tabular-nums font-mono" style={{ color }}>
          {value}
        </span>
        {unit && (
          <span className="text-[10px] font-bold font-mono" style={{ color: color + '99' }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export default function FleetSummary({ devices, dataMap }: Props) {
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

  const healthColor = stats.healthPct >= 90 ? '#22c55e' : stats.healthPct >= 50 ? '#3b82f6' : '#f59e0b';

  return (
    <div className="mb-6 rounded-2xl bg-[#080c14]/70 border border-[#1e3a5f]/50 backdrop-blur-sm overflow-hidden">
      <div className="flex flex-wrap items-stretch">
        {/* Fleet health */}
        <div className="flex-1 min-w-[160px] px-4 py-3 relative">
          <div className="text-[9px] font-mono font-bold text-[#93c5fd]/50 uppercase tracking-[0.3em] mb-1">
            Fleet Health
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black tabular-nums font-mono text-white">
              {stats.online}<span className="text-sm text-[#93c5fd]/40">/{devices.length}</span>
            </span>
            <span
              className="text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{ color: healthColor, background: healthColor + '1a', border: `1px solid ${healthColor}33` }}
            >
              {stats.healthPct}%
            </span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-[#0a0f1e] overflow-hidden border border-[#1e3a5f]/40">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${stats.healthPct}%`,
                background: `linear-gradient(to right, ${healthColor}, ${healthColor}cc)`,
                boxShadow: `0 0 6px ${healthColor}70`,
              }}
            />
          </div>
          <div className="mt-1.5 text-[9px] font-mono text-[#93c5fd]/40 flex gap-2">
            <span><span className="text-emerald-400">{stats.online}</span> live</span>
            {stats.offline > 0 && <span><span className="text-red-400">{stats.offline}</span> offline</span>}
            {stats.noData > 0 && <span><span className="text-[#6b7280]">{stats.noData}</span> no data</span>}
          </div>
        </div>

        <Metric
          label="Avg SOC"
          value={animatedSoc.toFixed(0)}
          unit="%"
          color={animatedSoc >= 75 ? '#22c55e' : animatedSoc >= 25 ? '#93c5fd' : '#ef4444'}
          accent="#3b82f6"
        />
        <Metric
          label="Avg Solar"
          value={animatedSolar.toFixed(0)}
          unit="W"
          color="#22c55e"
          accent="#22c55e"
        />
        <Metric
          label="Avg Load"
          value={animatedDc.toFixed(0)}
          unit="W"
          color="#f59e0b"
          accent="#f59e0b"
        />
        <Metric
          label="Yield Today"
          value={animatedYield.toFixed(2)}
          unit="kWh"
          color="#93c5fd"
          accent="#93c5fd"
        />
        <div className="flex-1 min-w-[120px] px-4 py-3 border-l border-[#1e3a5f]/40">
          <div className="text-[9px] font-mono font-bold text-[#93c5fd]/50 uppercase tracking-[0.3em] mb-1">
            Charging
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black tabular-nums font-mono text-[#22c55e]">
              {stats.charging}
            </span>
            <span className="text-[10px] font-bold font-mono text-[#22c55e99]">
              of {stats.online}
            </span>
          </div>
          {stats.charging > 0 && (
            <div className="mt-1.5 flex items-center gap-1 text-[9px] font-mono text-emerald-400/60">
              <span className="relative inline-flex w-1.5 h-1.5">
                <span className="absolute inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulseRing" />
                <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </span>
              Actively harvesting
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
