'use client';

import { useEffect } from 'react';

/**
 * Lightweight, cross-section scroll reveal.
 * Applies a subtle fade-up entrance to every <section> child of <main>
 * as it scrolls into the viewport — except the first one (Hero handles
 * its own entrance) and any element explicitly opted out via
 * [data-no-reveal].
 *
 * Existing per-component entrance animations remain untouched; this only
 * animates the outer section wrapper opacity/transform, so the effect
 * is complementary, not competing.
 */
export default function ScrollReveal() {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const main = document.querySelector('main');
    if (!main) return;

    const sections = Array.from(main.querySelectorAll<HTMLElement>(':scope > section'))
      // Skip Hero (first section) — it has its own entrance sequence.
      .filter((el, idx) => idx !== 0 && !el.hasAttribute('data-no-reveal'));

    if (sections.length === 0) return;

    sections.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(38px)';
      el.style.willChange = 'opacity, transform';
      el.style.transition =
        'opacity 900ms cubic-bezier(.22,1,.36,1), transform 900ms cubic-bezier(.22,1,.36,1)';
    });

    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
            obs.unobserve(el);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' }
    );

    sections.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return null;
}
