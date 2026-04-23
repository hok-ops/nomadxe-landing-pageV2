'use client';

import { useEffect, useRef, useLayoutEffect } from 'react';
import Image from 'next/image';

const STATUS_TEXT = '[ DEPLOYED ] Mobile Surveillance · Certified Partner Network';

const BLUR_DATA =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUE/8QAIRAAAQQCAgMAAAAAAAAAAAAAAQIDBAURITFBUWH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Amz17TaZdLc2yxH2GUNBKnHCpRJPAA7n4rP6m1ZTQbzRdJpBkGQxHZL7ylHYRtSBx+/2rRRQB/9k=';

export default function Hero() {
  const statusRef = useRef<HTMLSpanElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  // Typewriter effect
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      if (statusRef.current) statusRef.current.textContent = STATUS_TEXT;
      return;
    }
    let index = 0;
    let rafId: number;
    let lastTime = 0;
    const interval = 40;
    const type = (timestamp: number) => {
      if (timestamp - lastTime >= interval) {
        lastTime = timestamp;
        if (statusRef.current && index <= STATUS_TEXT.length) {
          statusRef.current.textContent = STATUS_TEXT.slice(0, index);
          index++;
        }
      }
      if (index <= STATUS_TEXT.length) rafId = requestAnimationFrame(type);
    };
    rafId = requestAnimationFrame(type);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // GSAP entrance
  useLayoutEffect(() => {
    let ctx: { revert: () => void } | null = null;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    import('gsap').then(({ gsap }) =>
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);
        ctx = gsap.context(() => {
          gsap.fromTo('[data-hero-animate]',
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.15, delay: 0.3 }
          );
          gsap.fromTo('[data-hero-image]',
            { opacity: 0, scale: 1.04 },
            { opacity: 1, scale: 1, duration: 1.2, ease: 'power3.out', delay: 0.1 }
          );
        }, heroRef);
      })
    );
    return () => ctx?.revert();
  }, []);

  return (
    <section
      ref={heroRef}
      id="main"
      aria-label="Hero — Nomadxe Mobile Surveillance"
      className="relative overflow-hidden bg-midnight"
    >
      {/* ─── MOBILE: full-bleed hero with image behind text (unchanged experience) ─── */}
      <div className="md:hidden relative min-h-[92dvh] flex flex-col justify-end">
        <div data-hero-image className="absolute inset-0">
          <Image
            src="/trailer-hires.jpg"
            alt="NomadXE solar surveillance trailer deployed on site"
            priority
            fill
            sizes="100vw"
            quality={90}
            className="object-cover object-center"
            placeholder="blur"
            blurDataURL={BLUR_DATA}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/75 to-midnight/10"
          />
        </div>
        <div className="relative z-10 px-8 pb-16 max-w-xl">
          <HeroCopy statusRef={statusRef} />
        </div>
      </div>

      {/* ─── DESKTOP: centered full-width trailer, vertical fade, copy at bottom ─── */}
      <div className="hidden md:flex relative min-h-dvh overflow-hidden flex-col justify-end">

        {/* Trailer background — centered and stretched to fill the viewport
            width. Using object-cover with object-top keeps the trailer body
            in frame (bottom of the portrait — which is mostly ground — is
            what gets cropped, and our vertical fade gradient covers that
            zone anyway where the copy sits). */}
        <div data-hero-image aria-hidden="true" className="absolute inset-0 z-0 pointer-events-none">
          <Image
            src="/trailer-hires.jpg"
            alt=""
            priority
            fill
            sizes="100vw"
            quality={94}
            className="object-cover object-top opacity-70"
            placeholder="blur"
            blurDataURL={BLUR_DATA}
          />

          {/* Soft central halo behind the trailer to lift it off the page */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 65% 55% at 50% 38%, rgba(14,165,233,0.22), transparent 72%)',
            }}
          />

          {/* Vertical transparency gradient — image is clear up top and
              fades to solid midnight toward the bottom, giving the copy a
              clean dark plinth to sit on without hiding the trailer. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(4,7,14,0.05) 0%, rgba(4,7,14,0.15) 30%, rgba(4,7,14,0.55) 55%, rgba(4,7,14,0.88) 78%, #04070e 100%)',
            }}
          />

          {/* Scan-line texture */}
          <div
            className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, #0ea5e9 0, #0ea5e9 1px, transparent 1px, transparent 3px)',
            }}
          />
        </div>

        {/* Copy — centered horizontally and overlaid toward the bottom of the image */}
        <div className="relative z-10 px-8 lg:px-16 pb-20 lg:pb-28">
          <div className="max-w-[44rem] mx-auto">
            <HeroCopy statusRef={statusRef} />
          </div>
        </div>

        {/* Floating telemetry chip — annotates the trailer on large screens */}
        <div
          aria-hidden="true"
          className="hidden lg:flex absolute top-28 right-8 z-20 items-center gap-3 rounded-lg bg-midnight/80 backdrop-blur-md border border-white/10 px-4 py-2.5 font-mono text-[11px] tracking-wider text-white/80 shadow-[0_10px_40px_-10px_rgba(14,165,233,0.45)]"
        >
          <span className="relative inline-flex items-center justify-center w-1.5 h-1.5">
            <span className="absolute inline-block w-1.5 h-1.5 rounded-full bg-blue animate-pulseRing" />
            <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-blue" />
          </span>
          <span>NX-07 &middot; ONLINE</span>
          <span className="w-px h-3 bg-white/20" />
          <span className="text-blue/90">SOC 78% &middot; 412W</span>
        </div>
      </div>

      {/* Scroll hint */}
      <div aria-hidden="true" className="absolute bottom-8 right-8 font-mono text-xs text-white/30 tracking-widest uppercase hidden md:block animate-floatY">
        scroll ↓
      </div>
    </section>
  );
}

/* Shared hero copy block so mobile + desktop stay in lockstep. */
function HeroCopy({ statusRef }: { statusRef: React.RefObject<HTMLSpanElement> }) {
  return (
    <>
      {/* Status bar */}
      <div
        data-hero-animate
        className="mb-6 flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] uppercase text-blue/80"
        aria-label="System status"
      >
        <span className="relative inline-flex items-center justify-center w-1.5 h-1.5 flex-shrink-0" aria-hidden="true">
          <span className="absolute inline-block w-1.5 h-1.5 rounded-full bg-blue animate-pulseRing" />
          <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-blue" />
        </span>
        <span ref={statusRef} aria-live="polite" />
        <span
          aria-hidden="true"
          className="inline-block w-px h-3 bg-blue/80"
          style={{ animation: 'type-cursor-blink 1s step-end infinite' }}
        />
      </div>

      {/* Headline — pure sans, color-accented (no mid-headline font swap). */}
      <h1 data-hero-animate className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-sans font-bold leading-[1.05] tracking-tight text-white mb-5">
        Mobile surveillance,{' '}
        <span className="text-blue">ready where the site is.</span>
      </h1>

      {/* Subhead */}
      <p data-hero-animate className="text-base md:text-lg text-white/65 max-w-xl mb-9 leading-relaxed">
        Solar-powered, cellular-uplinked trailers running AI video analytics — a measured alternative
        to fixed infrastructure for construction yards, events, and remote operations.
      </p>

      {/* CTAs */}
      <div data-hero-animate className="flex flex-wrap gap-3">
        <a
          href="#contact"
          className="inline-flex items-center bg-blue text-midnight font-semibold rounded-full px-7 py-3 text-sm transition-all duration-300 hover:scale-[1.02] hover:-translate-y-px hover:shadow-blue-glow active:scale-[0.98]"
        >
          Get in touch
        </a>
        <a
          href="#how-it-works"
          className="inline-flex items-center border border-white/25 text-white font-semibold rounded-full px-7 py-3 text-sm transition-all duration-300 hover:border-blue hover:text-blue active:scale-[0.98]"
        >
          See how it works
        </a>
      </div>

      {/* Credentials strip — small sans, trust signals */}
      <div data-hero-animate className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-mono tracking-widest uppercase text-white/35">
        <span>UL-Listed Equipment</span>
        <span className="w-1 h-1 rounded-full bg-white/20" aria-hidden="true" />
        <span>FCC-Registered Uplink</span>
        <span className="w-1 h-1 rounded-full bg-white/20" aria-hidden="true" />
        <span>Victron Professional Dealer</span>
      </div>
    </>
  );
}
