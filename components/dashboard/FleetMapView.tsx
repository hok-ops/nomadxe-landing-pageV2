'use client';

import { ExternalLink, LocateFixed, MapPin } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import type { VRMData } from '@/lib/vrm';

type MapDevice = {
  siteId: string;
  name: string;
  displayName?: string | null;
};

type FleetMapPoint = {
  siteId: string;
  name: string;
  lat: number;
  lon: number;
  x: number;
  y: number;
  status: 'live' | 'stale' | 'low-battery';
  statusLabel: string;
  batteryLabel: string;
  ageLabel: string;
  mapUrl: string;
};

const STALE_SECONDS = 15 * 60;
const LOW_BATTERY_SOC = 80;

function isValidCoordinate(lat: number | null | undefined, lon: number | null | undefined) {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

function formatAge(lastSeen: number, nowS: number) {
  if (!lastSeen) return 'No report yet';
  const minutes = Math.max(0, Math.floor((nowS - lastSeen) / 60));
  if (minutes < 1) return 'Live now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function buildPoint(device: MapDevice, data: VRMData | null, nowS: number): Omit<FleetMapPoint, 'x' | 'y'> | null {
  if (!data || !isValidCoordinate(data.lat, data.lon)) return null;

  const ageSeconds = data.lastSeen ? Math.max(0, nowS - data.lastSeen) : Number.POSITIVE_INFINITY;
  const lowBattery = typeof data.battery.soc === 'number' && data.battery.soc < LOW_BATTERY_SOC;
  const status: FleetMapPoint['status'] = ageSeconds > STALE_SECONDS
    ? 'stale'
    : lowBattery
      ? 'low-battery'
      : 'live';

  return {
    siteId: device.siteId,
    name: device.displayName ?? device.name,
    lat: data.lat as number,
    lon: data.lon as number,
    status,
    statusLabel: status === 'live' ? 'Live' : status === 'low-battery' ? 'Battery watch' : 'Stale',
    batteryLabel: Number.isFinite(data.battery.soc) ? `${Math.round(data.battery.soc)}%` : 'SOC unknown',
    ageLabel: formatAge(data.lastSeen, nowS),
    mapUrl: `https://www.google.com/maps?q=${data.lat},${data.lon}`,
  };
}

function projectPoints(points: Array<Omit<FleetMapPoint, 'x' | 'y'>>): FleetMapPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0], x: 50, y: 50 }];

  const latValues = points.map((point) => point.lat);
  const lonValues = points.map((point) => point.lon);
  const minLat = Math.min(...latValues);
  const maxLat = Math.max(...latValues);
  const minLon = Math.min(...lonValues);
  const maxLon = Math.max(...lonValues);
  const latSpan = Math.max(maxLat - minLat, 0.01);
  const lonSpan = Math.max(maxLon - minLon, 0.01);

  return points.map((point) => ({
    ...point,
    x: 8 + ((point.lon - minLon) / lonSpan) * 84,
    y: 8 + (1 - ((point.lat - minLat) / latSpan)) * 84,
  }));
}

function statusClasses(status: FleetMapPoint['status'], isLight: boolean, selected: boolean) {
  if (selected) {
    return isLight
      ? 'border-blue-600 bg-blue-600 text-white shadow-[0_0_0_6px_rgba(37,99,235,0.14)]'
      : 'border-blue-300 bg-blue-400 text-slate-950 shadow-[0_0_0_6px_rgba(96,165,250,0.18)]';
  }
  if (status === 'stale') {
    return isLight
      ? 'border-rose-400 bg-rose-50 text-rose-700 shadow-[0_0_0_5px_rgba(244,63,94,0.12)]'
      : 'border-rose-400 bg-rose-500/20 text-rose-100 shadow-[0_0_0_5px_rgba(251,113,133,0.14)]';
  }
  if (status === 'low-battery') {
    return isLight
      ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-[0_0_0_5px_rgba(245,158,11,0.12)]'
      : 'border-amber-300 bg-amber-500/20 text-amber-100 shadow-[0_0_0_5px_rgba(251,191,36,0.14)]';
  }
  return isLight
    ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]'
    : 'border-emerald-300 bg-emerald-500/20 text-emerald-100 shadow-[0_0_0_5px_rgba(52,211,153,0.14)]';
}

export default function FleetMapView({
  devices,
  dataMap,
  selectedId,
  onSelect,
}: {
  devices: MapDevice[];
  dataMap: Record<string, VRMData | null>;
  selectedId: string | null;
  onSelect: (siteId: string) => void;
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const nowS = Date.now() / 1000;
  const rawPoints = devices
    .map((device) => buildPoint(device, dataMap[device.siteId] ?? null, nowS))
    .filter((point): point is Omit<FleetMapPoint, 'x' | 'y'> => Boolean(point))
    .sort((a, b) => a.name.localeCompare(b.name));
  const points = projectPoints(rawPoints);
  const selectedPoint = points.find((point) => point.siteId === selectedId) ?? null;
  const liveCount = points.filter((point) => point.status === 'live').length;
  const watchCount = points.filter((point) => point.status !== 'live').length;

  const shellClass = isLight
    ? 'mb-6 rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-[0_16px_44px_rgba(15,23,42,0.08)]'
    : 'mb-6 rounded-2xl border border-[#1e3a5f]/50 bg-[linear-gradient(180deg,rgba(8,12,20,0.78),rgba(10,16,30,0.92))] text-white';
  const mutedText = isLight ? 'text-slate-600' : 'text-[#bfdbfe]/68';
  const labelText = isLight ? 'text-slate-500' : 'text-[#93c5fd]/48';
  const mapPanelClass = isLight
    ? 'border-slate-200 bg-[linear-gradient(135deg,#f8fafc,#ffffff)]'
    : 'border-[#1e3a5f]/45 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.16),transparent_28%),linear-gradient(135deg,rgba(2,6,23,0.9),rgba(8,12,20,0.96))]';
  const listPanelClass = isLight
    ? 'border-slate-200 bg-slate-50'
    : 'border-[#1e3a5f]/45 bg-[#080c14]/58';

  return (
    <section className={shellClass} aria-label="Fleet map view">
      <div className="flex flex-col gap-4 border-b border-inherit px-4 py-4 sm:px-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <LocateFixed className={isLight ? 'h-4 w-4 text-blue-700' : 'h-4 w-4 text-[#60a5fa]'} />
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em]">Field Map</h2>
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${
              isLight ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-[#1e3a5f] bg-[#080c14]/70 text-[#bfdbfe]/78'
            }`}>
              {points.length}/{devices.length} located
            </span>
          </div>
          <p className={`mt-2 max-w-3xl text-[12px] leading-relaxed ${mutedText}`}>
            Spatial view uses the same VRM GPS already collected for the dashboard. Select one trailer at a time for polling safety, then open Maps only when a real-world handoff is needed.
          </p>
        </div>
        <div className="grid min-w-[220px] grid-cols-2 gap-2">
          <div className={`rounded-xl border px-3 py-2.5 ${listPanelClass}`}>
            <div className={`text-[9px] font-bold uppercase tracking-[0.22em] ${labelText}`}>Live Pins</div>
            <div className="mt-1 text-lg font-black tabular-nums text-emerald-400">{liveCount}</div>
          </div>
          <div className={`rounded-xl border px-3 py-2.5 ${listPanelClass}`}>
            <div className={`text-[9px] font-bold uppercase tracking-[0.22em] ${labelText}`}>Needs Check</div>
            <div className={`mt-1 text-lg font-black tabular-nums ${watchCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{watchCount}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className={`relative min-h-[280px] overflow-hidden rounded-xl border ${mapPanelClass}`}>
          {points.length === 0 ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <MapPin className={isLight ? 'mb-3 h-8 w-8 text-slate-400' : 'mb-3 h-8 w-8 text-[#93c5fd]/38'} />
              <div className="text-sm font-bold">No GPS positions available yet</div>
              <p className={`mt-2 max-w-sm text-xs leading-relaxed ${mutedText}`}>
                VRM must return latitude and longitude before a trailer can appear on the field map.
              </p>
            </div>
          ) : (
            <>
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <pattern id="fleet-map-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke={isLight ? '#cbd5e1' : '#1e3a5f'} strokeWidth="0.25" opacity="0.55" />
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#fleet-map-grid)" />
                {points.length > 1 && (
                  <polyline
                    points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                    fill="none"
                    stroke={isLight ? '#2563eb' : '#60a5fa'}
                    strokeWidth="0.45"
                    strokeDasharray="1.4 1.4"
                    opacity="0.42"
                  />
                )}
              </svg>
              {points.map((point) => {
                const selected = point.siteId === selectedId;
                return (
                  <button
                    key={point.siteId}
                    type="button"
                    onClick={() => onSelect(point.siteId)}
                    className={`absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-400 ${statusClasses(point.status, isLight, selected)}`}
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    aria-label={`Open ${point.name} on dashboard`}
                    title={`${point.name}: ${point.statusLabel}, ${point.ageLabel}`}
                  >
                    <MapPin className="h-4 w-4" />
                  </button>
                );
              })}
              <div className={`absolute bottom-3 left-3 rounded-lg border px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] ${
                isLight ? 'border-slate-200 bg-white/88 text-slate-600' : 'border-[#1e3a5f] bg-[#080c14]/82 text-[#bfdbfe]/62'
              }`}>
                {selectedPoint ? `Selected ${selectedPoint.name}` : 'Select a pin or list row'}
              </div>
            </>
          )}
        </div>

        <div className={`rounded-xl border ${listPanelClass}`}>
          <div className={`border-b border-inherit px-3 py-3 text-[10px] font-black uppercase tracking-[0.24em] ${labelText}`}>
            Located Units
          </div>
          <div className="max-h-[280px] overflow-y-auto p-2">
            {points.length === 0 ? (
              <div className={`px-3 py-6 text-center text-xs ${mutedText}`}>No located units to list.</div>
            ) : (
              points.map((point) => {
                const selected = point.siteId === selectedId;
                return (
                  <div
                    key={point.siteId}
                    className={`mb-2 rounded-lg border p-3 transition-colors ${
                      selected
                        ? isLight
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-blue-400/55 bg-blue-500/10'
                        : isLight
                          ? 'border-slate-200 bg-white'
                          : 'border-[#1e3a5f]/55 bg-[#080c14]/70'
                    }`}
                  >
                    <button type="button" onClick={() => onSelect(point.siteId)} className="block w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black">{point.name}</div>
                          <div className={`mt-1 text-[10px] ${mutedText}`}>{point.ageLabel} - {point.batteryLabel} battery</div>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] ${
                          point.status === 'live'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : point.status === 'low-battery'
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                              : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                        }`}>
                          {point.statusLabel}
                        </span>
                      </div>
                    </button>
                    <a
                      href={point.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
                        isLight ? 'text-blue-700 hover:text-blue-900' : 'text-[#93c5fd] hover:text-white'
                      }`}
                    >
                      Open in Maps
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
