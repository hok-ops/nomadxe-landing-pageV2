'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

const BLUR_DATA =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUE/8QAIRAAAQQCAgMAAAAAAAAAAAAAAQIDBAURITFBUWH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Amz17TaZdLc2yxH2GUNBKnHCpRJPAA7n4rP6m1ZTQbzRdJpBkGQxHZL7ylHYRtSBx+/2rRRQB/9k=';

const USE_CASES = [
  {
    title: 'Construction & Civil',
    descriptor: 'ACTIVE SITE MONITORING',
    image: '/images/usecase_construction.png',
  },
  {
    title: 'Remote Energy & Utilities',
    descriptor: 'PERIMETER SURVEILLANCE',
    image: '/images/usecase_energy.png',
  },
  {
    title: 'Events & Temporary Venues',
    descriptor: 'CROWD & ACCESS CONTROL',
    image: '/images/usecase_incident.png',
  },
  {
    title: 'Asset Yards & Logistics',
    descriptor: 'INVENTORY PROTECTION',
    image: '/images/usecase_compliance.png',
  },
];

/* Amber corner bracket SVG */
function CornerBracket() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      className="text-amber/60"
      aria-hidden="true"
    >
      <path d="M2 16 L2 2 L16 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function UseCases() {
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
            obs.unobserve(el);
          }
        });
      },
      { threshold: 0.12 }
    );
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.opacity = '0';
      el.style.transform = 'translateY(32px)';
      el.style.transition = `opacity 0.6s cubic-bezier(.22,1,.36,1) ${i * 0.1}s, transform 0.6s cubic-bezier(.22,1,.36,1) ${i * 0.1}s`;
      obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <section
      id="use-cases"
      className="bg-midnight py-24 px-8"
      aria-label="Nomadxe use cases"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="font-mono text-xs tracking-widest uppercase text-blue/60 mb-4">Applications</p>
          <h2 className="text-4xl md:text-5xl font-sans font-bold tracking-tight text-white">
            Where Nomadxe <span className="text-blue">deploys.</span>
          </h2>
        </div>

        {/* Desktop 2x2 grid / Mobile horizontal scroll */}
        <div
          className="flex md:grid md:grid-cols-2 gap-6 overflow-x-auto md:overflow-visible scrollbar-hide snap-x snap-mandatory md:snap-none pb-2 md:pb-0"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {USE_CASES.map((uc, idx) => (
            <article
              key={uc.title}
              ref={(el) => { cardRefs.current[idx] = el; }}
              className="relative rounded-2xl overflow-hidden bg-surface group cursor-default snap-start flex-shrink-0 w-[80vw] md:w-auto"
              style={{ aspectRatio: '4/3' }}
              aria-label={`Use case: ${uc.title}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Background image */}
              <Image
                src={uc.image}
                alt=""
                aria-hidden="true"
                fill
                sizes="(max-width: 768px) 80vw, 50vw"
                className="object-cover opacity-40 group-hover:opacity-55 group-hover:scale-105 transition-all duration-500 ease-out"
                placeholder="blur"
                blurDataURL={BLUR_DATA}
              />

              {/* Gradient overlay */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/40 to-transparent"
              />

              {/* Corner bracket + LIVE badge */}
              <div className="absolute top-4 left-4 z-10" style={{
                opacity: hoveredIdx === idx ? 1 : 0.35,
                transform: hoveredIdx === idx ? 'scale(1)' : 'scale(0.9)',
                transition: 'opacity 0.3s ease, transform 0.3s ease',
              }}>
                <CornerBracket />
              </div>
              <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase rounded-md px-2 py-1"
                style={{
                  opacity: hoveredIdx === idx ? 1 : 0,
                  background: 'rgba(11,12,16,0.75)',
                  border: '1px solid rgba(251,191,36,0.4)',
                  color: '#fbbf24',
                  transition: 'opacity 0.3s ease',
                }}>
                <span style={{width:5,height:5,borderRadius:'50%',background:'#fbbf24',display:'inline-block',animation:'pulse 1.2s ease-in-out infinite'}} />
                LIVE
              </div>

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 z-10 p-6">
                <p className="font-mono text-xs text-white/60 tracking-widest uppercase mb-2">
                  {uc.descriptor}
                </p>
                <h3 className="font-sans font-bold text-xl text-white">{uc.title}</h3>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
