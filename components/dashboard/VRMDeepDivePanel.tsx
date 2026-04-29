'use client';

import { useTheme } from '@/components/ThemeProvider';
import type { VRMData, VRMDetailData, VRMSeries, VRMWidgetMetric } from '@/lib/vrm';
import { getDcLoadSignalDetail, getDcLoadSignalTitle, hasMissingDcLoadSignal } from '@/lib/telemetryHealth';

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

  if (hasMissingDcLoadSignal(data)) {
    notices.push({
      tone: 'warn',
      title: getDcLoadSignalTitle(data),
      body: getDcLoadSignalDetail(data),
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
  const { theme } = useTheme();
  const isLight = theme === 'light';
  if (metrics.length === 0) return null;

  return (
    <section className={`rounded-2xl border p-4 sm:p-5 ${isLight ? 'border-slate-300 bg-white shadow-sm' : 'border-[#1e3a5f]/45 bg-[#080c14]/75'}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className={`text-[11px] font-bold uppercase tracking-[0.35em] font-mono ${isLight ? 'text-slate-800' : 'text-[#93c5fd]/70'}`}>
          {title}
        </h3>
        <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/35'}`}>
          VRM widget data
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div key={`${title}-${metric.key}`} className={`rounded-xl border px-3 py-3 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[#1e3a5f]/35 bg-[#0c1425]'}`}>
            <div className={`text-[10px] font-mono uppercase tracking-widest mb-1 ${isLight ? 'text-slate-600' : 'text-[#93c5fd]/45'}`}>
              {metric.label}
            </div>
            <div className={`text-sm font-black break-words ${isLight ? 'text-slate-950' : 'text-white'}`}>
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
  const { theme } = useTheme();
  const isLight = theme === 'light';
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
  const gradientId = `vrm-${siteId}-${title}`.replace(/[^a-zA-Z0-9_-]/g, '-');

  return (
    <section className={`rounded-2xl border p-4 sm:p-5 ${isLight ? 'border-slate-300 bg-white shadow-sm' : 'border-[#1e3a5f]/45 bg-[#080c14]/75'}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className={`text-[11px] font-bold uppercase tracking-[0.35em] font-mono ${isLight ? 'text-slate-800' : 'text-[#93c5fd]/70'}`}>
            {title}
          </h3>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-[#93c5fd]/35'}`}>
            {series.label}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-black" style={{ color }}>
            {latest.value.toFixed(series.unit === '%' ? 0 : 1)}
          </div>
          <div className={`text-[10px] font-mono uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/35'}`}>
            {series.unit ?? 'value'}
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 overflow-visible">
        {!isLight && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
        )}
        {!isLight && <path d={area} fill={`url(#${gradientId})`} />}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={isLight ? '2.4' : '2'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className={`mt-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/35'}`}>
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
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[#1e3a5f]/35 bg-[#0c1425]'}`}>
      <div className={`text-[10px] font-mono uppercase tracking-widest mb-3 ${isLight ? 'text-slate-600' : 'text-[#93c5fd]/45'}`}>
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
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const notices = buildNotices(data, details);
  const gpsText =
    details?.gps?.latitude != null && details?.gps?.longitude != null
      ? `${details.gps.latitude.toFixed(5)}, ${details.gps.longitude.toFixed(5)}`
      : 'GPS unavailable';
  const panelClass = isLight ? 'border-slate-300 bg-white shadow-sm' : 'border-[#1e3a5f]/45 bg-[#080c14]/75';
  const cardClass = isLight ? 'border-slate-200 bg-slate-50' : 'border-[#1e3a5f]/35 bg-[#0c1425]';
  const labelClass = isLight ? 'text-slate-600' : 'text-[#93c5fd]/45';
  const softLabelClass = isLight ? 'text-slate-500' : 'text-[#93c5fd]/35';
  const valueClass = isLight ? 'text-slate-950' : 'text-white';
  const exportLinkClass = isLight
    ? 'border-slate-300 text-slate-700 hover:border-blue-400 hover:text-blue-700'
    : 'border-[#1e3a5f] text-[#93c5fd]/70 hover:text-white hover:border-[#3b82f6]/50';

  return (
    <div className="mt-6 space-y-6">
      <section className={`rounded-2xl border p-4 sm:p-5 ${panelClass}`}>
        <div className="flex items-center justify-end mb-4">
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
                <p className={`text-sm ${isLight ? 'text-slate-800' : 'text-white/85'}`}>{notice.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {details && (
        <>
          <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
            <div className={`rounded-2xl border p-4 sm:p-5 ${panelClass}`}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className={`text-[11px] font-bold uppercase tracking-[0.35em] font-mono ${isLight ? 'text-slate-800' : 'text-[#93c5fd]/70'}`}>
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
                <div className={`rounded-xl border p-4 ${cardClass}`}>
                  <div className={`text-[10px] font-mono uppercase tracking-widest mb-2 ${labelClass}`}>Coordinates</div>
                  <div className={`text-base font-black ${valueClass}`}>{gpsText}</div>
                  <div className={`mt-2 text-xs ${isLight ? 'text-slate-600' : 'text-[#93c5fd]/40'}`}>
                    {details.gps?.hasOldData ? 'Position is older than the live key feed.' : 'GPS is current enough for trailer lookup.'}
                  </div>
                </div>

                <div className={`rounded-xl border p-4 ${cardClass}`}>
                  <div className={`text-[10px] font-mono uppercase tracking-widest mb-2 ${labelClass}`}>Exports</div>
                  <div className="flex flex-wrap gap-2">
                    <a href={details.exports.csv7d} className={`rounded-md border px-3 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors ${exportLinkClass}`}>
                      7d CSV
                    </a>
                    <a href={details.exports.xlsx30d} className={`rounded-md border px-3 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors ${exportLinkClass}`}>
                      30d XLSX
                    </a>
                    <a href={details.exports.gpsKml7d} className={`rounded-md border px-3 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors ${exportLinkClass}`}>
                      7d KML
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className={`rounded-2xl border p-4 sm:p-5 ${panelClass}`}>
              <h3 className={`text-[11px] font-bold uppercase tracking-[0.35em] font-mono mb-4 ${isLight ? 'text-slate-800' : 'text-[#93c5fd]/70'}`}>
                Installation Inventory
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className={`rounded-xl border p-4 ${cardClass}`}>
                  <div className={`text-[10px] font-mono uppercase tracking-widest mb-1 ${labelClass}`}>Devices</div>
                  <div className={`text-2xl font-black ${valueClass}`}>{details.system.deviceCount}</div>
                </div>
                <div className={`rounded-xl border p-4 ${cardClass}`}>
                  <div className={`text-[10px] font-mono uppercase tracking-widest mb-1 ${labelClass}`}>Solar Chargers</div>
                  <div className="text-2xl font-black text-[#22c55e]">{details.system.solarChargers}</div>
                </div>
                <div className={`rounded-xl border p-4 ${cardClass}`}>
                  <div className={`text-[10px] font-mono uppercase tracking-widest mb-1 ${labelClass}`}>Gateways</div>
                  <div className="text-2xl font-black text-[#3b82f6]">{details.system.gateways}</div>
                </div>
                <div className={`rounded-xl border p-4 ${cardClass}`}>
                  <div className={`text-[10px] font-mono uppercase tracking-widest mb-1 ${labelClass}`}>Battery Devices</div>
                  <div className="text-2xl font-black text-[#f59e0b]">{details.system.batteryDevices}</div>
                </div>
              </div>
              <div className="space-y-2 max-h-56 overflow-auto pr-1">
                {details.system.devices.map((device) => (
                  <div key={`${device.productCode}-${device.name}-${device.firmwareVersion}`} className={`rounded-xl border px-3 py-3 ${cardClass}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className={`text-sm font-bold ${valueClass}`}>{device.customName ?? device.name}</div>
                        <div className={`text-[10px] font-mono uppercase tracking-widest mt-1 ${softLabelClass}`}>
                          {device.productName}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[10px] font-mono uppercase tracking-widest ${softLabelClass}`}>Firmware</div>
                        <div className={`text-xs ${isLight ? 'text-slate-700' : 'text-[#93c5fd]/75'}`}>{device.firmwareVersion}</div>
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

          <section className={`rounded-2xl border p-4 sm:p-5 ${panelClass}`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className={`text-[11px] font-bold uppercase tracking-[0.35em] font-mono ${isLight ? 'text-slate-800' : 'text-[#93c5fd]/70'}`}>
                Yield And Consumption Windows
              </h3>
              <span className={`text-[10px] font-mono ${softLabelClass}`}>
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

          <section className={`rounded-2xl border p-4 sm:p-5 ${panelClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className={`text-[11px] font-bold uppercase tracking-[0.35em] font-mono ${isLight ? 'text-slate-800' : 'text-[#93c5fd]/70'}`}>
                  Alarm Coverage
                </h3>
                <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-[#93c5fd]/35'}`}>
                  The alarms endpoint exposes configured notification guardrails for the installation.
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className={valueClass}>
                  <span className="text-2xl font-black text-[#3b82f6]">{details.alarms.configuredCount}</span>
                  <span className={`ml-2 ${labelClass}`}>rules</span>
                </div>
                <div className={valueClass}>
                  <span className="text-2xl font-black text-[#22c55e]">{details.alarms.notificationRecipients}</span>
                  <span className={`ml-2 ${labelClass}`}>recipients</span>
                </div>
              </div>
            </div>

            {details.alarms.items.length === 0 ? (
              <div className={`rounded-xl border px-4 py-4 text-sm ${cardClass} ${labelClass}`}>
                No enabled VRM alarm rules were returned for this installation.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {details.alarms.items.map((alarm) => (
                  <div key={`${alarm.attributeId}-${alarm.attributeLabel}`} className={`rounded-xl border px-4 py-4 ${cardClass}`}>
                    <div className={`text-sm font-bold ${valueClass}`}>{alarm.attributeLabel}</div>
                    <div className={`mt-2 text-[10px] font-mono uppercase tracking-widest ${labelClass}`}>
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
