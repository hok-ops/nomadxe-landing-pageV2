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
    title: 'Site-ready in hours.',
    description:
      'We survey the site remotely, spec the trailer configuration, and pre-configure your platform before we arrive.',
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

const VISUALS = [<RadarCanvas key="radar" />, <DotMatrixScan key="dot" />, <EKGWaveform key="ekg" />];

/* ── HowItWorks Section ──────────────────────────────────────────── */
export default function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let ctx: { revert: () => void } | null = null;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    import('gsap').then(({ gsap }) =>
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);
        ctx = gsap.context(() => {
          const cards = containerRef.current?.querySelectorAll('[data-step-card]');
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
        }, containerRef);
      })
    );

    return () => ctx?.revert();
  }, []);

  return (
    <section
      id="how-it-works"
      className="bg-midnight"
      aria-label="How Nomadxe works"
    >
      <div className="max-w-5xl mx-auto px-8 pt-24 pb-8">
        <div className="mb-16 text-center">
          <p className="font-mono text-xs tracking-widest uppercase text-blue/60 mb-4">Process</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white">How it works</h2>
        </div>
      </div>

      <div ref={containerRef}>
        {STEPS.map((step, idx) => (
          <div
            key={step.number}
            data-step-card
            className={`min-h-screen ${step.bg} rounded-3xl overflow-hidden flex flex-col md:flex-row items-center gap-12 px-8 md:px-20 py-20 relative`}
            aria-label={`Step ${step.number}: ${step.label}`}
          >
            {/* Watermark number — blue */}
            <span
              aria-hidden="true"
              className="absolute top-8 right-8 font-mono font-bold text-blue/10 select-none pointer-events-none"
              style={{ fontSize: '10rem', lineHeight: 1 }}
            >
              {step.number}
            </span>

            {/* Text */}
            <div className="flex-1 z-10">
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-blue mb-4">
                {step.number} — {step.label}
              </p>
              <h3 className="text-3xl md:text-5xl font-bold text-white mb-6">{step.title}</h3>
              <p className="text-lg text-white/60 max-w-md leading-relaxed">{step.description}</p>
            </div>

            {/* Visual */}
            <div className="flex-1 z-10 w-full max-w-md">
              {VISUALS[idx]}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
