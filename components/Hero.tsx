'use client';

import { useEffect, useRef, useLayoutEffect } from 'react';
import Image from 'next/image';

const STATUS_TEXT = '[ SYSTEM ACTIVE ] — Mobile Surveillance Infrastructure';

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
      className="relative min-h-dvh flex flex-col justify-end overflow-hidden bg-gradient-to-b from-midnight to-surface"
    >
      {/* Actual Nomadxe trailer photo */}
      <Image
        src="/trailer.jpg"
        alt="NomadXE solar surveillance trailer deploying mobile security infrastructure"
        priority
        fill
        sizes="100vw"
        className="object-cover object-center"
        placeholder="blur"
        blurDataURL={BLUR_DATA}
      />

      {/* Dark gradient overlay — heavier at bottom so text is legible */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/70 to-midnight/20"
      />

      {/* Content */}
      <div className="relative z-10 px-8 md:px-16 pb-16 md:pb-24 max-w-3xl">
        {/* Status bar */}
        <div
          data-hero-animate
          className="mb-6 flex items-center gap-2 font-mono text-xs tracking-widest uppercase text-blue/80"
          aria-label="System status"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue animate-pulse" aria-hidden="true" />
          <span ref={statusRef} aria-live="polite" />
          <span
            aria-hidden="true"
            className="inline-block w-px h-3 bg-blue/80"
            style={{ animation: 'type-cursor-blink 1s step-end infinite' }}
          />
        </div>

        {/* Headline */}
        <h1 data-hero-animate className="text-5xl md:text-7xl font-sans font-bold leading-tight text-white mb-4">
          Visibility without{' '}
          <em className="font-display not-italic text-blue">boundaries.</em>
        </h1>

        {/* Subheading */}
        <p data-hero-animate className="text-lg text-white/70 max-w-lg mb-10 leading-relaxed">
          Nomadxe deploys trailer-mounted surveillance systems to sites where traditional infrastructure
          doesn&apos;t reach — up and running in hours, not weeks.
        </p>

        {/* CTAs */}
        <div data-hero-animate className="flex flex-wrap gap-4">
          <a
            href="#contact"
            className="inline-flex items-center bg-blue text-midnight font-semibold rounded-full px-8 py-3 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-px hover:shadow-blue-glow active:scale-[0.98]"
          >
            Talk to Sales
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center border border-white/30 text-white font-semibold rounded-full px-8 py-3 transition-all duration-300 hover:border-blue hover:text-blue active:scale-[0.98]"
          >
            See How It Works
          </a>
        </div>
      </div>

      {/* Scroll hint */}
      <div aria-hidden="true" className="absolute bottom-8 right-8 font-mono text-xs text-white/30 tracking-widest uppercase hidden md:block">
        scroll ↓
      </div>
    </section>
  );
}
