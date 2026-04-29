'use client';

import { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import VRMDeepDivePanel from '@/components/dashboard/VRMDeepDivePanel';
import ManagedNetworkDevicesPanel from '@/components/dashboard/ManagedNetworkDevicesPanel';
import type { VRMData, VRMDetailData } from '@/lib/vrm';

// ── Weather ───────────────────────────────────────────────────────────────────

interface WeatherDay {
  date: string;       // "Mon", "Tue", etc.
  code: number;
  high: number;
  low: number;
  precip: number;     // precipitation probability 0-100
}
interface WeatherData {
  temp: number;
  feelsLike: number;
  code: number;
  wind: number;
  humidity: number;
  days: WeatherDay[];
  windyUrl: string;
}

const WEATHER_TTL_MS = 30 * 60_000; // 30 minutes — weather is slow-changing
interface WeatherCacheEntry { data: WeatherData; fetchedAt: number }
const weatherCache = new Map<string, WeatherCacheEntry>();

function wmoDescription(code: number): string {
  if (code === 0)              return 'Clear';
  if (code <= 2)               return 'Mostly Clear';
  if (code === 3)              return 'Overcast';
  if (code <= 48)              return 'Foggy';
  if (code <= 55)              return 'Drizzle';
  if (code <= 65)              return 'Rain';
  if (code <= 77)              return 'Snow';
  if (code <= 82)              return 'Showers';
  if (code <= 86)              return 'Snow Showers';
  return 'Thunderstorm';
}

function wmoEmoji(code: number): string {
  if (code === 0)              return '☀️';
  if (code <= 2)               return '🌤️';
  if (code === 3)              return '☁️';
  if (code <= 48)              return '🌫️';
  if (code <= 67)              return '🌧️';
  if (code <= 77)              return '❄️';
  if (code <= 82)              return '🌦️';
  if (code <= 86)              return '🌨️';
  return '⛈️';
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < WEATHER_TTL_MS) return cached.data;
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=5`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const c = json.current ?? {};
    const d = json.daily ?? {};
    const days: WeatherDay[] = (d.time ?? []).map((t: string, i: number) => ({
      date: new Date(t + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
      code: d.weather_code?.[i] ?? 0,
      high: Math.round(d.temperature_2m_max?.[i] ?? 0),
      low:  Math.round(d.temperature_2m_min?.[i] ?? 0),
      precip: d.precipitation_probability_max?.[i] ?? 0,
    }));
    const weather: WeatherData = {
      temp:      Math.round(c.temperature_2m ?? 0),
      feelsLike: Math.round(c.apparent_temperature ?? 0),
      code:      c.weather_code ?? 0,
      wind:      Math.round(c.wind_speed_10m ?? 0),
      humidity:  Math.round(c.relative_humidity_2m ?? 0),
      days,
      windyUrl: `https://www.windy.com/${lat.toFixed(4)}/${lon.toFixed(4)}?wind,${lat.toFixed(4)},${lon.toFixed(4)},10`,
    };
    weatherCache.set(key, { data: weather, fetchedAt: Date.now() });
    return weather;
  } catch {
    return null;
  }
}

// ── WeatherCard ───────────────────────────────────────────────────────────────

function WeatherCard({ weather, isLight }: { weather: WeatherData; isLight: boolean }) {
  const border  = isLight ? '#e2e8f0' : '#1e3a5f';
  const bg      = isLight ? '#f8fafc' : '#060b14';
  const dim     = isLight ? '#94a3b8' : '#93c5fd60';
  const textCol = isLight ? '#1e293b' : '#e2e8f0';

  return (
    <div className="mt-4 rounded-xl border overflow-hidden" style={{ borderColor: border, background: bg }}>
      {/* Current conditions */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-3xl leading-none select-none">{wmoEmoji(weather.code)}</span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black tabular-nums" style={{ color: textCol }}>{weather.temp}°</span>
              <span className="text-[11px] font-mono" style={{ color: dim }}>feels {weather.feelsLike}°</span>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: dim }}>
              {wmoDescription(weather.code)}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right flex-shrink-0">
          <span className="text-[10px] font-mono" style={{ color: dim }}>{weather.wind} mph wind</span>
          <span className="text-[10px] font-mono" style={{ color: dim }}>{weather.humidity}% humidity</span>
          <a
            href={weather.windyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] font-mono font-bold uppercase tracking-widest mt-1 hover:underline"
            style={{ color: '#3b82f6' }}
          >
            Full Forecast →
          </a>
        </div>
      </div>

      {/* 5-day strip */}
      <div className="grid grid-cols-5 border-t" style={{ borderColor: border }}>
        {weather.days.map((day, i) => (
          <div
            key={i}
            className="flex flex-col items-center py-2.5 gap-0.5 text-center"
            style={{ borderRight: i < 4 ? `1px solid ${border}` : undefined }}
          >
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest" style={{ color: dim }}>
              {i === 0 ? 'Today' : day.date}
            </span>
            <span className="text-lg leading-none select-none my-0.5">{wmoEmoji(day.code)}</span>
            <span className="text-[11px] font-black tabular-nums" style={{ color: textCol }}>{day.high}°</span>
            <span className="text-[10px] tabular-nums" style={{ color: dim }}>{day.low}°</span>
            {day.precip > 0 && (
              <span className="text-[9px] font-mono mt-0.5" style={{ color: '#60a5fa' }}>{day.precip}%💧</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type { VRMData } from '@/lib/vrm';

interface Props {
  device: { siteId: string; name: string; teltonikaRmsDeviceId?: string | null; routerAccessUrl?: string | null };
  initialData: VRMData | null;
  displayName?: string | null;
  onRename?: (siteId: string, newName: string) => Promise<void>;
  onData?: (siteId: string, data: VRMData) => void; // bubbles fresh data to parent for filter sync
}

// ── MPPT state → visual config ────────────────────────────────────────────────

const MPPT_STYLE: Record<number, { color: string; glow: string; border: string }> = {
  0:  { color: '#6b7280', glow: 'rgba(107,114,128,0.15)', border: '#374151' },
  2:  { color: '#ef4444', glow: 'rgba(239,68,68,0.20)',   border: '#991b1b' },
  3:  { color: '#f59e0b', glow: 'rgba(245,158,11,0.20)',  border: '#b45309' },
  4:  { color: '#f59e0b', glow: 'rgba(245,158,11,0.18)',  border: '#b45309' },
  5:  { color: '#22c55e', glow: 'rgba(34,197,94,0.18)',   border: '#15803d' },
  6:  { color: '#22c55e', glow: 'rgba(34,197,94,0.18)',   border: '#15803d' },
  7:  { color: '#3b82f6', glow: 'rgba(59,130,246,0.18)',  border: '#1d4ed8' },
};

function getMpptStyle(state: number) {
  return MPPT_STYLE[state] ?? MPPT_STYLE[0];
}

function getBatteryColor(soc: number, light = false) {
  if (soc >= 75) return light ? '#16a34a' : '#22c55e';
  if (soc >= 25) return light ? '#2563eb' : '#3b82f6';
  return               light ? '#dc2626' : '#ef4444';
}

// ── Sparkline (generic) ───────────────────────────────────────────────────────

interface SparklineProps {
  data: number[];
  color: string;
  label: string;
  unit: string;
  height?: number;
  /** Bumping this replays the draw-in animation (e.g. on device select). */
  pulseKey?: number;
}

function Sparkline({ data, color, label, unit, height = 36, pulseKey = 0 }: SparklineProps) {
  if (data.length < 2) {
    return (
      <div className="h-9 flex items-center">
        <span className="text-[10px] text-[#93c5fd]/20 font-mono uppercase tracking-widest">No trend data</span>
      </div>
    );
  }
  const W = 200, H = height;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = Math.max(max - min, 1);
  const step = W / (data.length - 1);
  const pts = data.map((v, i) => ({
    x: +(i * step).toFixed(1),
    y: +(H - ((v - min) / range) * (H - 4) - 2).toFixed(1),
  }));
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `M${pts[0].x},${H} ${pts.map(p => `L${p.x},${p.y}`).join(' ')} L${pts[pts.length - 1].x},${H} Z`;
  const uid = `${label}-${data.slice(0, 3).join('-')}`;
  const last = data[data.length - 1];

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] text-[#93c5fd]/60 font-mono uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-black font-mono tabular-nums" style={{ color }}>
          {typeof last === 'number' ? last.toFixed(label.includes('SOC') ? 0 : 1) : '\u2014'}{unit}
        </span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.42" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Area under curve — fades in alongside the stroke for depth */}
        <path
          key={`area-${pulseKey}`}
          d={area}
          fill={`url(#sg-${uid})`}
          style={{
            color,
            animation: `sparkArea 1.4s cubic-bezier(.22,1,.36,1) 0.1s both`,
            transformOrigin: 'bottom',
          }}
        />

        {/* Main stroke — draws in from left with a pulsing glow */}
        <polyline
          key={`line-${pulseKey}`}
          points={polyline} fill="none" stroke={color} strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round"
          style={{
            color,
            strokeDasharray: 2000,
            strokeDashoffset: 2000,
            animation: `sparkDraw 1.3s cubic-bezier(.22,1,.36,1) 0.1s forwards`,
          }}
        />

        {/* Expanding ring pulse on the latest point — triggers once on mount */}
        <circle
          key={`ring-${pulseKey}`}
          cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5"
          fill="none" stroke={color} strokeWidth="1.5"
          style={{
            transformOrigin: `${pts[pts.length - 1].x}px ${pts[pts.length - 1].y}px`,
            animation: `sparkDotRing 1.1s ease 1.0s both`,
          }}
        />

        {/* Quieter continuous ring — a subtle heartbeat while the view is open */}
        <circle
          key={`ringloop-${pulseKey}`}
          cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5"
          fill="none" stroke={color} strokeWidth="1"
          style={{
            transformOrigin: `${pts[pts.length - 1].x}px ${pts[pts.length - 1].y}px`,
            animation: `sparkDotRingLoop 2.6s ease-out 2.2s infinite`,
            opacity: 0,
          }}
        />

        {/* Solid end dot — pops in after the line finishes drawing */}
        <circle
          key={`dot-${pulseKey}`}
          cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill={color}
          style={{
            transformOrigin: `${pts[pts.length - 1].x}px ${pts[pts.length - 1].y}px`,
            animation: `sparkDot 900ms ease 1.0s both`,
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
        />
      </svg>
    </div>
  );
}

// ── Flow Arrow ────────────────────────────────────────────────────────────────

function FlowArrow({ active, color = '#3b82f6' }: { active: boolean; color?: string }) {
  const c = active ? color : '#1e3a5f';
  return (
    <>
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

function SocBar({ soc, light, animate, shimmerKey }: { soc: number; light: boolean; animate: boolean; shimmerKey: number }) {
  const color = getBatteryColor(soc, light);
  const pct   = Math.max(0, Math.min(100, soc));
  return (
    <div className="relative w-full h-1.5 bg-[#0a0f1e] rounded-full overflow-hidden border border-[#1e3a5f]/60">
      <style>{`
        @keyframes nx-soc-shimmer {
          0%   { transform: translateX(-40%); opacity: 0; }
          30%  { opacity: 1; }
          100% { transform: translateX(180%); opacity: 0; }
        }
        .nx-soc-shimmer { animation: nx-soc-shimmer 1100ms ease-out both; }
      `}</style>
      <div
        className="h-full rounded-full transition-all duration-1000"
        style={{ width: `${animate ? pct : 0}%`, backgroundColor: color, boxShadow: light ? 'none' : `0 0 6px ${color}` }}
      />
      {shimmerKey > 0 && (
        <span
          key={shimmerKey}
          aria-hidden="true"
          className="nx-soc-shimmer absolute top-0 left-0 h-full w-1/3 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${light ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)'}, transparent)`,
            mixBlendMode: 'screen',
          }}
        />
      )}
    </div>
  );
}

// ── Offline overlay ───────────────────────────────────────────────────────────

function OfflineOverlay({ staleSince, deviceName }: { staleSince: number; deviceName: string }) {
  const mins = Math.floor((Date.now() / 1000 - staleSince) / 60);
  return (
    <div className="absolute inset-0 z-20 rounded-2xl flex flex-col items-center justify-center gap-3"
      style={{ background: 'rgba(8,12,20,0.92)', backdropFilter: 'blur(3px)' }}>
      <style>{`
        @keyframes op{0%,100%{border-color:rgba(239,68,68,.55);box-shadow:0 0 0 0 rgba(239,68,68,0)}
        50%{border-color:rgba(75,85,99,.35);box-shadow:0 0 20px 3px rgba(239,68,68,.15)}}
        .op{animation:op 2.2s ease-in-out infinite}
      `}</style>
      <div className="absolute inset-0 rounded-2xl border-2 op" />
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
      <div className="text-center space-y-0.5 px-4">
        <div className="text-white font-black text-sm tracking-tight truncate max-w-xs">{deviceName}</div>
        <div className="text-red-400 font-black text-xs tracking-[0.35em] uppercase font-mono">Signal Lost</div>
        <div className="text-[#93c5fd]/45 text-[11px] font-mono mt-1">
          {mins < 60 ? `No data for ${mins}m` : `Offline ${Math.floor(mins / 60)}h ${mins % 60}m`}
          {mins >= 30 ? ' \u2014 check trailer' : ''}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-red-500/50 font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block" />
        Attempting reconnect\u2026
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

export default function NomadXECoreView({ device, initialData, displayName, onRename, onData }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [data, setData]         = useState<VRMData | null>(initialData);
  const [weather, setWeather]   = useState<WeatherData | null>(null);
  const [details, setDetails]   = useState<VRMDetailData | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [lastPoll, setLastPoll] = useState(new Date());
  const [, setTick]             = useState(0);
  const rootRef                 = useRef<HTMLDivElement>(null);

  // ── Animation ──────────────────────────────────────────────────────
  const [mounted, setMounted]       = useState(false);
  const [flashSolar, setFlashSolar] = useState(false);
  const [flashDc, setFlashDc]       = useState(false);
  const [flashSoc, setFlashSoc]     = useState(false);
  const [shimmerSoc, setShimmerSoc] = useState(0); // bumps to retrigger sweep
  const prevDataRef                 = useRef<VRMData | null>(null);
  const countedUpRef                = useRef(false);
  const tweenRafRef                 = useRef<number | null>(null);
  const [dispSolar, setDispSolar]   = useState(0);
  const [dispSoc,   setDispSoc]     = useState(0);
  const [dispDc,    setDispDc]      = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDetails = async () => {
      setDetailsLoading(true);
      try {
        const res = await fetch(`/api/vrm/${device.siteId}/details`, { cache: 'no-store' });
        if (res.status === 401) {
          window.location.href = '/login?error=Session+expired.+Please+sign+in+again.';
          return;
        }
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.data) setDetails(json.data);
      } catch {
        // Details are supplemental. Keep the core power view usable if this fails.
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    };

    loadDetails();
    return () => { cancelled = true; };
  }, [device.siteId]);

  // Fetch weather once per device open — re-fetches only if coordinates change.
  useEffect(() => {
    if (data?.lat == null || data?.lon == null) return;
    fetchWeather(data.lat, data.lon).then(result => { if (result) setWeather(result); });
  }, [data?.lat, data?.lon]);

  // Staggered GSAP entrance for the three power cards. Runs once per mount,
  // respects prefers-reduced-motion, and tolerates GSAP failing to load.
  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const prefersReduced = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    let ctx: { revert: () => void } | null = null;
    let cancelled = false;
    import('gsap').then(({ gsap }) => {
      if (cancelled || !rootRef.current) return;
      ctx = gsap.context(() => {
        gsap.fromTo(
          '[data-core-card]',
          { opacity: 0, y: 18, scale: 0.985 },
          { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', stagger: 0.12, delay: 0.12 }
        );
      }, rootRef);
    }).catch(() => { /* animation is decorative — ignore load failures */ });
    return () => { cancelled = true; ctx?.revert(); };
  }, []);

  // Tweened count-up — fires on first mount AND every poll.
  // Interpolates from whatever was on screen to the new target so polled
  // deltas glide rather than snap.
  useEffect(() => {
    if (!mounted || !data) return;
    const prefersReduced = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = { solar: data.solar.power, soc: data.battery.soc, dc: data.dcLoad };
    if (prefersReduced) {
      setDispSolar(targets.solar); setDispSoc(targets.soc); setDispDc(targets.dc);
      countedUpRef.current = true;
      return;
    }
    const fromSolar = countedUpRef.current ? dispSolar : 0;
    const fromSoc   = countedUpRef.current ? dispSoc   : 0;
    const fromDc    = countedUpRef.current ? dispDc    : 0;
    const duration  = countedUpRef.current ? 600 : 900;
    const start     = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    if (tweenRafRef.current) cancelAnimationFrame(tweenRafRef.current);
    const tick = (ts: number) => {
      const p = Math.min((ts - start) / duration, 1);
      const e = ease(p);
      setDispSolar(fromSolar + (targets.solar - fromSolar) * e);
      setDispSoc(  fromSoc   + (targets.soc   - fromSoc)   * e);
      setDispDc(   fromDc    + (targets.dc    - fromDc)    * e);
      if (p < 1) tweenRafRef.current = requestAnimationFrame(tick);
      else {
        setDispSolar(targets.solar); setDispSoc(targets.soc); setDispDc(targets.dc);
        countedUpRef.current = true;
      }
    };
    tweenRafRef.current = requestAnimationFrame(tick);
    return () => { if (tweenRafRef.current) cancelAnimationFrame(tweenRafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, data]);

  useEffect(() => {
    if (!prevDataRef.current || !data) { prevDataRef.current = data; return; }
    const prev = prevDataRef.current;
    const flash = (set: (v: boolean) => void) => { set(true); setTimeout(() => set(false), 650); };
    if (data.solar.power !== prev.solar.power) flash(setFlashSolar);
    if (data.dcLoad      !== prev.dcLoad)      flash(setFlashDc);
    if (data.battery.soc !== prev.battery.soc) {
      flash(setFlashSoc);
      setShimmerSoc(v => v + 1); // trigger shimmer sweep
    }
    prevDataRef.current = data;
  }, [data]);

  const [editing, setEditing]     = useState(false);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving]       = useState(false);
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

  // Parent (DashboardClient) handles polling and pushes fresh data via `initialData`.
  // Compare by lastSeen timestamp rather than object reference — the parent spreads
  // a new object on every poll regardless of whether the values changed, so a
  // reference comparison would fire on every parent re-render (stale closure risk).
  // Location is resolved separately from VRM telemetry, so allow that field to
  // refresh even when the upstream lastSeen timestamp is unchanged.
  useEffect(() => {
    if (
      initialData &&
      (
        initialData.lastSeen !== data?.lastSeen ||
        initialData.location !== data?.location
      )
    ) {
      setData(initialData);
      setLastPoll(new Date());
      onData?.(device.siteId, initialData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.lastSeen, initialData?.location]);

  // 10s is sufficient — staleness text shows "Xm ago" for most real-world data ages.
  // Reduces from 1 re-render/sec per open device card to 1 per 10s.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
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
    : '\u2014';

  const activeDisplayName = displayName ?? device.name;
  const vrmUrl = `https://vrm.victronenergy.com/installation/${device.siteId}/dashboard`;
  const modemAccessUrl = device.routerAccessUrl ?? null;

  return (
    <div
      ref={rootRef}
      className="relative bg-[#0d1526] border border-[#1e3a5f] rounded-2xl overflow-hidden shadow-[0_20px_56px_rgba(0,0,0,0.55)]"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(18px)',
        transition: 'opacity 0.5s cubic-bezier(.22,1,.36,1), transform 0.5s cubic-bezier(.22,1,.36,1)',
      }}
    >


      {isOffline && <OfflineOverlay staleSince={lastSeenS} deviceName={activeDisplayName} />}

      <div className="h-px bg-gradient-to-r from-transparent via-[#3b82f6]/20 to-transparent" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 sm:px-6 py-4 border-b border-[#1e3a5f]/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`flex-shrink-0 w-2 h-2 rounded-full ${isOffline ? 'bg-red-500' : lastSeenS === 0 ? 'bg-gray-600' : 'bg-emerald-400 animate-pulse'}`}
            style={(!isOffline && lastSeenS > 0) ? { boxShadow: '0 0 7px #4ade80' } : {}}
          />

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
              <span className="text-white font-bold text-sm truncate">{activeDisplayName}</span>
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
            {data?.location ?? `Site ${device.siteId}`}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {modemAccessUrl && (
            <a
              href={modemAccessUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open router WebUI"
              className="flex items-center gap-1.5 text-[10px] font-mono text-[#22c55e]/75 hover:text-white uppercase tracking-widest transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 11a8 8 0 0 1 16 0" />
                <path d="M12 19v-8" />
                <path d="M8.5 15.5 12 19l3.5-3.5" />
              </svg>
              Modem
            </a>
          )}
          <a
            href={vrmUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Victron VRM Portal"
            className="flex items-center gap-1.5 text-[10px] font-mono text-[#93c5fd]/40 hover:text-[#3b82f6] uppercase tracking-widest transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            VRM
          </a>

          <div className="text-[10px] font-mono text-[#93c5fd]/60 uppercase tracking-widest">
            {isOffline
              ? <span className="text-red-400 font-bold">Offline &middot; VRM {syncAgo}</span>
              : <>
                  <span title={`VRM device last reported ${syncAgo}`}>
                    Synced {lastPoll.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="text-[#93c5fd]/35 ml-3" title="When Victron device last sent telemetry to VRM">
                    VRM {syncAgo}
                  </span>
                </>
            }
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-3 lg:gap-0">

          {/* Solar Card */}
          <div data-core-card="solar" className="group/core flex-1 min-w-0 bg-[#080c14] border border-[#1e3a5f]/50 rounded-xl p-5 transition-all duration-300 hover:border-[#22c55e]/40 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(34,197,94,0.35)]">
            <div className="flex items-center gap-2 mb-4">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
                <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
                <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
              </svg>
              <span className="text-[10px] font-bold text-[#22c55e]/85 uppercase tracking-[0.3em] font-mono">Solar</span>
            </div>
            <div className="mb-0.5">
              <span className={`text-4xl font-black tabular-nums leading-none${flashSolar ? ' nx-flash' : ''}`}
                style={{ color: solarActive ? (isLight ? '#16a34a' : '#22c55e') : (isLight ? '#94a3b8' : '#374151') }}>
                {+dispSolar.toFixed(2)}
              </span>
              <span className="text-sm font-bold text-[#22c55e]/70 ml-1">W</span>
            </div>
            <div className="flex gap-3 mt-2 mb-1 text-[11px] font-mono">
              <span className="text-[#93c5fd]/65">{(data?.solar.voltage ?? 0).toFixed(1)} V</span>
            </div>
            <div className="text-[10px] font-mono text-[#22c55e]/70 uppercase tracking-widest mt-2 mb-3">
              Today: {(data?.solar.yieldToday ?? 0).toFixed(2)} kWh
            </div>
            <Sparkline data={data?.sparkline ?? []} color="#22c55e" label="6h Solar Harvest" unit="W" />
          </div>

          <FlowArrow active={solarActive} color="#22c55e" />

          {/* Battery Hub */}
          <div
            data-core-card="battery"
            className="group/core flex-[1.15] min-w-0 bg-[#080c14] rounded-xl p-5 flex flex-col transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(59,130,246,0.35)]"
            style={{ border: `1px solid ${charging ? '#22c55e30' : discharging ? '#3b82f630' : '#1e3a5f80'}` }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={batColor} strokeWidth="1.8">
                  <rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] font-mono" style={{ color: batColor + 'cc' }}>
                  Battery
                </span>
              </div>
              {data && (
                <span className="text-[10px] font-black font-mono uppercase tracking-wider px-2.5 py-1 rounded-md"
                  style={{ color: mppt.color, background: mppt.glow, border: `1px solid ${mppt.border}40` }}>
                  {data.solar.mpptStateLabel}
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1 mb-3">
              <span className={`text-5xl font-black tabular-nums text-white leading-none${flashSoc ? ' nx-flash' : ''}`}>{Math.round(dispSoc)}</span>
              <span className="text-xl font-bold text-[#93c5fd]/65">%</span>
            </div>

            <SocBar soc={soc} light={isLight} animate={mounted} shimmerKey={shimmerSoc} />

            <div className="mt-2 mb-4 text-[10px] font-mono uppercase tracking-widest" style={{
              color: charging
                ? (isLight ? '#16a34a' : '#22c55ecc')
                : discharging
                  ? (isLight ? '#d97706' : '#f59e0bcc')
                  : (isLight ? '#64748b'  : '#93c5fd80'),
            }}>
              {charging ? '\u2191 Charging' : discharging ? '\u2193 On Battery' : 'Standby'}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <StatPill label="Voltage" unit="V"
                value={(data?.battery.voltage ?? 0).toFixed(2)}
                color={isLight ? '#2563eb' : '#93c5fd'} />
              <StatPill label="Current" unit="A"
                value={`${(data?.battery.current ?? 0) >= 0 ? '+' : ''}${(data?.battery.current ?? 0).toFixed(1)}`}
                color={charging ? (isLight ? '#16a34a' : '#22c55e') : discharging ? (isLight ? '#d97706' : '#f59e0b') : (isLight ? '#2563eb' : '#93c5fd')} />
              <StatPill label="Power" unit="W"
                value={(Math.abs(data?.battery.power ?? 0)).toFixed(2)}
                color={isLight ? '#2563eb' : '#93c5fd'} />
            </div>

            {(data?.batterySparkline?.length ?? 0) >= 2 && (
              <div className="mt-4 pt-4 border-t border-[#1e3a5f]/40">
                <Sparkline data={data!.batterySparkline!} color={batColor} label="6h SOC Trend" unit="%" />
              </div>
            )}
          </div>

          <FlowArrow active={loadActive} color="#f59e0b" />

          {/* DC Loads Card */}
          <div data-core-card="dc" className="group/core flex-1 min-w-0 bg-[#080c14] border border-[#1e3a5f]/50 rounded-xl p-5 flex flex-col transition-all duration-300 hover:border-[#f59e0b]/40 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(245,158,11,0.35)]">
            <div className="flex items-center gap-2 mb-4">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
              </svg>
              <span className="text-[10px] font-bold text-[#f59e0b]/85 uppercase tracking-[0.3em] font-mono">DC Loads</span>
            </div>
            <div className="mb-0.5">
              <span className={`text-4xl font-black tabular-nums leading-none${flashDc ? ' nx-flash' : ''}`}
                style={{ color: loadActive ? (isLight ? '#d97706' : '#f59e0b') : (isLight ? '#94a3b8' : '#374151') }}>
                {+dispDc.toFixed(2)}
              </span>
              <span className="text-sm font-bold text-[#f59e0b]/70 ml-1">W</span>
            </div>
            <div className="text-[10px] font-mono text-[#93c5fd]/65 mt-2 uppercase tracking-widest">
              DC System Load
            </div>

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
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: surplus ? '100%' : `${pct}%`, backgroundColor: surplus ? '#22c55e' : '#f59e0b' }} />
                    </div>
                    <span className="text-[11px] font-black tabular-nums"
                      style={{ color: surplus ? '#22c55e' : '#f59e0b' }}>
                      {surplus ? `+${+(sW - lW).toFixed(2)}W` : `${pct}%`}
                    </span>
                  </div>
                  <div className="text-[9px] font-mono mt-1"
                    style={{ color: surplus ? 'rgba(34,197,94,0.7)' : 'rgba(245,158,11,0.7)' }}>
                    {surplus ? `${pct}% of load \u2014 excess charging battery` : 'battery supplementing load'}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <ManagedNetworkDevicesPanel siteId={device.siteId} />

        {weather && <WeatherCard weather={weather} isLight={isLight} />}

        <VRMDeepDivePanel siteId={device.siteId} data={data} details={details} loading={detailsLoading} />
      </div>
    </div>
  );
}
