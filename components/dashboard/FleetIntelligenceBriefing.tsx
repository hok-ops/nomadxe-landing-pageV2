'use client';

import { useState } from 'react';
import { Activity, Brain, RadioTower, Signal } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import type { VRMData } from '@/lib/vrm';
import {
  assessAssetIntelligence,
  assessFleetIntelligence,
  type IntelligenceDevice,
  type IntelligenceSeverity,
} from '@/lib/assetIntelligence';

const STYLES: Record<IntelligenceSeverity, { label: string; dot: string; badge: string; text: string; border: string }> = {
  normal: { label: 'Normal', dot: 'bg-emerald-400', badge: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300', text: 'text-emerald-300', border: 'border-emerald-500/20' },
  watch: { label: 'Watch', dot: 'bg-sky-400', badge: 'border-sky-500/25 bg-sky-500/10 text-sky-300', text: 'text-sky-300', border: 'border-sky-500/20' },
  action: { label: 'Action', dot: 'bg-amber-400', badge: 'border-amber-500/25 bg-amber-500/10 text-amber-300', text: 'text-amber-300', border: 'border-amber-500/20' },
  critical: { label: 'Critical', dot: 'bg-rose-400', badge: 'border-rose-500/25 bg-rose-500/10 text-rose-300', text: 'text-rose-300', border: 'border-rose-500/20' },
};

export default function FleetIntelligenceBriefing({
  devices,
  dataMap,
  onOpenDevice,
}: {
  devices: IntelligenceDevice[];
  dataMap: Record<string, VRMData | null>;
  onOpenDevice?: (siteId: string) => void;
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const assets = devices.map((device) => assessAssetIntelligence({ device, data: dataMap[device.siteId] ?? null }));
  const [tickerPaused, setTickerPaused] = useState(false);
  const intelligence = assessFleetIntelligence(assets);
  const style = STYLES[intelligence.severity];
  const issueCount = intelligence.counts.watch + intelligence.counts.action + intelligence.counts.critical;
  const priorityLabel = 'Attention Queue';
  const priorityHelp = issueCount > 0
    ? 'Only units with watch, action, or critical signals appear here. Select one to open it.'
    : 'No units need attention. Use Shift Briefing or the fleet list for normal units.';
  const shouldAnimateQueue = intelligence.priorityAssets.length > 2;
  const tickerAssets = shouldAnimateQueue
    ? [...intelligence.priorityAssets, ...intelligence.priorityAssets]
    : intelligence.priorityAssets;
  const shellClass = isLight
    ? 'mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-[0_16px_44px_rgba(15,23,42,0.08)]'
    : 'mb-6 overflow-hidden rounded-2xl border border-[#1e3a5f]/50 bg-[linear-gradient(180deg,rgba(8,12,20,0.78),rgba(10,16,30,0.92))]';
  const dividerClass = isLight ? 'border-slate-200' : 'border-[#1e3a5f]/42';
  const metricClass = isLight
    ? 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5'
    : 'rounded-xl border border-[#1e3a5f]/55 bg-[#080c14]/82 px-3 py-2.5';
  const countClass = isLight
    ? 'rounded-xl border bg-white px-3 py-2.5 text-center shadow-[0_6px_18px_rgba(15,23,42,0.04)]'
    : 'rounded-xl border bg-[#080c14]/70 px-3 py-2.5 text-center';
  const mutedText = isLight ? 'text-slate-600' : 'text-[#bfdbfe]/70';
  const labelText = isLight ? 'text-slate-500' : 'text-[#93c5fd]/42';
  const primaryText = isLight ? 'text-slate-950' : 'text-white';
  const focusPanelClass = isLight
    ? 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-3'
    : 'rounded-xl border border-[#1e3a5f]/40 bg-[#0b1323]/60 px-3 py-3';
  const assetReason = (asset: (typeof assets)[number]) => {
    const anomaly = asset.anomalies[0];
    if (anomaly) return `${anomaly.title} - ${anomaly.evidence[0] ?? `reporting ${asset.dataFreshnessScore}%`}`;
    return `${asset.power.reserveLabel} - reporting ${asset.dataFreshnessScore}%`;
  };

  return (
    <section className={shellClass}>
      <div className={`flex flex-col gap-4 border-b px-4 py-4 sm:px-5 xl:flex-row xl:items-start xl:justify-between ${dividerClass}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`h-2 w-2 rounded-full ${style.dot}`} />
            <h2 className={`text-[11px] font-black uppercase tracking-[0.3em] ${primaryText}`}>Fleet Intelligence Briefing</h2>
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${style.badge}`}>
              {style.label}
            </span>
          </div>
          <p className={`mt-2 max-w-3xl text-[12px] leading-relaxed ${mutedText}`}>
            {intelligence.headline}. {intelligence.briefing}
          </p>
        </div>

        <div className="grid min-w-[280px] grid-cols-3 gap-2">
          <div className={metricClass}>
            <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.22em] ${labelText}`}>
              <Signal className="h-3 w-3" />
              Reporting
            </div>
            <div className={`mt-1 text-lg font-black tabular-nums ${primaryText}`}>{intelligence.fleetFreshnessPct}%</div>
          </div>
          <div className={metricClass}>
            <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.22em] ${labelText}`}>
              <Activity className="h-3 w-3" />
              Watch
            </div>
            <div className={`mt-1 text-lg font-black tabular-nums ${issueCount > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{issueCount}</div>
          </div>
          <div className={metricClass}>
            <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.22em] ${labelText}`}>
              <RadioTower className="h-3 w-3" />
              Update Cycle
            </div>
            <div className={`mt-1 text-lg font-black tabular-nums ${isLight ? 'text-blue-700' : 'text-[#93c5fd]'}`}>{Math.round(intelligence.telemetryPlan.pollIntervalMs / 1000)}s</div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="grid auto-rows-min grid-cols-2 gap-2 sm:grid-cols-4">
          {(['normal', 'watch', 'action', 'critical'] as IntelligenceSeverity[]).map((severity) => (
            <div key={severity} className={`${countClass} ${STYLES[severity].border}`}>
              <div className={`text-lg font-black tabular-nums ${STYLES[severity].text}`}>{intelligence.counts[severity]}</div>
              <div className={`text-[9px] font-bold uppercase tracking-[0.2em] ${labelText}`}>{STYLES[severity].label}</div>
            </div>
          ))}
        </div>

        <div>
          <div className={`text-[10px] font-bold uppercase tracking-[0.22em] ${labelText}`}>
            {priorityLabel}
            <span className={`ml-2 normal-case tracking-normal font-medium ${mutedText}`}>{priorityHelp}</span>
          </div>
          {issueCount === 0 && (
            <div className={`mt-2 rounded-xl border px-3 py-3 text-[12px] leading-relaxed ${isLight ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-emerald-500/20 bg-emerald-500/8 text-emerald-100/70'}`}>
              All assigned units are inside expected reporting and power bands. Normal units are intentionally not listed here so this section stays exception-driven.
            </div>
          )}
          {issueCount > 0 && (
            <div
              className="-mx-1 mt-2 overflow-hidden px-1 pb-1"
              onClick={() => setTickerPaused((value) => !value)}
              title={tickerPaused ? 'Click to resume queue motion' : 'Click empty queue space to pause motion'}
            >
              <style>{`
                @keyframes nx-attention-ticker {
                  from { transform: translateX(0); }
                  to { transform: translateX(-50%); }
                }
              `}</style>
              <div
                className="flex w-max snap-x gap-2"
                style={{
                  animation: shouldAnimateQueue ? `nx-attention-ticker ${Math.max(18, intelligence.priorityAssets.length * 5)}s linear infinite` : undefined,
                  animationPlayState: tickerPaused ? 'paused' : 'running',
                }}
              >
              {tickerAssets.map((asset, index) => {
                const assetStyle = STYLES[asset.severity];
                const clickable = typeof onOpenDevice === 'function';
                const CardTag = clickable ? 'button' : 'div';
                return (
                  <CardTag
                    key={`${asset.siteId}-${index}`}
                    type={clickable ? 'button' : undefined}
                    onClick={clickable ? (event: any) => { event.stopPropagation(); onOpenDevice(asset.siteId); } : undefined}
                    className={`min-w-[270px] max-w-[340px] snap-start rounded-xl border text-left ${assetStyle.border} ${isLight ? 'bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]' : 'bg-[#080c14]/70'} px-3 py-3 ${clickable ? 'transition-colors hover:border-[#3b82f6]/65 hover:bg-[#1e40af]/10' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`text-sm font-bold leading-snug ${primaryText}`}>{asset.displayName}</div>
                        <div className={`mt-1 text-[10px] leading-relaxed ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/50'}`}>{assetReason(asset)}</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] ${assetStyle.badge}`}>
                        {assetStyle.label}
                      </span>
                    </div>
                  </CardTag>
                );
              })}
              </div>
            </div>
          )}
        </div>

        {intelligence.nextActions.length > 0 && (
          <div className={focusPanelClass}>
            <div className={`flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.24em] ${primaryText}`}>
              <Brain className="h-4 w-4 text-[#60a5fa]" />
              Recommended Focus
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {intelligence.nextActions.slice(0, 4).map((action) => (
                <div key={action} className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-700' : 'text-[#bfdbfe]/66'}`}>
                  {action}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
