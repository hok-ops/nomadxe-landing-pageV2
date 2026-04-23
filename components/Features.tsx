'use client';

import { useEffect, useRef, useState } from 'react';

/* ── Card 1: Diagnostic Shuffler ─────────────────────────────────── */
const SETUP_CARDS = ['YOUR CAMERAS', 'YOUR NVR', 'YOUR PLATFORM'];

function DiagnosticShuffler() {
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;
    let lastTime = 0;
    const INTERVAL = 3000;
    let running = true;

    const tick = (ts: number) => {
      if (!running) return;
      if (ts - lastTime >= INTERVAL) {
        lastTime = ts;
        setActive((a) => (a + 1) % SETUP_CARDS.length);
      }
      rafId = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (running) rafId = requestAnimationFrame(tick);
        else cancelAnimationFrame(rafId);
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} data-feature-tile className="group relative bg-surface border border-white/5 rounded-2xl p-8 shadow-2xl border-t-2 border-t-blue/40 flex flex-col gap-6 transition-all duration-500 hover:border-blue/30 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(14,165,233,0.35)]" aria-label="Diagnostic Shuffler feature card">
      <div className="font-mono text-xs tracking-widest uppercase text-blue/70">01 — Your Setup</div>
      <h3 className="text-xl font-bold text-white">Your Setup. Our Base.</h3>
      <p className="text-sm text-white/50 leading-relaxed">
        Plug in what you already own. Our platform wraps around your existing cameras and NVR — no rip-and-replace.
      </p>
      {/* Wrap-around diagram — existing gear nodes feeding a central NOMADXE hub. */}
      <div className="relative mt-1" aria-live="polite" aria-label={`Currently connecting: ${SETUP_CARDS[active]}`}>
        <svg viewBox="0 0 280 150" className="w-full" aria-hidden="true">
          <defs>
            <linearGradient id="setup-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Three source nodes on the left */}
          {SETUP_CARDS.map((label, i) => {
            const y = 20 + i * 45;
            const isActive = i === active;
            return (
              <g key={label}>
                <rect
                  x={6} y={y - 12} width={86} height={24} rx={12}
                  fill={isActive ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.03)'}
                  stroke={isActive ? '#0EA5E9' : 'rgba(255,255,255,0.1)'}
                  strokeWidth={1}
                  style={{ transition: 'all 500ms ease' }}
                />
                <text
                  x={49} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                  fill={isActive ? '#0EA5E9' : 'rgba(255,255,255,0.45)'}
                  fontSize="8" fontFamily="var(--font-jetbrains), monospace" letterSpacing="1"
                  style={{ transition: 'all 500ms ease' }}
                >
                  {label}
                </text>
                <line
                  x1={92} y1={y} x2={180} y2={75}
                  stroke={isActive ? 'url(#setup-line)' : 'rgba(255,255,255,0.08)'}
                  strokeWidth={isActive ? 1.5 : 1}
                  strokeDasharray={isActive ? '0' : '3 3'}
                  style={{ transition: 'all 500ms ease' }}
                />
              </g>
            );
          })}

          {/* Central NomadXE hub */}
          <g>
            <circle cx={210} cy={75} r={32} fill="rgba(14,165,233,0.08)" stroke="rgba(14,165,233,0.25)" strokeWidth={1} />
            <circle cx={210} cy={75} r={22} fill="#0B0C10" stroke="#0EA5E9" strokeWidth={1.5} />
            <text x={210} y={72} textAnchor="middle" fill="#0EA5E9" fontSize="6.5" fontFamily="var(--font-jetbrains), monospace" letterSpacing="1.5">NOMADXE</text>
            <text x={210} y={82} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="5.5" fontFamily="var(--font-jetbrains), monospace" letterSpacing="1">PLATFORM</text>
          </g>

          {/* Output chip — live */}
          <g>
            <rect x={244} y={63} width={30} height={24} rx={4} fill="rgba(14,165,233,0.12)" stroke="rgba(14,165,233,0.4)" strokeWidth={0.8} />
            <text x={259} y={72} textAnchor="middle" fill="#0EA5E9" fontSize="5.5" fontFamily="var(--font-jetbrains), monospace" letterSpacing="1">LIVE</text>
            <text x={259} y={82} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="5" fontFamily="var(--font-jetbrains), monospace">24/7</text>
          </g>
        </svg>
      </div>
    </div>
  );
}

/* ── Card 2: Telemetry Typewriter ────────────────────────────────── */
const EVENTS = [
  '[ 08:42:01 ] Motion detected — Zone 4 (NW Gate)',
  '[ 08:42:03 ] Alert routed to monitoring partner',
  '[ 08:42:08 ] Operator acknowledged — ETA 4 min',
  '[ 08:42:15 ] Camera 07 offline — auto-failover',
  '[ 08:42:17 ] Backup stream active (Camera 07B)',
  '[ 08:43:01 ] Perimeter secure — all zones nominal',
  '[ 08:45:22 ] Daily report generated and dispatched',
  '[ 08:47:11 ] System health: 100% — 14 cameras live',
];

function TelemetryTypewriter() {
  const [lines, setLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let lineIdx = 0;
    let charIdx = 0;
    let rafId: number;
    let lastTime = 0;
    let running = false;

    const tick = (ts: number) => {
      if (!running) return;
      if (ts - lastTime >= 35) {
        lastTime = ts;
        const sourceLine = EVENTS[lineIdx % EVENTS.length];
        if (charIdx < sourceLine.length) {
          setCurrentLine(sourceLine.slice(0, charIdx + 1));
          charIdx++;
        } else {
          setLines((prev) => [...prev.slice(-5), sourceLine]);
          setCurrentLine('');
          lineIdx++;
          charIdx = 0;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (running) rafId = requestAnimationFrame(tick);
        else cancelAnimationFrame(rafId);
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [lines, currentLine]);

  return (
    <div ref={containerRef} data-feature-tile className="group relative bg-surface border border-white/5 rounded-2xl p-8 shadow-2xl border-t-2 border-t-blue/40 flex flex-col gap-6 transition-all duration-500 hover:border-blue/30 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(14,165,233,0.35)]" aria-label="Telemetry typewriter feature card">
      <div className="font-mono text-xs tracking-widest uppercase text-blue/70">02 — Intelligence</div>
      <h3 className="text-xl font-bold text-white">Intelligence, Not Just Footage.</h3>
      <p className="text-sm text-white/50 leading-relaxed -mt-4">
        Powered by <a href="https://alphavision.ai/" target="_blank" rel="noopener noreferrer" className="text-blue transition-colors hover:text-white">AlphaVision AGI7</a>
      </p>
      {/* Live feed header */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue animate-pulse" aria-hidden="true" />
        <span className="font-mono text-xs text-blue/80 tracking-widest uppercase">Live Feed</span>
      </div>
      {/* Feed */}
      <div
        ref={feedRef}
        className="bg-midnight/50 rounded-lg p-4 font-mono text-xs h-32 overflow-hidden flex flex-col gap-1"
        aria-live="polite"
        aria-label="Live telemetry feed"
      >
        {lines.map((line, i) => (
          <div key={line.slice(0,24) + i} className="text-white/40">{line}</div>
        ))}
        <div className="text-white/80">
          {currentLine}
          <span
            className="inline-block w-px h-3 bg-blue/80 ml-0.5 align-middle"
            style={{ animation: 'type-cursor-blink 1s step-end infinite' }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

/* ── Card 3: Deployment Scheduler ────────────────────────────────── */
const NODES = ['TRAILER', 'PLATFORM', 'PARTNER'];

function DeploymentScheduler() {
  const [activeNode, setActiveNode] = useState(-1);
  const [allDone, setAllDone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;
    let lastTime = 0;
    const STEP_DURATION = 1800;
    let stepIdx = 0;
    let running = false;

    const tick = (ts: number) => {
      if (!running) return;
      if (ts - lastTime >= STEP_DURATION) {
        lastTime = ts;
        if (stepIdx < NODES.length) {
          setActiveNode(stepIdx);
          stepIdx++;
        } else {
          setAllDone(true);
          setTimeout(() => {
            stepIdx = 0;
            setActiveNode(-1);
            setAllDone(false);
          }, 3000);
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (running) rafId = requestAnimationFrame(tick);
        else {
          cancelAnimationFrame(rafId);
          stepIdx = 0;
          setActiveNode(-1);
          setAllDone(false);
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} data-feature-tile className="group relative bg-surface border border-white/5 rounded-2xl p-8 shadow-2xl border-t-2 border-t-blue/40 flex flex-col gap-6 transition-all duration-500 hover:border-blue/30 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(14,165,233,0.35)]" aria-label="Deployment scheduler feature card">
      <div className="font-mono text-xs tracking-widest uppercase text-blue/70">03 — Deployment</div>
      <h3 className="text-xl font-bold text-white">Done-For-You Deployment.</h3>
      <p className="text-sm text-white/50 leading-relaxed">
        We handle trailer positioning, platform configuration, and partner handoff. You get a live site — site assessment only where needed.
      </p>
      {/* SVG timeline */}
      <svg viewBox="0 0 280 80" className="w-full" aria-hidden="true">
        <line x1="80" y1="32" x2="140" y2="32" stroke="#ffffff20" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="200" y1="32" x2="260" y2="32" stroke="#ffffff20" strokeWidth="1.5" strokeDasharray="4 3" />
        {activeNode >= 1 && (
          <line x1="80" y1="32" x2="140" y2="32" stroke="#0EA5E9" strokeWidth="1.5"
            style={{ transition: 'all 600ms ease' }} />
        )}
        {activeNode >= 2 && (
          <line x1="200" y1="32" x2="260" y2="32" stroke="#0EA5E9" strokeWidth="1.5"
            style={{ transition: 'all 600ms ease' }} />
        )}
        {NODES.map((label, i) => {
          const x = 20 + i * 120;
          const isActive = i <= activeNode;
          return (
            <g key={label}>
              <circle
                cx={x} cy={32} r={14}
                fill={isActive ? '#0EA5E9' : '#13151A'}
                stroke={isActive ? '#0EA5E9' : '#ffffff20'}
                strokeWidth="1.5"
                style={{ transition: 'all 600ms ease' }}
              />
              <text
                x={x} y={32}
                textAnchor="middle" dominantBaseline="middle"
                fill={isActive ? '#0B0C10' : '#ffffff40'}
                fontSize="8" fontFamily="monospace" fontWeight="bold"
                style={{ transition: 'all 600ms ease' }}
              >
                {i + 1}
              </text>
              <text
                x={x} y={56}
                textAnchor="middle"
                fill={isActive ? '#0EA5E9' : '#ffffff30'}
                fontSize="7" fontFamily="monospace"
                style={{ transition: 'all 600ms ease' }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        className="font-mono text-xs tracking-widest uppercase text-blue text-center"
        style={{
          opacity: allDone ? 1 : 0,
          transform: allDone ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 600ms ease, transform 600ms ease',
        }}
        aria-live="polite"
      >
        ✓ READY TO DEPLOY
      </div>
    </div>
  );
}

/* ── Features Section ────────────────────────────────────────────── */
export default function Features() {
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const revealEls: HTMLElement[] = [];
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.opacity = '1';
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    [headerRef.current, gridRef.current].forEach((el, i) => {
      if (!el) return;
      el.style.opacity = '0';
      el.style.transform = 'translateY(28px)';
      el.style.transition = `opacity 0.65s cubic-bezier(.22,1,.36,1) ${i * 0.15}s, transform 0.65s cubic-bezier(.22,1,.36,1) ${i * 0.15}s`;
      revealEls.push(el);
      obs.observe(el);
    });

    // Per-tile staggered entrance
    const tiles = gridRef.current?.querySelectorAll<HTMLElement>('[data-feature-tile]') ?? [];
    const tileObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.opacity = '1';
            (e.target as HTMLElement).style.transform = 'translateY(0) scale(1)';
            tileObs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    tiles.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px) scale(0.985)';
      el.style.transition = `opacity 0.7s cubic-bezier(.22,1,.36,1) ${0.15 + i * 0.12}s, transform 0.7s cubic-bezier(.22,1,.36,1) ${0.15 + i * 0.12}s`;
      tileObs.observe(el);
    });

    return () => {
      obs.disconnect();
      tileObs.disconnect();
    };
  }, []);

  return (
    <section
      id="solutions"
      className="bg-midnight py-24 px-8"
      aria-label="Platform features"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div ref={headerRef} className="mb-16 text-center">
          <p className="font-mono text-xs tracking-widest uppercase text-blue/60 mb-4">
            Platform Capabilities
          </p>
          <h2 className="text-4xl md:text-5xl font-sans font-bold tracking-tight text-white leading-tight">
            Built for the site that <span className="text-blue">can&apos;t wait.</span>
          </h2>
          <p className="mt-5 text-white/55 text-base max-w-xl mx-auto">
            Three capabilities that turn a rollout timeline from weeks into a single mobilization day.
          </p>
        </div>
        {/* Cards grid */}
        <div ref={gridRef} className="grid md:grid-cols-3 gap-8">
          <DiagnosticShuffler />
          <TelemetryTypewriter />
          <DeploymentScheduler />
        </div>
      </div>
    </section>
  );
}
