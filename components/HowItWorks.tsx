'use client';

import { useLayoutEffect, useRef, useEffect, useState } from 'react';

/* ── Canvas: Radar Sweep (Card 1) ────────────────────────────────── */
function RadarCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let angle = 0;
    let running = false;

    const draw = () => {
      if (!running || !canvas || !ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const r = Math.min(cx, cy) - 8;

      ctx.fillStyle = 'rgba(11, 12, 16, 0.12)';
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(26, 28, 34, 0.8)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 24) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Radar circles — blue
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.15)';
      ctx.lineWidth = 1;
      [1, 0.75, 0.5].forEach((frac) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r * frac, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Sweep line — blue
      const ex = cx + Math.cos(angle) * r;
      const ey = cy + Math.sin(angle) * r;
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Glow dot
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#0EA5E9';
      ctx.fill();

      angle += 0.025;
      rafRef.current = requestAnimationFrame(draw);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (running) rafRef.current = requestAnimationFrame(draw);
        else cancelAnimationFrame(rafRef.current);
      },
      { threshold: 0.3 }
    );
    observer.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={220}
      className="w-full max-w-md mx-auto rounded-xl"
      aria-hidden="true"
    />
  );
}

/* ── SVG: EKG Waveform (Card 3) ──────────────────────────────────── */
function EKGWaveform() {
  const pathRef = useRef<SVGPathElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    let running = false;
    let rafId: number;
    let progress = 0;
    const TOTAL_LENGTH = 600;

    const animate = () => {
      if (!running) return;
      progress = (progress + 2) % (TOTAL_LENGTH + 100);
      path.style.strokeDashoffset = String(TOTAL_LENGTH - progress);
      rafId = requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (running) rafId = requestAnimationFrame(animate);
        else cancelAnimationFrame(rafId);
      },
      { threshold: 0.3 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { running = false; cancelAnimationFrame(rafId); observer.disconnect(); };
  }, []);

  return (
    <div ref={containerRef} className="flex justify-center" aria-hidden="true">
      <svg width="320" height="100" viewBox="0 0 320 100" className="w-full max-w-md">
        <path
          d="M 0 60 L 40 60 L 55 60 L 65 20 L 75 90 L 85 40 L 95 60 L 140 60 L 155 60 L 165 20 L 175 90 L 185 40 L 195 60 L 240 60 L 255 60 L 265 20 L 275 90 L 285 40 L 295 60 L 320 60"
          fill="none"
          stroke="rgba(14,165,233,0.15)"
          strokeWidth="1.5"
        />
        <path
          ref={pathRef}
          d="M 0 60 L 40 60 L 55 60 L 65 20 L 75 90 L 85 40 L 95 60 L 140 60 L 155 60 L 165 20 L 175 90 L 185 40 L 195 60 L 240 60 L 255 60 L 265 20 L 275 90 L 285 40 L 295 60 L 320 60"
          fill="none"
          stroke="#0EA5E9"
          strokeWidth="2"
          strokeDasharray="600"
          strokeDashoffset="600"
        />
      </svg>
    </div>
  );
}

/* ── SVG: Dot Matrix (Card 2) ────────────────────────────────────── */
function DotMatrixScan() {
  const COLS = 12;
  const ROWS = 6;
  const SPACING = 22;
  const [scanned, setScanned] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;
    let row = -1;
    let lastTime = 0;
    const INTERVAL = 400;
    let running = false;

    const tick = (ts: number) => {
      if (!running) return;
      if (ts - lastTime >= INTERVAL) {
        lastTime = ts;
        row++;
        setScanned(row);
        if (row >= ROWS) {
          setTimeout(() => { row = -1; setScanned(-1); }, 2000);
        }
      }
      if (row < ROWS) {
        rafId = requestAnimationFrame(tick);
      } else {
        setTimeout(() => { rafId = requestAnimationFrame(tick); }, 2100);
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (running) rafId = requestAnimationFrame(tick);
        else { cancelAnimationFrame(rafId); row = -1; setScanned(-1); }
      },
      { threshold: 0.3 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { running = false; cancelAnimationFrame(rafId); observer.disconnect(); };
  }, []);

  return (
    <div ref={containerRef} className="flex justify-center" aria-hidden="true">
      <svg
        width={COLS * SPACING + 8}
        height={ROWS * SPACING + 8}
        viewBox={`0 0 ${COLS * SPACING + 8} ${ROWS * SPACING + 8}`}
      >
        {Array.from({ length: ROWS }).map((_, r) =>
          Array.from({ length: COLS }).map((_, c) => (
            <circle
              key={`${r}-${c}`}
              cx={c * SPACING + 20}
              cy={r * SPACING + 20}
              r={4}
              fill={r <= scanned ? '#0EA5E9' : '#1a1c22'}
              style={{ transition: 'fill 300ms ease' }}
            />
          ))
        )}
      </svg>
    </div>
  );
}

/* ── Steps data ───────────────────────────────────────────────────── */
const STEPS = [
  {
    number: '01',
    label: 'Configure',
    title: 'Dialed in before dispatch.',
    description:
      'We spec the trailer configuration and pre-configure your platform to match the job — so by the time a trailer rolls out, everything is already wired to work.',
    bg: 'bg-surface',
  },
  {
    number: '02',
    label: 'Deploy',
    title: 'Position. Connect. Go.',
    description:
      'Our team positions the trailer, establishes power (solar, shore, or generator), and brings all cameras online.',
    bg: 'bg-midnight',
  },
  {
    number: '03',
    label: 'Monitor',
    title: '24/7 visibility from day one.',
    description:
      'Your monitoring partner receives live feeds, motion alerts, and AI-augmented event reports in real time.',
    bg: 'bg-surface',
  },
];

const VISUAL_COMPONENTS = [RadarCanvas, DotMatrixScan, EKGWaveform] as const;

/* ── HowItWorks Section ──────────────────────────────────────────── */
export default function HowItWorks() {
  const mobileRef = useRef<HTMLDivElement>(null);
  const desktopRef = useRef<HTMLDivElement>(null);

  // ── Mobile: stacked scroll-pin experience (user said mobile is perfect) ──
  useLayoutEffect(() => {
    let ctx: { revert: () => void } | null = null;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    // Only run pin logic for mobile viewport
    if (window.matchMedia('(min-width: 768px)').matches) return;

    import('gsap').then(({ gsap }) =>
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);
        ctx = gsap.context(() => {
          const cards = mobileRef.current?.querySelectorAll('[data-step-card]');
          if (!cards) return;
          cards.forEach((card, i) => {
            if (i === cards.length - 1) {
              ScrollTrigger.create({
                trigger: card as Element,
                start: 'top top',
                end: `+=${window.innerHeight * 0.5}`,
                pin: true,
                pinSpacing: true,
              });
              return;
            }
            gsap.to(card, {
              scale: 0.93,
              filter: 'blur(12px)',
              opacity: 0.4,
              ease: 'none',
              scrollTrigger: {
                trigger: card as Element,
                start: 'top top',
                end: `+=${window.innerHeight * 0.7}`,
                scrub: true,
                pin: true,
                pinSpacing: false,
              },
            });
          });
        }, mobileRef);
      })
    );

    return () => ctx?.revert();
  }, []);

  // ── Desktop: light scroll-triggered reveal, no pinning ──
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const cards = desktopRef.current?.querySelectorAll<HTMLElement>('[data-step-desktop]') ?? [];
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
    cards.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(32px)';
      el.style.transition = `opacity 0.6s cubic-bezier(.22,1,.36,1) ${i * 0.12}s, transform 0.6s cubic-bezier(.22,1,.36,1) ${i * 0.12}s`;
      obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <section
      id="how-it-works"
      className="bg-midnight"
      aria-label="How Nomadxe works"
    >
      <div className="max-w-6xl mx-auto px-8 pt-24 pb-8">
        <div className="mb-12 md:mb-16 text-center">
          <p className="font-mono text-xs tracking-widest uppercase text-blue/60 mb-4">Process</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white">How it works</h2>
          <p className="hidden md:block mt-4 text-white/55 max-w-2xl mx-auto leading-relaxed">
            Remote configuration, rapid deployment, and 24/7 monitoring — a three-step process,
            condensed to hours.
          </p>
        </div>
      </div>

      {/* ── Mobile (<md): scroll-pinned full-screen cards ── */}
      <div ref={mobileRef} className="md:hidden">
        {STEPS.map((step, idx) => {
          const Visual = VISUAL_COMPONENTS[idx];
          return (
            <div
              key={step.number}
              data-step-card
              className={`min-h-screen ${step.bg} rounded-3xl overflow-hidden flex flex-col items-center gap-12 px-8 py-20 relative`}
              aria-label={`Step ${step.number}: ${step.label}`}
            >
              <span
                aria-hidden="true"
                className="absolute top-8 right-8 font-mono font-bold text-blue/10 select-none pointer-events-none"
                style={{ fontSize: '10rem', lineHeight: 1 }}
              >
                {step.number}
              </span>
              <div className="flex-1 z-10">
                <p className="font-mono text-xs tracking-[0.3em] uppercase text-blue mb-4">
                  {step.number} — {step.label}
                </p>
                <h3 className="text-3xl font-bold text-white mb-6">{step.title}</h3>
                <p className="text-lg text-white/60 max-w-md leading-relaxed">{step.description}</p>
              </div>
              <div className="flex-1 z-10 w-full max-w-md">
                <Visual />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop (≥md): compact 3-column timeline, one viewport ── */}
      <div ref={desktopRef} className="hidden md:block max-w-6xl mx-auto px-8 pb-24">
        <div className="relative grid md:grid-cols-3 gap-6 lg:gap-8">

          {/* Connector rail behind the cards */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-[22%] left-[16.5%] right-[16.5%] h-px"
            style={{
              background:
                'linear-gradient(to right, transparent, rgba(14,165,233,0.35) 20%, rgba(14,165,233,0.35) 80%, transparent)',
            }}
          />

          {STEPS.map((step, idx) => {
            const Visual = VISUAL_COMPONENTS[idx];
            return (
              <div
                key={step.number}
                data-step-desktop
                className={`relative ${step.bg} rounded-2xl border border-white/5 p-7 lg:p-8 flex flex-col gap-5 transition-all duration-300 hover:border-blue/30 hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-30px_rgba(14,165,233,0.35)]`}
                aria-label={`Step ${step.number}: ${step.label}`}
              >
                {/* Numbered marker */}
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center w-9 h-9 rounded-full font-mono text-xs font-bold text-midnight"
                      style={{
                        backgroundColor: '#0EA5E9',
                        boxShadow: '0 0 16px rgba(14,165,233,0.45)',
                      }}
                      aria-hidden="true"
                    >
                      {step.number}
                    </div>
                    <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-blue">
                      {step.label}
                    </p>
                  </div>
                </div>

                {/* Visual */}
                <div className="flex items-center justify-center min-h-[140px]">
                  <Visual />
                </div>

                {/* Copy */}
                <div>
                  <h3 className="text-xl lg:text-2xl font-bold text-white mb-2 leading-tight">
                    {step.title}
                  </h3>
                  <p className="text-sm text-white/55 leading-relaxed">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
