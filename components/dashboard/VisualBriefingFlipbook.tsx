'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, Layers, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import type { AssetIntelligence, IntelligenceSeverity } from '@/lib/assetIntelligence';
import type { DiscoveredNetworkDevice, ManagedNetworkDevice } from '@/lib/networkDevices';
import { buildVisualBriefingFrames } from '@/lib/visualBriefing';
import type { VRMData, VRMDetailData } from '@/lib/vrm';

const ENABLED = process.env.NEXT_PUBLIC_VISUAL_BRIEFING === 'true';

const TONE: Record<IntelligenceSeverity, { label: string; border: string; text: string; bg: string }> = {
  normal: { label: 'Normal', border: 'border-emerald-500/30', text: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  watch: { label: 'Watch', border: 'border-sky-500/30', text: 'text-sky-300', bg: 'bg-sky-500/10' },
  action: { label: 'Action', border: 'border-amber-500/30', text: 'text-amber-300', bg: 'bg-amber-500/10' },
  critical: { label: 'Critical', border: 'border-rose-500/30', text: 'text-rose-300', bg: 'bg-rose-500/10' },
};

export default function VisualBriefingFlipbook({
  intelligence,
  data,
  details,
  managedDevices,
  discoveredDevices,
}: {
  intelligence: AssetIntelligence;
  data: VRMData | null;
  details: VRMDetailData | null;
  managedDevices: ManagedNetworkDevice[];
  discoveredDevices: DiscoveredNetworkDevice[];
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const frames = useMemo(
    () => buildVisualBriefingFrames({ intelligence, data, details, managedDevices, discoveredDevices }),
    [intelligence, data, details, managedDevices, discoveredDevices]
  );
  const frame = frames[index] ?? frames[0];

  if (!ENABLED) return null;

  const shell = isLight
    ? 'border-slate-200 bg-white text-slate-950 shadow-[0_16px_44px_rgba(15,23,42,0.08)]'
    : 'border-[#1e3a5f]/55 bg-[#080c14]/85 text-white';
  const muted = isLight ? 'text-slate-600' : 'text-[#bfdbfe]/70';
  const card = isLight ? 'border-slate-200 bg-slate-50' : 'border-[#1e3a5f]/45 bg-[#0b1323]/72';

  return (
    <>
      <button
        type="button"
        onClick={() => { setIndex(0); setOpen(true); }}
        className={`mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-colors ${
          isLight
            ? 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400'
            : 'border-[#3b82f6]/35 bg-[#1e40af]/18 text-[#93c5fd] hover:border-[#3b82f6]/70 hover:text-white'
        }`}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Visual Briefing
      </button>

      {open && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-sm">
          <div className={`w-full max-w-5xl overflow-hidden rounded-2xl border ${shell}`}>
            <div className={`flex items-start justify-between gap-4 border-b px-5 py-4 ${isLight ? 'border-slate-200' : 'border-[#1e3a5f]/50'}`}>
              <div>
                <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.26em] ${isLight ? 'text-blue-700' : 'text-[#60a5fa]'}`}>
                  <Layers className="h-4 w-4" />
                  Experimental Visual Briefing
                </div>
                <h3 className="mt-2 text-2xl font-black">{frame.title}</h3>
                <p className={`mt-1 max-w-3xl text-sm leading-relaxed ${muted}`}>
                  A reversible, feature-flagged briefing layer. Numbers come from dashboard telemetry; the frame is a visual explanation, not a control surface.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`rounded-lg border p-2 transition-colors ${isLight ? 'border-slate-200 text-slate-600 hover:text-slate-950' : 'border-[#1e3a5f] text-[#93c5fd]/70 hover:text-white'}`}
                aria-label="Close visual briefing"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid max-h-[74vh] overflow-auto lg:grid-cols-[1.2fr_0.8fr]">
              <div className="p-5">
                <div className={`min-h-[380px] rounded-2xl border p-5 ${card}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className={`text-[10px] font-black uppercase tracking-[0.24em] ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/52'}`}>{frame.eyebrow}</div>
                      <div className="mt-2 text-xl font-black">{frame.title}</div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${TONE[frame.severity].border} ${TONE[frame.severity].bg} ${TONE[frame.severity].text}`}>
                      {TONE[frame.severity].label}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                    <div className={`rounded-2xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-[#1e3a5f]/45 bg-[#080c14]/72'}`}>
                      <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/55'}`}>
                        <Eye className="h-3.5 w-3.5" />
                        Summary
                      </div>
                      <p className={`mt-3 text-sm leading-relaxed ${muted}`}>{frame.summary}</p>
                    </div>

                    <div className="relative min-h-[230px] overflow-hidden rounded-2xl border border-[#3b82f6]/25 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.22),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(8,12,20,0.98))] p-4">
                      <div className="absolute inset-x-6 top-1/2 h-px bg-[#3b82f6]/35" />
                      <div className="absolute left-1/2 top-6 bottom-6 w-px bg-[#3b82f6]/25" />
                      {frame.hotspots.map((hotspot, hotspotIndex) => {
                        const positions = [
                          'left-[8%] top-[12%]',
                          'right-[8%] top-[18%]',
                          'left-[12%] bottom-[14%]',
                          'right-[10%] bottom-[12%]',
                        ];
                        return (
                          <div
                            key={hotspot.id}
                            className={`absolute max-w-[44%] rounded-xl border px-3 py-2 ${positions[hotspotIndex % positions.length]} ${TONE[hotspot.tone].border} bg-[#020617]/78 shadow-lg`}
                          >
                            <div className={`text-[9px] font-black uppercase tracking-[0.2em] ${TONE[hotspot.tone].text}`}>{hotspot.label}</div>
                            <div className="mt-1 text-[11px] leading-snug text-white/82">{hotspot.detail}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {frame.evidence.map((item) => (
                      <div key={item} className={`rounded-xl border px-3 py-2 text-[11px] leading-relaxed ${isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-[#1e3a5f]/35 bg-[#080c14]/72 text-[#bfdbfe]/72'}`}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className={`border-t p-5 lg:border-l lg:border-t-0 ${isLight ? 'border-slate-200' : 'border-[#1e3a5f]/50'}`}>
                <div className={`flex items-center gap-2 rounded-xl border p-3 text-xs leading-relaxed ${isLight ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-emerald-500/25 bg-emerald-500/8 text-emerald-100/78'}`}>
                  <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                  Revert-safe: disable `NEXT_PUBLIC_VISUAL_BRIEFING` to remove this feature without touching the dashboard.
                </div>

                <div className="mt-4 space-y-2">
                  {frames.map((item, itemIndex) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setIndex(itemIndex)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                        itemIndex === index
                          ? isLight ? 'border-blue-300 bg-blue-50' : 'border-[#3b82f6]/70 bg-[#1e40af]/20'
                          : isLight ? 'border-slate-200 bg-white hover:border-blue-200' : 'border-[#1e3a5f]/40 bg-[#080c14]/55 hover:border-[#3b82f6]/45'
                      }`}
                    >
                      <div className={`text-[9px] font-black uppercase tracking-[0.22em] ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/55'}`}>{item.eyebrow}</div>
                      <div className="mt-1 text-sm font-bold">{item.title}</div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIndex((value) => Math.max(0, value - 1))}
                    disabled={index === 0}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${isLight ? 'border-slate-200 text-slate-700' : 'border-[#1e3a5f] text-[#93c5fd]/75'}`}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setIndex((value) => Math.min(frames.length - 1, value + 1))}
                    disabled={index === frames.length - 1}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${isLight ? 'border-slate-200 text-slate-700' : 'border-[#1e3a5f] text-[#93c5fd]/75'}`}
                  >
                    Next
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
