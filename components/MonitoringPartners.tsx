'use client';

import { useEffect, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────
type Severity = 'high' | 'med' | 'low';

interface Alert {
  id: number;
  type: string;
  zone: string;
  time: string;
  severity: Severity;
}

interface Detection {
  label: string;
  x: number; // % from left
  y: number; // % from top
  w: number; // % width
  h: number; // % height
}

interface Cam {
  id: string;
  label: string;
  detect: Detection | null;
}

// ── Static data ──────────────────────────────────────────────────────────────
const ALERTS: Alert[] = [
  { id: 1, type: 'Person Detected',  zone: 'Entry Gate',   time: '12:41:03', severity: 'high' },
  { id: 2, type: 'Vehicle Entry',    zone: 'Gate 2',       time: '12:40:51', severity: 'med'  },
  { id: 3, type: 'Perimeter Alert',  zone: 'North Fence',  time: '12:40:29', severity: 'high' },
  { id: 4, type: 'Motion',           zone: 'Zone C',       time: '12:39:55', severity: 'low'  },
  { id: 5, type: 'Zone Breach',      zone: 'Zone A',       time: '12:39:12', severity: 'high' },
];

const CAMS: Cam[] = [
  { id: '01', label: 'ENTRY · GATE',  detect: { label: 'Person · 97%',  x: 28, y: 22, w: 30, h: 56 } },
  { id: '02', label: 'PERIMETER N',   detect: null },
  { id: '03', label: 'ZONE A',        detect: { label: 'Vehicle · 89%', x: 10, y: 36, w: 58, h: 46 } },
  { id: '04', label: 'MAST · WIDE',   detect: null },
];

const PARTNERS = [
  { name: 'Immix',          cat: 'Central Station',        desc: '500+ device integrations, video-verified alarm response' },
  { name: 'Manitou',        cat: 'Monitoring Platform',    desc: 'Enterprise SOC operations & alarm dispatch' },
  { name: 'Rapid Response', cat: 'Professional Monitoring',desc: '24/7 event monitoring with Triangulum AI' },
  { name: 'Axis',           cat: 'Edge Security',          desc: 'Camera platform · Alpha Vision strategic partner' },
  { name: 'Verkada',        cat: 'Cloud VMS',              desc: 'Unified cloud security across distributed sites' },
  { name: 'Milestone',      cat: 'Video Management',       desc: 'XProtect VMS · 14,000+ device integrations' },
  { name: 'Genetec',        cat: 'Unified Security',       desc: 'Security Center · video, access & analytics' },
];

const SEV: Record<Severity, string> = {
  high: 'bg-red-500',
  med:  'bg-amber-400',
  low:  'bg-blue/70',
};

// ── Camera feed card ─────────────────────────────────────────────────────────
function CamFeed({ cam, active }: { cam: Cam; active: boolean }) {
  return (
    <div
      className={`relative overflow-hidden bg-[#080c12] transition-all duration-700 ${
        active ? 'ring-1 ring-inset ring-blue/30' : ''
      }`}
      style={{ aspectRatio: '16/9' }}
    >
      {/* Scene: dark background with subtle lens vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 130% 90% at 50% 65%, #111b2e 0%, #070b11 80%)',
        }}
      />

      {/* Scanline texture — surveillance aesthetic */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, #0ea5e9 0, #0ea5e9 1px, transparent 1px, transparent 4px)',
        }}
      />

      {/* Ground-plane tint */}
      <div
        className="absolute bottom-0 inset-x-0 h-2/5 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(14,165,233,0.05), transparent)' }}
      />

      {/* AI scanning line — only on active cam */}
      {active && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 h-px bg-blue/40 pointer-events-none animate-scanH"
          style={{ boxShadow: '0 0 6px rgba(14,165,233,0.6)' }}
        />
      )}

      {/* Detection bounding box */}
      {cam.detect && (
        <div
          className="absolute transition-all duration-1000"
          style={{
            left:   `${cam.detect.x}%`,
            top:    `${cam.detect.y}%`,
            width:  `${cam.detect.w}%`,
            height: `${cam.detect.h}%`,
          }}
        >
          {/* Main border */}
          <div
            className="absolute inset-0 border border-blue"
            style={{ boxShadow: '0 0 8px rgba(14,165,233,0.5), inset 0 0 8px rgba(14,165,233,0.08)' }}
          />
          {/* Corner brackets */}
          <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-blue" />
          <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-blue" />
          <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-blue" />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-blue" />
          {/* Label */}
          <span
            className="absolute -top-[18px] left-0 font-mono text-[8px] px-1.5 py-px text-midnight whitespace-nowrap"
            style={{ background: '#0EA5E9' }}
          >
            {cam.detect.label}
          </span>
        </div>
      )}

      {/* Camera ID + REC */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
        <span className="font-mono text-[8px] tracking-widest text-white/35 uppercase">{cam.label}</span>
      </div>
      <span className="absolute top-2 right-2 font-mono text-[8px] text-white/20">REC</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MonitoringPartners() {
  const [activeAlert, setActiveAlert] = useState(0);
  const [activeCam,   setActiveCam]   = useState(0);

  useEffect(() => {
    const t1 = setInterval(() => setActiveAlert(a => (a + 1) % ALERTS.length), 2600);
    const t2 = setInterval(() => setActiveCam(c   => (c + 1) % CAMS.length),   4200);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  return (
    <section
      id="partners"
      className="bg-midnight py-28 px-6 md:px-8"
      aria-label="Monitoring partners"
    >
      <div className="max-w-6xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="text-center mb-16">
          <p className="font-mono text-xs tracking-widest uppercase text-blue/60 mb-4">Network</p>
          <h2 className="text-3xl md:text-4xl font-sans font-bold tracking-tight text-white">
            We work with leading monitoring partners —{' '}
            <span className="text-blue">or yours.</span>
          </h2>
          <p className="mt-5 text-white/50 max-w-2xl mx-auto leading-relaxed">
            Nomadxe integrates with your preferred monitoring station. If you don&apos;t have one,
            we&apos;ll connect you with a vetted partner from our network. Every trailer runs{' '}
            <a
              href="https://alphavision.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue/80 hover:text-blue transition-colors duration-200 underline underline-offset-2 decoration-blue/30"
            >
              Alpha Vision AGI7
            </a>
            {' '}— a Physical AI platform that autonomously patrols, deters, and investigates
            before an alert even reaches your station.
          </p>
        </div>

        {/* ── Alpha Vision Featured Card ──────────────────────────── */}
        <div className="mb-16 rounded-2xl border border-white/[0.07] bg-surface overflow-hidden shadow-[0_24px_64px_-12px_rgba(14,165,233,0.18)]">
          <div className="flex flex-col lg:flex-row">

            {/* Platform UI Preview ── left panel */}
            <div className="flex-1 bg-[#07090f] border-b lg:border-b-0 lg:border-r border-white/[0.06] flex flex-col">

              {/* Status bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-[#05070d] flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"
                    style={{ boxShadow: '0 0 7px rgba(52,211,153,0.85)' }}
                  />
                  <span className="font-mono text-[10px] tracking-[0.16em] text-white/50 uppercase">
                    Live · 4 Cameras · AI Active
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[10px] text-white/22">NX-07 · DEPLOYED</span>
                  <span className="font-mono text-[10px] text-white/22">12:41:09</span>
                </div>
              </div>

              {/* Camera grid + alert panel */}
              <div className="flex flex-1 min-h-0">

                {/* 2 × 2 grid */}
                <div className="flex-1 grid grid-cols-2 gap-px bg-black/70 min-w-0">
                  {CAMS.map((cam, i) => (
                    <CamFeed key={cam.id} cam={cam} active={activeCam === i} />
                  ))}
                </div>

                {/* Alert panel */}
                <div className="w-44 flex-shrink-0 bg-[#05070d] border-l border-white/[0.06] flex flex-col">
                  <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
                    <span className="font-mono text-[9px] tracking-widest text-white/30 uppercase">AI Alerts</span>
                    <span className="font-mono text-[9px] text-blue/50">{ALERTS.length} active</span>
                  </div>

                  {/* Alert list */}
                  <div className="flex-1 overflow-hidden flex flex-col">
                    {ALERTS.map((alert, i) => (
                      <div
                        key={alert.id}
                        className={`flex-1 px-3 py-2 border-b border-white/[0.04] transition-colors duration-500 flex flex-col justify-center ${
                          activeAlert === i ? 'bg-blue/[0.07]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`w-1.5 h-1.5 flex-shrink-0 rounded-full ${SEV[alert.severity]}`} />
                          <span className="font-mono text-[9px] text-white/65 truncate">{alert.type}</span>
                        </div>
                        <div className="flex items-center justify-between pl-3">
                          <span className="font-mono text-[8px] text-white/28 truncate">{alert.zone}</span>
                          <span className="font-mono text-[8px] text-white/18 flex-shrink-0 ml-1">{alert.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Agent status */}
                  <div className="px-3 py-3 border-t border-white/[0.06] flex-shrink-0">
                    <div className="font-mono text-[8px] text-white/22 uppercase tracking-widest mb-2">Agents Online</div>
                    {['Inspect', 'Deter', 'Investigate'].map(agent => (
                      <div key={agent} className="flex items-center gap-1.5 mb-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"
                          style={{ boxShadow: '0 0 4px rgba(52,211,153,0.7)' }}
                        />
                        <span className="font-mono text-[8px] text-white/38">{agent}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Description ── right panel */}
            <div className="lg:w-80 xl:w-96 p-8 flex flex-col justify-center gap-0">
              <div className="flex items-center gap-2 mb-5">
                <span className="relative inline-flex w-2 h-2 flex-shrink-0">
                  <span className="absolute inline-block w-2 h-2 rounded-full bg-blue animate-pulseRing" />
                  <span className="relative inline-block w-2 h-2 rounded-full bg-blue" />
                </span>
                <span className="font-mono text-[10px] tracking-widest text-blue/65 uppercase">
                  Featured AI Platform
                </span>
              </div>

              <h3 className="text-2xl font-sans font-bold text-white tracking-tight mb-1">
                Alpha Vision AGI7
              </h3>
              <p className="font-mono text-[11px] tracking-wider text-white/35 uppercase mb-6">
                Physical AI Platform · AGI7 Inc.
              </p>

              <p className="text-sm text-white/55 leading-relaxed mb-6">
                Every NomadXE trailer ships integrated with Alpha Vision&apos;s Physical AI platform.
                Autonomous agents detect, assess, and deter threats at the edge — before they
                escalate to your monitoring station.
              </p>

              <div className="space-y-3.5 mb-7">
                {[
                  { label: 'AI Inspector',         desc: 'Autonomous PTZ patrol & real-time object detection' },
                  { label: 'AI Deterrence Agent',  desc: 'Responds to threats with automated audio warnings'  },
                  { label: 'AI Investigator',      desc: 'Natural language & image search across all footage' },
                  { label: 'Automated Reporting',  desc: 'Daily intelligence summaries & incident timelines'  },
                ].map(f => (
                  <div key={f.label} className="flex gap-3">
                    <span className="mt-[5px] w-1.5 h-1.5 flex-shrink-0 rounded-full bg-blue/55" />
                    <div>
                      <div className="text-sm font-semibold text-white/80 leading-tight">{f.label}</div>
                      <div className="text-xs text-white/38 leading-snug mt-0.5">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mb-7">
                {['Backed by NEC', 'Axis Partner', 'NDAA Compliant'].map(tag => (
                  <span
                    key={tag}
                    className="font-mono text-[9px] tracking-wider text-white/28 border border-white/10 rounded-full px-2.5 py-1 uppercase"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <a
                href="https://alphavision.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue hover:text-blue-light transition-colors duration-200 group w-fit"
                aria-label="Learn about the Alpha Vision AGI7 platform (opens in new tab)"
              >
                Learn about the platform
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </a>
            </div>
          </div>
        </div>

        {/* ── Monitoring Partner Grid ─────────────────────────────── */}
        <div className="mb-14">
          <p className="text-center font-mono text-[10px] tracking-widest uppercase text-white/22 mb-8">
            Compatible monitoring platforms &amp; stations
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {PARTNERS.map(p => (
              <div
                key={p.name}
                className="group rounded-xl border border-white/[0.06] bg-surface/60 p-4 hover:border-blue/30 hover:bg-surface transition-all duration-300"
              >
                <div className="font-sans font-bold text-white/65 text-[15px] group-hover:text-white transition-colors duration-300 mb-1">
                  {p.name}
                </div>
                <div className="font-mono text-[9px] tracking-wider text-blue/45 uppercase mb-2">
                  {p.cat}
                </div>
                <div className="text-[11px] text-white/28 leading-snug">
                  {p.desc}
                </div>
              </div>
            ))}

            {/* "Bring Your Own" tile */}
            <div className="group rounded-xl border border-dashed border-white/[0.08] p-4 hover:border-blue/25 transition-all duration-300">
              <div className="font-sans font-bold text-white/28 text-[15px] group-hover:text-white/50 transition-colors duration-300 mb-1">
                Yours
              </div>
              <div className="font-mono text-[9px] tracking-wider text-white/18 uppercase mb-2">
                Bring Your Own
              </div>
              <div className="text-[11px] text-white/20 leading-snug">
                Already have a monitoring station? We integrate with your existing stack.
              </div>
            </div>
          </div>
        </div>

        {/* ── CTA ────────────────────────────────────────────────── */}
        <div className="text-center">
          <a
            href="#contact"
            className="inline-flex items-center border border-white/20 text-white font-semibold rounded-full px-8 py-3 text-sm transition-all duration-300 hover:border-blue hover:text-blue hover:scale-[1.02] active:scale-[0.98]"
            aria-label="Talk to us about monitoring partners"
          >
            Talk to Us About Partners
          </a>
        </div>

      </div>
    </section>
  );
}
