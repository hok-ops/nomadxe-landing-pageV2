'use client';

import { useLayoutEffect, useRef } from 'react';
import Image from 'next/image';

const BLUR_DATA =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUE/8QAIRAAAQQCAgMAAAAAAAAAAAAAAQIDBAURITFBUWH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Amz17TaZdLc2yxH2GUNBKnHCpRJPAA7n4rP6m1ZTQbzRdJpBkGQxHZL7ylHYRtSBx+/2rRRQB/9k=';

const WORDS = [
  'Most', 'site', 'security', 'relies', 'on', 'fixed', 'infrastructure.',
  'Cables.', 'Conduit.', 'Permits.', 'Months', 'of', 'lead', 'time.',
  'We', 'built', 'for', 'the', 'site', 'that', "can't", 'wait.',
];

export default function Manifesto() {
  const sectionRef = useRef<HTMLElement>(null);
  const wordsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useLayoutEffect(() => {
    let ctx: { revert: () => void } | null = null;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      wordsRef.current.forEach((el) => {
        if (el) el.style.opacity = '1';
      });
      return;
    }

    import('gsap').then(({ gsap }) =>
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);
        ctx = gsap.context(() => {
          wordsRef.current.forEach((el, i) => {
            if (!el) return;
            gsap.fromTo(
              el,
              { opacity: 0.15 },
              {
                opacity: 1,
                ease: 'none',
                scrollTrigger: {
                  trigger: el,
                  start: 'top 80%',
                  end: 'top 55%',
                  scrub: true,
                },
              }
            );
          });
        }, sectionRef);
      })
    );

    return () => ctx?.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="manifesto"
      className="relative bg-midnight overflow-hidden py-32 px-8"
      aria-label="Nomadxe manifesto"
    >
      {/* Aerial background */}
      <Image
        src="https://images.unsplash.com/photo-1508361001413-7a9dca21d08a?w=1920&q=60"
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        className="object-cover opacity-10"
        placeholder="blur"
        blurDataURL={BLUR_DATA}
        // TODO: replace with final brand aerial image
      />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Setup text */}
        <p className="text-white/50 text-sm md:text-base max-w-2xl mx-auto mb-16 leading-relaxed tracking-wide">
          Most site security relies on fixed infrastructure — cables, conduit, permits, and months of lead time.
          We built Nomadxe for the job sites, construction zones, and remote facilities that cannot afford to wait.
        </p>

        {/* Word-by-word reveal */}
        <blockquote
          className="text-4xl md:text-6xl font-display italic text-white leading-tight"
          aria-label="We built for the site that can't wait."
        >
          {WORDS.map((word, i) => {
            const isHighlight = word === "can't" || word === 'wait.';
            return (
              <span key={i} className="inline-block mr-[0.25em]">
                <span
                  ref={(el) => { wordsRef.current[i] = el; }}
                  className={isHighlight ? 'text-blue' : 'text-white'}
                  style={{ opacity: 0.15 }}
                >
                  {word}
                </span>
              </span>
            );
          })}
        </blockquote>

        {/* Attribution */}
        <p className="mt-12 font-mono text-xs tracking-[0.3em] uppercase text-white/30">
          — The Nomadxe Principle
        </p>
      </div>
    </section>
  );
}
