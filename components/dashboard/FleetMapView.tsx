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
  location: string | null;
  lat: number;
  lon: number;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  clusterSize: number;
  status: 'live' | 'stale' | 'low-battery';
  statusLabel: string;
  batteryLabel: string;
  ageLabel: string;
  mapUrl: string;
};

type MapTile = {
  key: string;
  src: string;
  leftPct: number;
  topPct: number;
  sizePctX: number;
  sizePctY: number;
};

const STALE_SECONDS = 15 * 60;
const LOW_BATTERY_SOC = 80;
const TILE_SIZE = 256;
const MAP_WIDTH = 1024;
const MAP_HEIGHT = 520;
const MIN_ZOOM = 3;
const MAX_ZOOM = 11;
const PIN_CLUSTER_DISTANCE_PCT = 4.2;

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

function lonToWorldX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

function latToWorldY(lat: number, zoom: number) {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  return (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * TILE_SIZE * 2 ** zoom;
}

function chooseZoom(points: Array<Pick<FleetMapPoint, 'lat' | 'lon'>>) {
  if (points.length <= 1) return 10;
  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
    const xs = points.map((point) => lonToWorldX(point.lon, zoom));
    const ys = points.map((point) => latToWorldY(point.lat, zoom));
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    if (width <= MAP_WIDTH * 0.72 && height <= MAP_HEIGHT * 0.68) return zoom;
  }
  return MIN_ZOOM;
}

function spreadClusteredPins(points: FleetMapPoint[]) {
  const clustered = points.map((point) => ({ ...point }));
  const visited = new Set<string>();

  for (const seed of clustered) {
    if (visited.has(seed.siteId)) continue;

    const cluster = clustered.filter((candidate) => {
      if (visited.has(candidate.siteId)) return false;
      const dx = candidate.anchorX - seed.anchorX;
      const dy = candidate.anchorY - seed.anchorY;
      return Math.sqrt(dx * dx + dy * dy) <= PIN_CLUSTER_DISTANCE_PCT;
    });

    cluster.forEach((point) => visited.add(point.siteId));
    if (cluster.length <= 1) continue;

    const centerX = cluster.reduce((sum, point) => sum + point.anchorX, 0) / cluster.length;
    const centerY = cluster.reduce((sum, point) => sum + point.anchorY, 0) / cluster.length;
    const radius = Math.min(8, 2.7 + cluster.length * 0.72);

    cluster
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((point, index) => {
        const angle = -Math.PI / 2 + (index / cluster.length) * Math.PI * 2;
        point.clusterSize = cluster.length;
        point.x = Math.max(4, Math.min(96, centerX + Math.cos(angle) * radius));
        point.y = Math.max(6, Math.min(94, centerY + Math.sin(angle) * radius));
      });
  }

  return clustered;
}

function buildMapGeometry(rawPoints: Array<Omit<FleetMapPoint, 'x' | 'y' | 'anchorX' | 'anchorY' | 'clusterSize'>>) {
  if (rawPoints.length === 0) return { points: [] as FleetMapPoint[], tiles: [] as MapTile[], zoom: 0 };

  const zoom = chooseZoom(rawPoints);
  const xs = rawPoints.map((point) => lonToWorldX(point.lon, zoom));
  const ys = rawPoints.map((point) => latToWorldY(point.lat, zoom));
  const centerX = rawPoints.length === 1 ? xs[0] : (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = rawPoints.length === 1 ? ys[0] : (Math.min(...ys) + Math.max(...ys)) / 2;
  const tileMinX = Math.floor((centerX - MAP_WIDTH / 2) / TILE_SIZE);
  const tileMaxX = Math.floor((centerX + MAP_WIDTH / 2) / TILE_SIZE);
  const tileMinY = Math.max(0, Math.floor((centerY - MAP_HEIGHT / 2) / TILE_SIZE));
  const tileMaxY = Math.min(2 ** zoom - 1, Math.floor((centerY + MAP_HEIGHT / 2) / TILE_SIZE));
  const tiles: MapTile[] = [];

  for (let tileX = tileMinX; tileX <= tileMaxX; tileX += 1) {
    const wrappedX = ((tileX % 2 ** zoom) + 2 ** zoom) % 2 ** zoom;
    for (let tileY = tileMinY; tileY <= tileMaxY; tileY += 1) {
      tiles.push({
        key: `${zoom}-${tileX}-${tileY}`,
        src: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
        leftPct: ((tileX * TILE_SIZE - (centerX - MAP_WIDTH / 2)) / MAP_WIDTH) * 100,
        topPct: ((tileY * TILE_SIZE - (centerY - MAP_HEIGHT / 2)) / MAP_HEIGHT) * 100,
        sizePctX: (TILE_SIZE / MAP_WIDTH) * 100,
        sizePctY: (TILE_SIZE / MAP_HEIGHT) * 100,
      });
    }
  }

  const projectedPoints = rawPoints.map((point) => {
    const x = ((lonToWorldX(point.lon, zoom) - (centerX - MAP_WIDTH / 2)) / MAP_WIDTH) * 100;
    const y = ((latToWorldY(point.lat, zoom) - (centerY - MAP_HEIGHT / 2)) / MAP_HEIGHT) * 100;
    const safeX = Math.max(4, Math.min(96, x));
    const safeY = Math.max(6, Math.min(94, y));
    return {
      ...point,
      x: safeX,
      y: safeY,
      anchorX: safeX,
      anchorY: safeY,
      clusterSize: 1,
    };
  });

  const points = spreadClusteredPins(projectedPoints);

  return { points, tiles, zoom };
}

function stateFromPoint(point: Pick<FleetMapPoint, 'location' | 'lat' | 'lon'>) {
  const stateMatch = point.location?.match(/,\s*([A-Z]{2})(?:\s|$)/);
  if (stateMatch) return stateMatch[1];
  if (point.lat >= 31 && point.lat <= 37.2 && point.lon >= -114.2 && point.lon <= -109) return 'UT';
  if (point.lat >= 25.5 && point.lat <= 36.8 && point.lon >= -106.8 && point.lon <= -93.4) return 'TX';
  if (point.lat >= 37 && point.lat <= 41.1 && point.lon >= -109.1 && point.lon <= -102) return 'CO';
  if (point.lat >= 35 && point.lat <= 37.1 && point.lon >= -103.1 && point.lon <= -94.4) return 'OK';
  return 'GPS';
}

function buildPoint(
  device: MapDevice,
  data: VRMData | null,
  nowS: number
): Omit<FleetMapPoint, 'x' | 'y' | 'anchorX' | 'anchorY' | 'clusterSize'> | null {
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
    location: data.location,
    lat: data.lat as number,
    lon: data.lon as number,
    status,
    statusLabel: status === 'live' ? 'Live' : status === 'low-battery' ? 'Battery watch' : 'Stale',
    batteryLabel: Number.isFinite(data.battery.soc) ? `${Math.round(data.battery.soc)}%` : 'SOC unknown',
    ageLabel: formatAge(data.lastSeen, nowS),
    mapUrl: `https://www.google.com/maps?q=${data.lat},${data.lon}`,
  };
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
    .filter((point): point is Omit<FleetMapPoint, 'x' | 'y' | 'anchorX' | 'anchorY' | 'clusterSize'> => Boolean(point))
    .sort((a, b) => a.name.localeCompare(b.name));
  const { points, tiles, zoom } = buildMapGeometry(rawPoints);
  const selectedPoint = points.find((point) => point.siteId === selectedId) ?? null;
  const liveCount = points.filter((point) => point.status === 'live').length;
  const watchCount = points.filter((point) => point.status !== 'live').length;
  const regionCounts = points.reduce<Record<string, number>>((acc, point) => {
    const label = stateFromPoint(point);
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  const shellClass = isLight
    ? 'mb-6 rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-[0_16px_44px_rgba(15,23,42,0.08)]'
    : 'mb-6 rounded-2xl border border-[#1e3a5f]/50 bg-[linear-gradient(180deg,rgba(8,12,20,0.78),rgba(10,16,30,0.92))] text-white';
  const mutedText = isLight ? 'text-slate-600' : 'text-[#bfdbfe]/68';
  const labelText = isLight ? 'text-slate-500' : 'text-[#93c5fd]/48';
  const mapPanelClass = isLight
    ? 'border-slate-200 bg-slate-100'
    : 'border-[#1e3a5f]/45 bg-[#07111f]';
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
          {points.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(regionCounts).map(([region, count]) => (
                <span key={region} className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${
                  isLight ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-[#1e3a5f]/65 bg-[#080c14]/70 text-[#bfdbfe]/68'
                }`}>
                  {region} {count}
                </span>
              ))}
            </div>
          )}
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
        <div className={`relative min-h-[320px] overflow-hidden rounded-xl border ${mapPanelClass}`}>
          {points.length === 0 ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <MapPin className={isLight ? 'mb-3 h-8 w-8 text-slate-400' : 'mb-3 h-8 w-8 text-[#93c5fd]/38'} />
              <div className="text-sm font-bold">No GPS positions available yet</div>
              <p className={`mt-2 max-w-sm text-xs leading-relaxed ${mutedText}`}>
                VRM must return latitude and longitude before a trailer can appear on the field map.
              </p>
            </div>
          ) : (
            <>
              <div className={`absolute inset-0 ${isLight ? 'bg-slate-100' : 'bg-[#07111f]'}`} aria-hidden="true">
                {tiles.map((tile) => (
                  // OSM tiles should be requested directly so browser caching and attribution stay transparent.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={tile.key}
                    src={tile.src}
                    alt=""
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    className={`absolute select-none ${isLight ? 'opacity-95' : 'opacity-70 saturate-[0.78] brightness-[0.72]'}`}
                    style={{
                      left: `${tile.leftPct}%`,
                      top: `${tile.topPct}%`,
                      width: `${tile.sizePctX}%`,
                      height: `${tile.sizePctY}%`,
                    }}
                  />
                ))}
                <div className={`absolute inset-0 ${isLight ? 'bg-white/10' : 'bg-[#020617]/28'}`} />
              </div>
              {points.length > 1 && (
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polyline
                    points={points.map((point) => `${point.anchorX},${point.anchorY}`).join(' ')}
                    fill="none"
                    stroke={isLight ? '#2563eb' : '#60a5fa'}
                    strokeWidth="0.35"
                    strokeDasharray="1.2 1.4"
                    opacity="0.5"
                  />
                  {points
                    .filter((point) => point.clusterSize > 1)
                    .map((point) => (
                      <line
                        key={`${point.siteId}-leader`}
                        x1={point.anchorX}
                        y1={point.anchorY}
                        x2={point.x}
                        y2={point.y}
                        stroke={isLight ? '#0f766e' : '#5eead4'}
                        strokeWidth="0.22"
                        strokeDasharray="0.8 0.9"
                        opacity="0.58"
                      />
                    ))}
                </svg>
              )}
              {points
                .filter((point) => point.clusterSize > 1)
                .map((point) => (
                  <span
                    key={`${point.siteId}-anchor`}
                    className={`absolute z-[8] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                      isLight ? 'border-teal-700 bg-white' : 'border-teal-200 bg-[#07111f]'
                    }`}
                    style={{ left: `${point.anchorX}%`, top: `${point.anchorY}%` }}
                    aria-hidden="true"
                  />
                ))}
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
                {selectedPoint ? `Selected ${selectedPoint.name}` : `OSM map zoom ${zoom}`}
              </div>
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className={`absolute bottom-3 right-3 rounded-md px-2 py-1 text-[9px] font-bold ${
                  isLight ? 'bg-white/88 text-slate-600 hover:text-blue-700' : 'bg-[#080c14]/82 text-[#bfdbfe]/60 hover:text-white'
                }`}
              >
                © OpenStreetMap contributors
              </a>
            </>
          )}
        </div>

        <div className={`rounded-xl border ${listPanelClass}`}>
          <div className={`border-b border-inherit px-3 py-3 text-[10px] font-black uppercase tracking-[0.24em] ${labelText}`}>
            Located Units
          </div>
          <div className="max-h-[320px] overflow-y-auto p-2">
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
                          <div className="text-sm font-black leading-snug">{point.name}</div>
                          <div className={`mt-1 text-[10px] ${mutedText}`}>{point.location ?? 'GPS location'} - {point.ageLabel} - {point.batteryLabel} battery</div>
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
