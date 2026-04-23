'use client';

import { useEffect, useRef, useState } from 'react';

const STATS = [
  { target: 2,    suffix: 'h',  label: 'Deploy Time'    },
  { target: 14,   suffix: '',   label: 'Cameras / Unit'  },
  { target: 99.8, suffix: '%',  label: 'Uptime SLA'     },
  { target: 24,   suffix: '/7', label: 'Monitoring'      },
];

function Counter({ target, suffix, label, delay }: { target: number; suffix: string; label: string; delay: number }) {
  const [val, setVal]     = useState(0);
  const [started, setStarted] = useState(false);
  const ref               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.5 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => {
      const duration = 1400;
      const steps    = 60;
      const inc      = target / steps;
      let cur        = 0;
      let step       = 0;
      const id = setInterval(() => {
        step++;
        cur = Math.min(target, inc * step);
        setVal(cur);
        if (cur >= target) clearInterval(id);
      }, duration / steps);
      return () => clearInterval(id);
    }, delay);
    return () => clearTimeout(t);
  }, [started, target, delay]);

  const display = target % 1 !== 0 ? val.toFixed(1) : Math.round(val).toString();

  return (
    <div ref={ref} className="px-6 py-5 text-center border-r border-[#0ea5e9]/10 last:border-r-0 flex-1">
      <div className="text-3xl font-black font-mono text-[#0ea5e9] leading-none tabular-nums">
        {display}<span className="text-xl opacity-70">{suffix}</span>
      </div>
      <div className="mt-1.5 font-mono text-[9px] tracking-widest uppercase text-white/35">{label}</div>
    </div>
  );
}

export default function StatsBar() {
  return (
    <div className="bg-[#0b0c10]/90 border-t border-b border-[#0ea5e9]/10 flex overflow-hidden">
      {STATS.map((s, i) => (
        <Counter key={s.label} target={s.target} suffix={s.suffix} label={s.label} delay={i * 120} />
      ))}
    </div>
  );
}
