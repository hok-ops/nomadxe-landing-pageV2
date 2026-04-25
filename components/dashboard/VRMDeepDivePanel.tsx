'use client';

import type { VRMData, VRMDetailData, VRMSeries, VRMWidgetMetric } from '@/lib/vrm';

interface Props {
  siteId: string;
  data: VRMData | null;
  details: VRMDetailData | null;
  loading: boolean;
}

interface Notice {
  tone: 'critical' | 'warn' | 'info';
  title: string;
  body: string;
}

function toneClasses(tone: Notice['tone']) {
  if (tone === 'critical') {
    return {
      border: 'border-red-500/35',
      bg: 'bg-red-500/8',
      text: 'text-red-300',
    };
  }
  if (tone === 'warn') {
    return {
      border: 'border-amber-500/35',
      bg: 'bg-amber-500/8',
      text: 'text-amber-300',
    };
  }
  return {
    border: 'border-sky-500/30',
    bg: 'bg-sky-500/8',
    text: 'text-sky-300',
  };
}

function buildNotices(data: VRMData | null, details: VRMDetailData | null): Notice[] {
  const notices: Notice[] = [];
  if (!data) {
    notices.push({
      tone: 'warn',
      title: 'Telemetry pending',
      body: 'VRM has not returned a current snapshot for this trailer yet.',
    });
    return notices;
  }

  const staleSeconds = data.lastSeen > 0 ? Date.now() / 1000 - data.lastSeen : null;
  const solarCoverage = data.dcLoad > 0 ? data.solar.power / data.dcLoad : null;

  if (staleSeconds !== null && staleSeconds > 15 * 60) {
    notices.push({
      tone: 'critical',
      title: 'Trailer is offline',
      body: `VRM has not received fresh telemetry for ${Math.floor(staleSeconds / 60)} minutes.`,
    });
  }

  if (data.battery.soc <= 25) {
    notices.push({
      tone: 'critical',
      title: 'Battery reserve is low',
      body: `State of charge is ${Math.round(data.battery.soc)}%, which is close to a trailer service threshold.`,
    });
  } else if (data.battery.soc <= 40) {
    notices.push({
      tone: 'warn',
      title: 'Battery reserve is trending down',
      body: `State of charge is ${Math.round(data.battery.soc)}%. This trailer may need reduced load or more harvest.`,
    });
  }

  if (data.solar.mpptStateLabel === 'Fault') {
    notices.push({
      tone: 'critical',
      title: 'Solar charger fault reported',
      body: 'The current MPPT state is Fault, which usually means the trailer needs attention.',
    });
  }

  if (solarCoverage !== null && solarCoverage < 0.85 && data.dcLoad > 80 && data.battery.state === 2) {
    notices.push({
      tone: 'warn',
      title: 'Battery is supplementing the load',
      body: `Solar is covering only ${Math.round(solarCoverage * 100)}% of the active DC demand right now.`,
    });
  }

  if (details?.gps?.hasOldData) {
    notices.push({
      tone: 'info',
      title: 'Location is stale',
      body: 'The latest GPS position is older than the key telemetry feed, so dispatch should verify trailer placement.',
    });
  }

  if ((details?.alarms.configuredCount ?? 0) > 0) {
    notices.push({
      tone: 'info',
      title: 'Alarm coverage is configured',
      body: `${details?.alarms.configuredCount} VRM alarm rule(s) are configured for this site.`,
    });
  }

  return notices.slice(0, 4);
}

function MetricGrid({ title, metrics }: { title: string; metrics: VRMWidgetMetric[] }) {
  if (metrics.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[#1e3a5f]/45 bg-[#080c14]/75 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-[11px] font-bold text-[#93c5fd]/70 uppercase tracking-[0.35em] font-mono">
          {title}
        </h3>
        <span className="text-[10px] font-mono text-[#93c5fd]/35">
          VRM widget data
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div key={`${title}-${metric.key}`} className="rounded-xl border border-[#1e3a5f]/35 bg-[#0c1425] px-3 py-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/45 mb-1">
              {metric.label}
            </div>
            <div className="text-sm font-black text-white break-words">
              {metric.value}
            </div>
            {metric.stale && (
              <div className="mt-2 text-[9px] font-mono uppercase tracking-widest text-amber-300/70">
                Older reading
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function TrendChart({ siteId, title, series, color }: { siteId: string; title: string; series: VRMSeries | null; color: string }) {
  if (!series || series.points.length < 2) return null;

  const width = 320;
  const height = 110;
  const values = series.points.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const step = width / Math.max(series.points.length - 1, 1);
  const points = series.points.map((point, index) => {
    const x = index * step;
    const y = height - ((point.value - min) / range) * (height - 20) - 10;
    return `${x},${y}`;
  }).join(' ');
  const area = `M0,${height} ${points.split(' ').map((point) => `L${point}`).join(' ')} L${width},${height} Z`;
  const latest = series.points[series.points.length - 1];

  return (
    <section className="rounded-2xl border border-[#1e3a5f]/45 bg-[#080c14]/75 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[11px] font-bold text-[#93c5fd]/70 uppercase tracking-[0.35em] font-mono">
            {title}
          </h3>
          <p className="text-xs text-[#93c5fd]/35 mt-1">
            {series.label}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-black" style={{ color }}>
            {latest.value.toFixed(series.unit === '%' ? 0 : 1)}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/35">
            {series.unit ?? 'value'}
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 overflow-visible">
        <defs>
          <linearGradient id={`vrm-${siteId}-${title}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#vrm-${siteId}-${title})`} />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="mt-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/35">
        <span>{min.toFixed(series.unit === '%' ? 0 : 1)}{series.unit ?? ''} min</span>
        <span>{max.toFixed(series.unit === '%' ? 0 : 1)}{series.unit ?? ''} max</span>
      </div>
    </section>
  );
}

function OverallCard({
  label,
  solarYieldKwh,
  consumptionKwh,
}: {
  label: string;
  solarYieldKwh: number | null;
  consumptionKwh: number | null;
}) {
  return (
    <div className="rounded-xl border border-[#1e3a5f]/35 bg-[#0c1425] p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/45 mb-3">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-[#22c55e]/60 mb-1">Solar</div>
          <div className="text-lg font-black text-[#22c55e]">
            {solarYieldKwh === null ? '--' : solarYieldKwh.toFixed(2)}
            <span className="text-xs text-[#22c55e]/60 ml-1">kWh</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-[#f59e0b]/60 mb-1">Load</div>
          <div className="text-lg font-black text-[#f59e0b]">
            {consumptionKwh === null ? '--' : consumptionKwh.toFixed(2)}
            <span className="text-xs text-[#f59e0b]/60 ml-1">kWh</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VRMDeepDivePanel({ siteId, data, details, loading }: Props) {
  const notices = buildNotices(data, details);
  const gpsText =
    details?.gps?.latitude != null && details?.gps?.longitude != null
      ? `${details.gps.latitude.toFixed(5)}, ${details.gps.longitude.toFixed(5)}`
      : 'GPS unavailable';

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-2xl border border-[#1e3a5f]/45 bg-[#080c14]/75 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[11px] font-bold text-[#93c5fd]/70 uppercase tracking-[0.35em] font-mono">
              Trailer Intelligence
            </h2>
            <p className="text-sm text-[#e2e8f0] mt-1">
              Customer-facing power visibility pulled from the broader VRM API surface.
            </p>
          </div>
          {loading && (
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/40">
              Loading VRM detail...
            </div>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {notices.map((notice) => {
            const tone = toneClasses(notice.tone);
            return (
              <div
                key={notice.title}
                className={`rounded-xl border px-4 py-3 ${tone.border} ${tone.bg}`}
              >
                <div className={`text-[10px] font-mono uppercase tracking-[0.3em] mb-1 ${tone.text}`}>
                  {notice.title}
                </div>
                <p className="text-sm text-white/85">{notice.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {details && (
        <>
          <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
            <div className="rounded-2xl border border-[#1e3a5f]/45 bg-[#080c14]/75 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-[11px] font-bold text-[#93c5fd]/70 uppercase tracking-[0.35em] font-mono">
                  Location And Access
                </h3>
                {details.gps?.mapUrl && (
                  <a
                    href={details.gps.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono uppercase tracking-widest text-[#3b82f6] hover:text-white transition-colors"
                  >
                    Open Map
                  </a>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#1e3a5f]/35 bg-[#0c1425] p-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/45 mb-2">Coordinates</div>
                  <div className="text-base font-black text-white">{gpsText}</div>
                  <div className="mt-2 text-xs text-[#93c5fd]/40">
                    {details.gps?.hasOldData ? 'Position is older than the live key feed.' : 'GPS is current enough for trailer lookup.'}
                  </div>
                </div>

                <div className="rounded-xl border border-[#1e3a5f]/35 bg-[#0c1425] p-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/45 mb-2">Exports</div>
                  <div className="flex flex-wrap gap-2">
                    <a href={details.exports.csv7d} className="rounded-md border border-[#1e3a5f] px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/70 hover:text-white hover:border-[#3b82f6]/50 transition-colors">
                      7d CSV
                    </a>
                    <a href={details.exports.xlsx30d} className="rounded-md border border-[#1e3a5f] px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/70 hover:text-white hover:border-[#3b82f6]/50 transition-colors">
                      30d XLSX
                    </a>
                    <a href={details.exports.gpsKml7d} className="rounded-md border border-[#1e3a5f] px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/70 hover:text-white hover:border-[#3b82f6]/50 transition-colors">
                      7d KML
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#1e3a5f]/45 bg-[#080c14]/75 p-4 sm:p-5">
              <h3 className="text-[11px] font-bold text-[#93c5fd]/70 uppercase tracking-[0.35em] font-mono mb-4">
                Installation Inventory
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl border border-[#1e3a5f]/35 bg-[#0c1425] p-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/45 mb-1">Devices</div>
                  <div className="text-2xl font-black text-white">{details.system.deviceCount}</div>
                </div>
                <div className="rounded-xl border border-[#1e3a5f]/35 bg-[#0c1425] p-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/45 mb-1">Solar Chargers</div>
                  <div className="text-2xl font-black text-[#22c55e]">{details.system.solarChargers}</div>
                </div>
                <div className="rounded-xl border border-[#1e3a5f]/35 bg-[#0c1425] p-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/45 mb-1">Gateways</div>
                  <div className="text-2xl font-black text-[#3b82f6]">{details.system.gateways}</div>
                </div>
                <div className="rounded-xl border border-[#1e3a5f]/35 bg-[#0c1425] p-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/45 mb-1">Battery Devices</div>
                  <div className="text-2xl font-black text-[#f59e0b]">{details.system.batteryDevices}</div>
                </div>
              </div>
              <div className="space-y-2 max-h-56 overflow-auto pr-1">
                {details.system.devices.map((device) => (
                  <div key={`${device.productCode}-${device.name}-${device.firmwareVersion}`} className="rounded-xl border border-[#1e3a5f]/30 bg-[#0c1425] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white">{device.customName ?? device.name}</div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/35 mt-1">
                          {device.productName}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/35">Firmware</div>
                        <div className="text-xs text-[#93c5fd]/75">{device.firmwareVersion}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <TrendChart siteId={siteId} title="24h Solar Output" series={details.graphs.solar} color="#22c55e" />
            <TrendChart siteId={siteId} title="24h Battery SOC" series={details.graphs.batterySoc} color="#3b82f6" />
            <TrendChart siteId={siteId} title="24h DC Load" series={details.graphs.dcLoad} color="#f59e0b" />
            <TrendChart siteId={siteId} title="Forecast" series={details.graphs.forecastSolar} color="#60a5fa" />
          </section>

          <section className="rounded-2xl border border-[#1e3a5f]/45 bg-[#080c14]/75 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-[11px] font-bold text-[#93c5fd]/70 uppercase tracking-[0.35em] font-mono">
                Yield And Consumption Windows
              </h3>
              <span className="text-[10px] font-mono text-[#93c5fd]/35">
                From VRM overall stats
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <OverallCard label="Today" {...details.overall.today} />
              <OverallCard label="Week" {...details.overall.week} />
              <OverallCard label="Month" {...details.overall.month} />
              <OverallCard label="Year" {...details.overall.year} />
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <MetricGrid title="Status Summary" metrics={details.widgets.status} />
            <MetricGrid title="Battery Summary" metrics={details.widgets.battery} />
            <MetricGrid title="Solar Summary" metrics={details.widgets.solar} />
            <MetricGrid title="Historic Summary" metrics={details.widgets.historic} />
          </section>

          <section className="rounded-2xl border border-[#1e3a5f]/45 bg-[#080c14]/75 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[11px] font-bold text-[#93c5fd]/70 uppercase tracking-[0.35em] font-mono">
                  Alarm Coverage
                </h3>
                <p className="text-xs text-[#93c5fd]/35 mt-1">
                  The alarms endpoint exposes configured notification guardrails for the installation.
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-white">
                  <span className="text-2xl font-black text-[#3b82f6]">{details.alarms.configuredCount}</span>
                  <span className="text-[#93c5fd]/45 ml-2">rules</span>
                </div>
                <div className="text-white">
                  <span className="text-2xl font-black text-[#22c55e]">{details.alarms.notificationRecipients}</span>
                  <span className="text-[#93c5fd]/45 ml-2">recipients</span>
                </div>
              </div>
            </div>

            {details.alarms.items.length === 0 ? (
              <div className="rounded-xl border border-[#1e3a5f]/35 bg-[#0c1425] px-4 py-4 text-sm text-[#93c5fd]/45">
                No enabled VRM alarm rules were returned for this installation.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {details.alarms.items.map((alarm) => (
                  <div key={`${alarm.attributeId}-${alarm.attributeLabel}`} className="rounded-xl border border-[#1e3a5f]/35 bg-[#0c1425] px-4 py-4">
                    <div className="text-sm font-bold text-white">{alarm.attributeLabel}</div>
                    <div className="mt-2 text-[10px] font-mono uppercase tracking-widest text-[#93c5fd]/45">
                      Notify after {alarm.notifyAfterSeconds ?? 0}s
                    </div>
                    <div className="mt-3 flex gap-4 text-sm">
                      <span className="text-[#f59e0b]">Low: {alarm.lowAlarm ?? '--'}</span>
                      <span className="text-[#22c55e]">High: {alarm.highAlarm ?? '--'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
