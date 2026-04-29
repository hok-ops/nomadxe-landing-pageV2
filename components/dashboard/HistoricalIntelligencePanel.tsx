'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, FileClock, RefreshCw, ShieldAlert } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import type { HistoricalIntelligenceReport, HistoricalRecommendation, ReportSeverity } from '@/lib/historicalIntelligence';
import type { DashboardDeviceRef } from '@/lib/leaseOperations';

const SEVERITY_STYLE: Record<ReportSeverity, { label: string; text: string; border: string; bg: string }> = {
  info: { label: 'Info', text: 'text-sky-300', border: 'border-sky-500/20', bg: 'bg-sky-500/10' },
  watch: { label: 'Watch', text: 'text-sky-300', border: 'border-sky-500/20', bg: 'bg-sky-500/10' },
  action: { label: 'Action', text: 'text-amber-300', border: 'border-amber-500/24', bg: 'bg-amber-500/10' },
  critical: { label: 'Critical', text: 'text-rose-300', border: 'border-rose-500/24', bg: 'bg-rose-500/10' },
};

const CATEGORY_LABEL: Record<HistoricalRecommendation['category'], string> = {
  power: 'Power',
  visibility: 'Visibility',
  alarm_coverage: 'Alarms',
  service: 'Service',
  geofence: 'Boundary',
  firmware: 'Firmware',
  monitoring: 'Monitoring',
  efficiency: 'Efficiency',
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not generated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not generated';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function RecommendationRow({
  item,
  isLight,
}: {
  item: HistoricalRecommendation;
  isLight: boolean;
}) {
  const style = SEVERITY_STYLE[item.severity];
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${isLight ? 'border-slate-200 bg-white' : `${style.border} ${style.bg}`}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${isLight ? 'border-slate-200 bg-slate-50 text-slate-600' : `${style.border} ${style.text}`}`}>
            {CATEGORY_LABEL[item.category]}
          </span>
          <span className={`truncate text-sm font-black ${isLight ? 'text-slate-950' : 'text-white'}`}>{item.title}</span>
        </div>
        <span className={`text-[9px] font-mono font-black uppercase tracking-[0.16em] ${isLight ? 'text-slate-500' : style.text}`}>
          {SEVERITY_STYLE[item.severity].label} - {item.confidence}%
        </span>
      </div>
      <p className={`mt-1 text-[11px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#bfdbfe]/66'}`}>{item.summary}</p>
      <p className={`mt-2 text-[11px] font-bold leading-relaxed ${isLight ? 'text-slate-800' : 'text-[#bfdbfe]/82'}`}>{item.action}</p>
      {item.evidence.length > 0 && (
        <div className={`mt-2 flex flex-wrap gap-1.5 text-[9px] ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/48'}`}>
          {item.evidence.slice(0, 3).map((fact) => (
            <span key={fact} className={`rounded-full border px-2 py-0.5 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[#1e3a5f]/40 bg-[#080c14]/44'}`}>
              {fact}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoricalIntelligencePanel({ devices }: { devices: DashboardDeviceRef[] }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [siteId, setSiteId] = useState(devices[0]?.siteId ?? '');
  const [report, setReport] = useState<HistoricalIntelligenceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    setLoading(true);
    setMessage(null);
    fetch(`/api/intelligence/reports/${siteId}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setMessage(json?.error ?? 'Historical report lookup is unavailable.');
          setReport(null);
          return;
        }
        setReport(json.report ?? null);
      })
      .catch(() => {
        if (active) setMessage('Network error while loading the latest historical report.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [siteId]);

  const topRecommendations = useMemo(
    () => (report?.recommendations ?? []).slice(0, 4),
    [report]
  );

  async function generateReport() {
    if (!siteId) return;
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/intelligence/reports/${siteId}`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json?.error ?? 'Could not generate historical intelligence.');
        return;
      }
      setReport(json.report ?? null);
      setMessage(json.warning ?? 'Historical intelligence report generated.');
    } catch {
      setMessage('Network error. Historical intelligence was not generated.');
    } finally {
      setGenerating(false);
    }
  }

  const primaryStyle = report ? SEVERITY_STYLE[report.summary.overallSeverity] : SEVERITY_STYLE.info;
  const panelClass = isLight
    ? 'rounded-xl border border-slate-200 bg-slate-50 p-4'
    : 'rounded-xl border border-[#1e3a5f]/45 bg-[#0b1323]/66 p-4';
  const subPanelClass = isLight
    ? 'rounded-lg border border-slate-200 bg-white px-3 py-3'
    : 'rounded-lg border border-[#1e3a5f]/38 bg-[#080c14]/58 px-3 py-3';
  const mutedText = isLight ? 'text-slate-600' : 'text-[#93c5fd]/58';
  const primaryText = isLight ? 'text-slate-950' : 'text-white';

  return (
    <div className={panelClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className={`flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.24em] ${primaryText}`}>
            <FileClock className="h-4 w-4 text-[#60a5fa]" />
            Historical Intelligence
          </div>
          <p className={`mt-2 max-w-2xl text-[11px] leading-relaxed ${mutedText}`}>
            Daily report generated from VRM history, alarms, GPS, firmware inventory, lease visibility, and operations evidence.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:min-w-[360px]">
          <select
            aria-label="Historical report trailer"
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
            className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs font-bold outline-none focus:border-[#60a5fa] ${isLight ? 'border-slate-200 bg-white text-slate-950' : 'border-[#1e3a5f]/55 bg-[#080c14] text-white'}`}
          >
            {devices.map((device) => (
              <option key={device.siteId} value={device.siteId}>{device.displayName ?? device.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={generateReport}
            disabled={generating || !siteId}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isLight ? 'border-blue-200 bg-blue-600 text-white hover:bg-blue-700' : 'border-[#2563eb]/45 bg-[#1e40af]/28 text-[#bfdbfe] hover:border-[#60a5fa]/70 hover:text-white'}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating' : 'Generate'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
        <div className={subPanelClass}>
          {report ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={`text-[9px] font-black uppercase tracking-[0.22em] ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/42'}`}>Latest Report</div>
                  <div className={`mt-1 text-lg font-black ${primaryText}`}>{report.deviceName}</div>
                </div>
                <div className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${isLight ? 'border-slate-200 bg-slate-50 text-slate-600' : `${primaryStyle.border} ${primaryStyle.text}`}`}>
                  {primaryStyle.label}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <div className={`text-[9px] font-bold uppercase tracking-[0.2em] ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/42'}`}>Readiness</div>
                  <div className={`mt-1 text-2xl font-black tabular-nums ${primaryText}`}>{report.summary.readinessScore}%</div>
                </div>
                <div>
                  <div className={`text-[9px] font-bold uppercase tracking-[0.2em] ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/42'}`}>Generated</div>
                  <div className={`mt-2 text-xs font-bold ${mutedText}`}>{formatDate(report.generatedAt)}</div>
                </div>
              </div>
              <div className={`mt-3 text-[11px] leading-relaxed ${mutedText}`}>
                {report.summary.powerAutonomy.summary} {report.summary.visibilityRisk.summary}
              </div>
              {report.evidence.exportLinks && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={report.evidence.exportLinks.csv7d} className="text-[10px] font-black uppercase tracking-[0.16em] text-[#60a5fa] hover:text-white">CSV 7d</a>
                  <a href={report.evidence.exportLinks.xlsx30d} className="text-[10px] font-black uppercase tracking-[0.16em] text-[#60a5fa] hover:text-white">XLSX 30d</a>
                  <a href={report.evidence.exportLinks.gpsKml7d} className="text-[10px] font-black uppercase tracking-[0.16em] text-[#60a5fa] hover:text-white">GPS KML</a>
                </div>
              )}
            </>
          ) : (
            <div className={`py-4 text-[11px] leading-relaxed ${mutedText}`}>
              {loading ? 'Loading the latest saved report.' : 'No historical intelligence report is saved for this trailer yet. Generate one to create the first evidence record.'}
            </div>
          )}
          {message && <div className={`mt-3 rounded-lg border px-3 py-2 text-[11px] ${isLight ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-[#1e3a5f]/38 bg-[#080c14]/58 text-[#bfdbfe]/70'}`}>{message}</div>}
        </div>

        <div className="space-y-2">
          {topRecommendations.length > 0 ? (
            topRecommendations.map((item) => (
              <RecommendationRow key={item.id} item={item} isLight={isLight} />
            ))
          ) : (
            <div className={subPanelClass}>
              <div className={`flex items-center gap-2 text-sm font-black ${primaryText}`}>
                <ShieldAlert className="h-4 w-4 text-[#60a5fa]" />
                Waiting for report recommendations
              </div>
              <p className={`mt-2 text-[11px] leading-relaxed ${mutedText}`}>
                The report engine will prioritize autonomy, visibility, alarms, monitoring coverage, firmware inventory, site-boundary confidence, and polling efficiency.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={`mt-3 flex items-center gap-2 text-[10px] leading-relaxed ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/46'}`}>
        <BarChart3 className="h-3.5 w-3.5 text-[#60a5fa]" />
        Recommendations are advisory only. Remote sessions, firmware changes, and configuration actions still require intentional human approval.
      </div>
    </div>
  );
}
