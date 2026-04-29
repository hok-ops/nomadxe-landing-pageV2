'use client';

import { Activity, AlertTriangle, BatteryCharging, Brain, CheckCircle2, Gauge, Network, ShieldCheck, Zap } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import VisualBriefingFlipbook from '@/components/dashboard/VisualBriefingFlipbook';
import type { VRMData, VRMDetailData } from '@/lib/vrm';
import type { DiscoveredNetworkDevice, ManagedNetworkDevice } from '@/lib/networkDevices';
import {
  assessAssetIntelligence,
  formatRuntime,
  type IntelligenceDevice,
  type IntelligenceSeverity,
} from '@/lib/assetIntelligence';

const SEVERITY_STYLES: Record<IntelligenceSeverity, { label: string; dot: string; badge: string; border: string; text: string }> = {
  normal: {
    label: 'Normal',
    dot: 'bg-emerald-400',
    badge: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    border: 'border-emerald-500/20',
    text: 'text-emerald-300',
  },
  watch: {
    label: 'Watch',
    dot: 'bg-sky-400',
    badge: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
    border: 'border-sky-500/20',
    text: 'text-sky-300',
  },
  action: {
    label: 'Action',
    dot: 'bg-amber-400',
    badge: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    border: 'border-amber-500/20',
    text: 'text-amber-300',
  },
  critical: {
    label: 'Critical',
    dot: 'bg-rose-400',
    badge: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
    border: 'border-rose-500/20',
    text: 'text-rose-300',
  },
};

function SignalCard({ label, value, tone, isLight }: { label: string; value: string; tone: IntelligenceSeverity; isLight: boolean }) {
  const style = SEVERITY_STYLES[tone];
  return (
    <div className={`rounded-xl border ${style.border} ${isLight ? 'bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]' : 'bg-[#080c14]/70'} px-3 py-2.5`}>
      <div className={`text-[9px] font-bold uppercase tracking-[0.24em] ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/42'}`}>{label}</div>
      <div className={`mt-1 text-sm font-black tabular-nums ${style.text}`}>{value}</div>
    </div>
  );
}

function ComponentIcon({ id }: { id: string }) {
  const cls = 'h-3.5 w-3.5';
  if (id === 'power') return <BatteryCharging className={cls} />;
  if (id === 'solar') return <Zap className={cls} />;
  if (id === 'lan') return <Network className={cls} />;
  if (id === 'alarms') return <ShieldCheck className={cls} />;
  return <Activity className={cls} />;
}

export default function AssetIntelligencePanel({
  device,
  data,
  details,
  managedDevices,
  discoveredDevices,
}: {
  device: IntelligenceDevice;
  data: VRMData | null;
  details: VRMDetailData | null;
  managedDevices: ManagedNetworkDevice[];
  discoveredDevices: DiscoveredNetworkDevice[];
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const intelligence = assessAssetIntelligence({
    device,
    data,
    details,
    managedDevices,
    discoveredDevices,
  });
  const style = SEVERITY_STYLES[intelligence.severity];
  const topAnomalies = intelligence.anomalies.slice(0, 3);
  const coverage = intelligence.power.solarCoveragePct == null
    ? 'No active load'
    : `${Math.min(intelligence.power.solarCoveragePct, 999)}%`;
  const trend = intelligence.power.socTrendPerHour == null
    ? 'No trend'
    : `${intelligence.power.socTrendPerHour > 0 ? '+' : ''}${intelligence.power.socTrendPerHour.toFixed(1)}%/h`;
  const reserveValue = intelligence.power.runtimeHours == null && intelligence.power.severity === 'normal'
    ? 'Stable'
    : intelligence.power.runtimeHours == null
      ? 'Needs trend'
      : formatRuntime(intelligence.power.runtimeHours);
  const shellClass = isLight
    ? 'mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-[0_16px_44px_rgba(15,23,42,0.08)]'
    : 'mt-4 overflow-hidden rounded-2xl border border-[#1e3a5f]/65 bg-[linear-gradient(180deg,rgba(8,12,20,0.92),rgba(10,16,30,0.98))]';
  const headerClass = isLight ? 'border-slate-200' : 'border-[#1e3a5f]/45';
  const panelClass = isLight
    ? 'rounded-xl border border-slate-200 bg-slate-50 p-4'
    : 'rounded-xl border border-[#1e3a5f]/45 bg-[#0b1323]/70 p-4';
  const innerPanelClass = isLight
    ? 'rounded-xl border border-slate-200 bg-white px-3 py-3'
    : 'rounded-xl border border-[#1e3a5f]/45 bg-[#080c14]/72 px-3 py-3';
  const evidencePillClass = isLight
    ? 'rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-mono text-slate-600'
    : 'rounded-md border border-[#1e3a5f]/45 bg-[#0b1323]/80 px-2 py-1 text-[9px] font-mono text-[#93c5fd]/58';
  const primaryText = isLight ? 'text-slate-950' : 'text-white';
  const mutedText = isLight ? 'text-slate-600' : 'text-[#bfdbfe]/72';
  const subtleText = isLight ? 'text-slate-500' : 'text-[#93c5fd]/56';
  const labelText = isLight ? 'text-slate-500' : 'text-[#93c5fd]/42';

  return (
    <section className={shellClass}>
      <div className={`border-b px-4 py-4 sm:px-5 ${headerClass}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`h-2 w-2 rounded-full ${style.dot}`} />
              <h3 className={`text-[11px] font-black uppercase tracking-[0.3em] ${primaryText}`}>Asset Intelligence</h3>
              <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${style.badge}`}>
                {style.label}
              </span>
            </div>
            <p className={`mt-2 max-w-3xl text-[12px] leading-relaxed ${mutedText}`}>
              {intelligence.briefing}
            </p>
            <VisualBriefingFlipbook
              intelligence={intelligence}
              data={data}
              details={details}
              managedDevices={managedDevices}
              discoveredDevices={discoveredDevices}
            />
          </div>
          <div className="grid min-w-[250px] grid-cols-2 gap-2">
            <div className={innerPanelClass}>
              <div className={`text-[9px] font-bold uppercase tracking-[0.24em] ${labelText}`}>Freshness</div>
              <div className={`mt-1 text-lg font-black tabular-nums ${primaryText}`}>{intelligence.dataFreshnessScore}%</div>
            </div>
            <div className={innerPanelClass}>
              <div className={`text-[9px] font-bold uppercase tracking-[0.24em] ${labelText}`}>Coverage</div>
              <div className={`mt-1 text-lg font-black tabular-nums ${isLight ? 'text-blue-700' : 'text-[#93c5fd]'}`}>{intelligence.readiness.score}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:px-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-4">
            {intelligence.signals.map((signal) => (
              <SignalCard key={signal.label} label={signal.label} value={signal.value} tone={signal.tone} isLight={isLight} />
            ))}
          </div>

          <div className={panelClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Gauge className="h-4 w-4 text-[#60a5fa]" />
                <div>
                  <div className={`text-[10px] font-black uppercase tracking-[0.24em] ${primaryText}`}>Power Risk Forecast</div>
                  <div className={`mt-1 text-[11px] ${subtleText}`}>{intelligence.power.summary}</div>
                </div>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${SEVERITY_STYLES[intelligence.power.severity].badge}`}>
                {intelligence.power.reserveLabel}
              </span>
            </div>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              <SignalCard label="Reserve" value={reserveValue} tone={intelligence.power.severity} isLight={isLight} />
              <SignalCard label="Solar Coverage" value={coverage} tone={intelligence.power.solarCoveragePct != null && intelligence.power.solarCoveragePct < 60 ? 'watch' : 'normal'} isLight={isLight} />
              <SignalCard label="SOC Trend" value={trend} tone={intelligence.power.socTrendPerHour != null && intelligence.power.socTrendPerHour < -4 ? 'action' : 'normal'} isLight={isLight} />
            </div>
            <div className={`mt-3 rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-[#1e3a5f]/35 bg-[#080c14]/58 text-[#bfdbfe]/64'}`}>
              {intelligence.power.action}
            </div>
          </div>

          <div className={panelClass}>
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
              <h4 className={`text-[10px] font-black uppercase tracking-[0.24em] ${primaryText}`}>Root-Cause Signals</h4>
            </div>
            {topAnomalies.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                {topAnomalies.map((item) => {
                  const itemStyle = SEVERITY_STYLES[item.severity];
                  return (
                    <div key={item.id} className={`rounded-xl border ${itemStyle.border} ${isLight ? 'bg-white' : 'bg-[#080c14]/72'} px-3 py-3`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`text-sm font-bold ${primaryText}`}>{item.title}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] ${itemStyle.badge}`}>
                          {itemStyle.label}
                        </span>
                      </div>
                      <p className={`mt-1 text-[11px] leading-relaxed ${subtleText}`}>{item.summary}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.evidence.map((evidence) => (
                          <span key={evidence} className={evidencePillClass}>
                            {evidence}
                          </span>
                        ))}
                      </div>
                      <div className={`mt-2 text-[11px] leading-relaxed ${mutedText}`}>{item.action}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-emerald-500/18 bg-emerald-500/8 px-3 py-3 text-[11px] leading-relaxed text-emerald-100/70">
                No cross-signal exceptions are active. Victron telemetry, readiness scoring, and LAN inventory are aligned.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className={panelClass}>
            <div className="flex items-center gap-2.5">
              <Brain className="h-4 w-4 text-[#60a5fa]" />
              <h4 className={`text-[10px] font-black uppercase tracking-[0.24em] ${primaryText}`}>Monitoring Pace</h4>
            </div>
            <div className={`mt-3 ${innerPanelClass}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-[9px] font-bold uppercase tracking-[0.24em] ${labelText}`}>Mode</span>
                <span className={`text-sm font-black uppercase tracking-[0.16em] ${isLight ? 'text-blue-700' : 'text-[#93c5fd]'}`}>{intelligence.telemetryPlan.mode}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className={`text-[9px] font-bold uppercase tracking-[0.24em] ${labelText}`}>Refresh Rate</span>
                <span className={`text-sm font-black ${primaryText}`}>{Math.round(intelligence.telemetryPlan.pollIntervalMs / 1000)}s</span>
              </div>
              <p className={`mt-2 text-[11px] leading-relaxed ${subtleText}`}>{intelligence.telemetryPlan.reason}</p>
            </div>
            <div className="mt-3 space-y-2">
              {intelligence.telemetryPlan.rules.map((rule) => (
                <div key={rule} className={`flex gap-2 text-[11px] leading-relaxed ${isLight ? 'text-slate-700' : 'text-[#bfdbfe]/66'}`}>
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-300" />
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={panelClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <h4 className={`text-[10px] font-black uppercase tracking-[0.24em] ${primaryText}`}>Digital Twin Readiness</h4>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${subtleText}`}>{intelligence.readiness.label}</span>
            </div>
            <div className="mt-3 space-y-2">
              {intelligence.readiness.components.map((component) => {
                const componentStyle = SEVERITY_STYLES[component.status];
                return (
                  <div key={component.id} className={`rounded-xl border ${componentStyle.border} ${isLight ? 'bg-white' : 'bg-[#080c14]/70'} px-3 py-2.5`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className={`flex min-w-0 items-center gap-2 ${primaryText}`}>
                        <span className={componentStyle.text}><ComponentIcon id={component.id} /></span>
                        <span className="truncate text-[12px] font-bold">{component.label}</span>
                      </div>
                      <span className={`text-[10px] font-black tabular-nums ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/65'}`}>{Math.round(component.confidence * 100)}%</span>
                    </div>
                    <p className={`mt-1 text-[10px] leading-relaxed ${subtleText}`}>{component.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
