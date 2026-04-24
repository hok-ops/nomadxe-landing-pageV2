'use client';

import { useEffect } from 'react';

/**
 * Lightweight, cross-section scroll reveal.
 *
 * Applies a fade-up + subtle scale entrance to every <section> child of
 * <main> as it scrolls into the viewport — except the first one (Hero
 * handles its own entrance) and any element opted out via [data-no-reveal].
 *
 * Improvements over the basic version:
 *  • scale(0.97)→1 combined with translateY gives a "rising into focus" feel
 *  • Sections entering in the same observer batch are staggered 80ms apart
 *    (common on page-load when multiple sections are already in view)
 *  • willChange is removed after the transition ends to free compositor layers
 *  • rootMargin tuned so sections trigger just before they're fully visible
 */
export default function ScrollReveal() {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const main = document.querySelector('main');
    if (!main) return;

    const sections = Array.from(main.querySelectorAll<HTMLElement>(':scope > section'))
      // Skip Hero (first section) — it drives its own entrance via GSAP.
      .filter((el, idx) => idx !== 0 && !el.hasAttribute('data-no-reveal'));

    if (sections.length === 0) return;

    sections.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(36px) scale(0.97)';
      el.style.transformOrigin = 'center 80%';
      el.style.willChange = 'opacity, transform';
      el.style.transition =
        'opacity 820ms cubic-bezier(.16,1,.3,1), transform 820ms cubic-bezier(.16,1,.3,1)';
    });

    // Batch queue — sections intersecting in the same callback tick get
    // staggered by 80ms so they don't all pop in at once.
    let batchTimer: ReturnType<typeof setTimeout> | null = null;
    const batchQueue: HTMLElement[] = [];

    const flush = () => {
      batchQueue.forEach((el, i) => {
        el.style.transitionDelay = `${i * 80}ms`;
        el.style.opacity = '1';
        el.style.transform = 'translateY(0) scale(1)';

        // Clean up compositor hint + stagger delay once done.
        el.addEventListener(
          'transitionend',
          () => {
            el.style.willChange = 'auto';
            el.style.transitionDelay = '';
          },
          { once: true }
        );
      });
      batchQueue.length = 0;
    };

    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            batchQueue.push(e.target as HTMLElement);
            obs.unobserve(e.target);
          }
        });
        // Defer the reveal by one frame so all simultaneous entries are collected.
        if (batchTimer) clearTimeout(batchTimer);
        batchTimer = setTimeout(flush, 16);
      },
      { threshold: 0.06, rootMargin: '0px 0px -5% 0px' }
    );

    sections.forEach(el => obs.observe(el));

    return () => {
      obs.disconnect();
      if (batchTimer) clearTimeout(batchTimer);
    };
  }, []);

  return null;
}
