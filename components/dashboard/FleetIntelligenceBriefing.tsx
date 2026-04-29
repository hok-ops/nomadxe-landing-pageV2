'use client';

import { Activity, Brain, RadioTower, ShieldCheck } from 'lucide-react';
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
}: {
  devices: IntelligenceDevice[];
  dataMap: Record<string, VRMData | null>;
}) {
  const assets = devices.map((device) => assessAssetIntelligence({ device, data: dataMap[device.siteId] ?? null }));
  const intelligence = assessFleetIntelligence(assets);
  const style = STYLES[intelligence.severity];
  const issueCount = intelligence.counts.watch + intelligence.counts.action + intelligence.counts.critical;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-[#1e3a5f]/50 bg-[linear-gradient(180deg,rgba(8,12,20,0.78),rgba(10,16,30,0.92))]">
      <div className="flex flex-col gap-4 border-b border-[#1e3a5f]/42 px-4 py-4 sm:px-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`h-2 w-2 rounded-full ${style.dot}`} />
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Fleet Intelligence Briefing</h2>
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${style.badge}`}>
              {style.label}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-[#bfdbfe]/70">
            {intelligence.headline}. {intelligence.briefing}
          </p>
        </div>

        <div className="grid min-w-[280px] grid-cols-3 gap-2">
          <div className="rounded-xl border border-[#1e3a5f]/55 bg-[#080c14]/82 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/42">
              <ShieldCheck className="h-3 w-3" />
              Trust
            </div>
            <div className="mt-1 text-lg font-black tabular-nums text-white">{intelligence.fleetScore}%</div>
          </div>
          <div className="rounded-xl border border-[#1e3a5f]/55 bg-[#080c14]/82 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/42">
              <Activity className="h-3 w-3" />
              Watch
            </div>
            <div className={`mt-1 text-lg font-black tabular-nums ${issueCount > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{issueCount}</div>
          </div>
          <div className="rounded-xl border border-[#1e3a5f]/55 bg-[#080c14]/82 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/42">
              <RadioTower className="h-3 w-3" />
              Cadence
            </div>
            <div className="mt-1 text-lg font-black tabular-nums text-[#93c5fd]">{Math.round(intelligence.telemetryPlan.pollIntervalMs / 1000)}s</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:px-5 xl:grid-cols-[1fr_1.1fr]">
        <div className="grid grid-cols-4 gap-2">
          {(['normal', 'watch', 'action', 'critical'] as IntelligenceSeverity[]).map((severity) => (
            <div key={severity} className={`rounded-xl border ${STYLES[severity].border} bg-[#080c14]/70 px-3 py-2.5 text-center`}>
              <div className={`text-lg font-black tabular-nums ${STYLES[severity].text}`}>{intelligence.counts[severity]}</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#93c5fd]/42">{STYLES[severity].label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {intelligence.priorityAssets.slice(0, 4).map((asset) => {
            const assetStyle = STYLES[asset.severity];
            return (
              <div key={asset.siteId} className={`rounded-xl border ${assetStyle.border} bg-[#080c14]/70 px-3 py-3`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white">{asset.displayName}</div>
                    <div className="mt-1 text-[10px] text-[#93c5fd]/50">{asset.power.reserveLabel} &middot; trust {asset.trustScore}%</div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] ${assetStyle.badge}`}>
                    {assetStyle.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {intelligence.nextActions.length > 0 && (
          <div className="rounded-xl border border-[#1e3a5f]/40 bg-[#0b1323]/60 px-3 py-3 xl:col-span-2">
            <div className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.24em] text-white">
              <Brain className="h-4 w-4 text-[#60a5fa]" />
              Recommended Focus
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {intelligence.nextActions.slice(0, 4).map((action) => (
                <div key={action} className="text-[11px] leading-relaxed text-[#bfdbfe]/66">
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
