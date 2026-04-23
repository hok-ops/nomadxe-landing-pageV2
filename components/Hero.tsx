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

  // GSAP entrance + scroll-out parallax
  useLayoutEffect(() => {
    let ctx: { revert: () => void } | null = null;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    import('gsap').then(({ gsap }) =>
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);
        ctx = gsap.context(() => {

          // ── Entrance animations ────────────────────────────────────
          gsap.fromTo('[data-hero-animate]',
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.15, delay: 0.3 }
          );
          gsap.fromTo('[data-hero-image]',
            { opacity: 0, scale: 1.04 },
            { opacity: 1, scale: 1, duration: 1.2, ease: 'power3.out', delay: 0.1 }
          );

          // ── Scroll-out parallax ────────────────────────────────────
          // Image: positive Y nudges the layer DOWN relative to the
          // scrolling section, so it appears to move up SLOWER than the
          // page — classic depth parallax.
          gsap.to('[data-hero-image]', {
            y: 60,
            ease: 'none',
            scrollTrigger: {
              trigger: heroRef.current,
              start: 'top top',
              end: 'bottom top',
              scrub: 0.8,
            },
          });

          // Copy: begins fading and lifting once the user is halfway
          // through scrolling past the hero, so it clears the frame
          // gracefully rather than snapping out.
          gsap.to('[data-hero-animate]', {
            opacity: 0,
            y: -28,
            ease: 'power1.in',
            scrollTrigger: {
              trigger: heroRef.current,
              start: '55% top',
              end: 'bottom top',
              scrub: 0.6,
            },
          });

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

        {/* Trailer background — two layers so the whole trailer is visible
            AND the side gutters never go flat black on wide viewports.
            Layer 1: blurred, darkened cover-fill behind the image (fills
            any empty horizontal space a contained portrait would leave).
            Layer 2: sharp, object-contain image centered — the full
            trailer, top to bottom, with no cropping. */}
        <div data-hero-image aria-hidden="true" className="absolute inset-0 z-0 pointer-events-none">
          {/* Blurred letterbox fill — same image, cover, heavily blurred */}
          <div className="absolute inset-0 scale-110">
            <Image
              src="/trailer-hires.jpg"
              alt=""
              priority
              fill
              sizes="100vw"
              quality={60}
              className="object-cover object-center opacity-50 blur-2xl"
              placeholder="blur"
              blurDataURL={BLUR_DATA}
            />
          </div>

          {/* Sharp trailer — anchored to the UPPER portion of the frame so
              the solar panels and chassis live in the top ~60% and the
              bottom ~40% becomes a dedicated dark plinth for copy. This is
              the cinematic composition used by Rivian / Anduril hero shots:
              the subject occupies the cinematic upper frame, copy lives in
              an uncontested lower band. No more headline across panels. */}
          <Image
            src="/trailer-hires.jpg"
            alt=""
            priority
            fill
            sizes="100vw"
            quality={94}
            className="object-contain object-top opacity-[0.95] scale-[1.08] md:scale-[1.05] lg:scale-[1.02] xl:scale-100 translate-y-[-6%]"
            placeholder="blur"
            blurDataURL={BLUR_DATA}
          />

          {/* Soft halo behind the trailer body — positioned HIGHER to match
              the repositioned subject. */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 55% 40% at 50% 30%, rgba(14,165,233,0.22), transparent 70%)',
            }}
          />

          {/* Edge vignette — darkens left, right, top corners so the
              trailer's rectangular boundary dissolves into the background
              instead of reading as a distinct photo in a box. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 85% 90% at 50% 40%, transparent 38%, rgba(4,7,14,0.55) 72%, #04070e 100%)',
            }}
          />

          {/* Left and right side fades — additional darkening at the
              horizontal edges so wide viewports feel immersive. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to right, #04070e 0%, rgba(4,7,14,0.6) 8%, transparent 22%, transparent 78%, rgba(4,7,14,0.6) 92%, #04070e 100%)',
            }}
          />

          {/* Vertical plinth gradient — the bottom 40% transitions to solid
              midnight, creating a dedicated uncontested band for the copy.
              The trailer lives in the upper frame; the copy lives in the
              plinth. No visual collision. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, #04070e 0%, rgba(4,7,14,0.5) 6%, rgba(4,7,14,0.08) 22%, rgba(4,7,14,0.12) 48%, rgba(4,7,14,0.78) 62%, #04070e 78%, #04070e 100%)',
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

        {/* Copy — sits in the dedicated lower plinth zone, well clear of the
            trailer's solar panels. Centered horizontally. */}
        <div className="relative z-10 px-8 lg:px-16 pb-20 lg:pb-24">
          <div className="max-w-[44rem] mx-auto">
            <HeroCopy statusRef={statusRef} />
          </div>
        </div>

        {/* Floating telemetry chip — annotates the trailer on large screens.
            Positioned top-right in the sky zone above the trailer. */}
        <div
          aria-hidden="true"
          className="hidden lg:flex absolute top-20 right-8 z-20 items-center gap-3 rounded-lg bg-midnight/80 backdrop-blur-md border border-white/10 px-4 py-2.5 font-mono text-[11px] tracking-wider text-white/80 shadow-[0_10px_40px_-10px_rgba(14,165,233,0.45)]"
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

      {/* Alpha Vision AGI7 AI — feature badge replaces the credentials strip.
          The product story beats compliance trivia as a lower-anchor element.
          Pill with a pulsing accent, short product name, and a tight
          descriptor in the same monospace tracking the rest of the page
          uses for instrumentation labels. */}
      <div data-hero-animate className="mt-10 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-blue/30 bg-blue/[0.06] backdrop-blur-sm pl-3 pr-4 py-1.5 shadow-[0_0_0_1px_rgba(14,165,233,0.05),0_8px_28px_-12px_rgba(14,165,233,0.55)]">
          <span className="relative inline-flex items-center justify-center w-2 h-2 flex-shrink-0" aria-hidden="true">
            <span className="absolute inline-block w-2 h-2 rounded-full bg-blue animate-pulseRing" />
            <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-blue" />
          </span>
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-blue/90 font-bold">
            Alpha Vision AGI7
          </span>
          <span className="w-px h-3 bg-blue/30" aria-hidden="true" />
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-white/70">
            Onboard AI Vision
          </span>
        </div>
        <span className="text-[11px] text-white/45 leading-snug max-w-xs">
          Autonomous detection &amp; tracking at the edge — sees, classifies, and alerts without pinging a cloud.
        </span>
      </div>
    </>
  );
}
