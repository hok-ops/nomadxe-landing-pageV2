'use client';

import { useLayoutEffect, useRef } from 'react';

const PANEL1_FEATURES = [
  'Integrates with existing cameras',
  'Compatible with major NVR brands',
  'No fixed infrastructure needed',
  'Relocatable in under 2 hours',
];

const PANEL2_FEATURES = [
  'NOMADXE-spec trailer & cameras',
  'Pre-configured monitoring platform',
  'Dedicated monitoring partner setup',
  'Turnkey — fully operational day one',
];

export default function TwoOptions() {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    let ctx: { revert: () => void } | null = null;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    import('gsap').then(({ gsap }) =>
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);
        ctx = gsap.context(() => {
          gsap.fromTo(
            '[data-option-panel]',
            { opacity: 0, y: 40 },
            {
              opacity: 1,
              y: 0,
              duration: 0.8,
              ease: 'power3.out',
              stagger: 0.2,
              scrollTrigger: {
                trigger: sectionRef.current,
                start: 'top 70%',
              },
            }
          );
        }, sectionRef);
      })
    );

    return () => ctx?.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="solutions"
      className="bg-midnight py-24 px-8"
      aria-label="Deployment options"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="font-mono text-xs tracking-widest uppercase text-blue/60 mb-4">Deployment Options</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Two ways to{' '}
            <em className="font-display italic text-blue not-italic">deploy.</em>
          </h2>
        </div>

        {/* Panels */}
        <div className="grid md:grid-cols-2 gap-0 rounded-3xl overflow-hidden border border-white/5">
          {/* Panel 1 — Trailer & Power Base */}
          <div
            data-option-panel
            className="bg-surface border-l-4 border-l-blue/40 p-12 flex flex-col gap-8"
            aria-label="Trailer and Power Base option"
          >
            <div>
              <p className="font-mono text-xs tracking-widest uppercase text-blue/60 mb-3">Option 01</p>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Trailer &amp; Power Base
              </h3>
              <p className="text-white/60 leading-relaxed text-sm">
                You bring your own cameras and NVR. We provide the mobile trailer, power infrastructure,
                and platform connectivity — your existing investment, newly mobile.
              </p>
            </div>

            <ul className="flex flex-col gap-3" aria-label="Trailer and Power Base features">
              {PANEL1_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-3">
                  <span
                    className="font-mono text-xs bg-midnight rounded-full px-3 py-1 text-white/70 border border-white/10"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span className="text-sm text-white/70">{f}</span>
                </li>
              ))}
            </ul>

            <a
              href="#contact"
              className="mt-auto self-start border border-white/20 text-white font-semibold rounded-full px-8 py-3 text-sm transition-all duration-300 hover:border-blue hover:text-blue hover:scale-[1.02] active:scale-[0.98]"
              aria-label="Inquire about Trailer and Power Base option"
            >
              Learn More
            </a>
          </div>

          {/* Panel 2 — Fully Equipped (blue filled) */}
          <div
            data-option-panel
            className="bg-blue text-midnight p-12 flex flex-col gap-8"
            aria-label="Fully Equipped option"
          >
            <div>
              <p className="font-mono text-xs tracking-widest uppercase text-midnight/50 mb-3">Option 02</p>
              <h3 className="text-2xl md:text-3xl font-bold text-midnight mb-3">
                Fully Equipped
              </h3>
              <p className="text-midnight/70 leading-relaxed text-sm">
                End-to-end. We supply the trailer, cameras, NVR, power system, monitoring platform,
                and partner coordination. Arrive on site. You&apos;re live.
              </p>
            </div>

            <ul className="flex flex-col gap-3" aria-label="Fully Equipped features">
              {PANEL2_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-3">
                  <span
                    className="font-mono text-xs bg-midnight/10 rounded-full px-3 py-1 text-midnight/80 border border-midnight/10"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span className="text-sm text-midnight/80">{f}</span>
                </li>
              ))}
            </ul>

            <a
              href="#contact"
              className="mt-auto self-start bg-midnight text-blue font-semibold rounded-full px-8 py-3 text-sm transition-all duration-300 hover:shadow-blue-glow hover:scale-[1.02] active:scale-[0.98]"
              aria-label="Get started with Fully Equipped option"
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
