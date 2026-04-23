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
    <div ref={containerRef} className="bg-surface border border-white/5 rounded-2xl p-8 shadow-2xl border-t-2 border-t-blue/30 flex flex-col gap-6" aria-label="Diagnostic Shuffler feature card">
      <div className="font-mono text-xs tracking-widest uppercase text-blue/70">01 — Your Setup</div>
      <h3 className="text-xl font-bold text-white">Your Setup. Our Base.</h3>
      <p className="text-sm text-white/50 leading-relaxed">
        Plug in what you already own. Our platform wraps around your existing cameras and NVR — no rip-and-replace.
      </p>
      {/* Stacked cards */}
      <div className="relative h-28 mt-2" aria-live="polite" aria-label={`Currently showing: ${SETUP_CARDS[active]}`}>
        {SETUP_CARDS.map((label, i) => {
          const offset = i - active;
          const isActive = i === active;
          return (
            <div
              key={label}
              className="absolute inset-x-0 rounded-xl border border-white/10 px-6 py-4 font-mono text-sm text-white/80 bg-midnight"
              style={{
                transform: `translateY(${offset * 10}px) scale(${isActive ? 1 : 0.95 - Math.abs(offset) * 0.03})`,
                opacity: isActive ? 1 : Math.max(0, 0.4 - Math.abs(offset) * 0.15),
                zIndex: SETUP_CARDS.length - Math.abs(offset),
                transition: 'transform 500ms ease, opacity 500ms ease',
              }}
            >
              {label}
            </div>
          );
        })}
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
    <div ref={containerRef} className="bg-surface border border-white/5 rounded-2xl p-8 shadow-2xl border-t-2 border-t-blue/30 flex flex-col gap-6" aria-label="Telemetry typewriter feature card">
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
    <div ref={containerRef} className="bg-surface border border-white/5 rounded-2xl p-8 shadow-2xl border-t-2 border-t-blue/30 flex flex-col gap-6" aria-label="Deployment scheduler feature card">
      <div className="font-mono text-xs tracking-widest uppercase text-blue/70">03 — Deployment</div>
      <h3 className="text-xl font-bold text-white">Done-For-You Deployment.</h3>
      <p className="text-sm text-white/50 leading-relaxed">
        We handle site survey, trailer positioning, platform configuration, and partner handoff. You get a live site.
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
    return () => obs.disconnect();
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
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Built for the site that{' '}
            <em className="font-display italic text-blue not-italic">can&apos;t wait.</em>
          </h2>
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
