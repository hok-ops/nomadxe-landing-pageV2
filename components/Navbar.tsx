'use client';

import { useEffect, useState, useCallback } from 'react';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Solutions', href: '#solutions' },
  { label: 'Partners', href: '#partners' },
  { label: 'Use Cases', href: '#use-cases' },
  { label: 'Contact', href: '#contact' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleScroll = useCallback(() => {
    requestAnimationFrame(() => setScrolled(window.scrollY > 80));
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <>
      <a href="#main" className="skip-to-content">Skip to content</a>

      <header
        role="banner"
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-out
          px-6 py-3 rounded-full flex items-center gap-8
          ${scrolled
            ? 'bg-midnight/70 backdrop-blur-xl border border-blue/20 shadow-blue-glow'
            : 'bg-transparent border border-transparent'
          }`}
      >
        <a href="#" className="font-mono text-sm tracking-[0.3em] uppercase text-white hover:text-blue transition-colors duration-300" aria-label="Nomadxe home">
          NOMADXE
        </a>

        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href}
              className="relative text-sm text-white/70 hover:text-white transition-colors duration-300 group">
              {link.label}
              <span className="absolute -bottom-0.5 left-0 w-full h-px bg-blue transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out origin-left" aria-hidden="true" />
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <a href="/login" className="text-sm font-mono text-white/50 hover:text-white transition-colors duration-300 uppercase tracking-widest">
            Client Portal
          </a>
          <a href="#contact"
            className="inline-flex relative overflow-hidden items-center bg-blue text-midnight text-sm font-semibold rounded-full px-6 py-2 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-px hover:shadow-blue-glow active:scale-[0.98]">
            Get Started
          </a>
        </div>

        <button
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((o) => !o)}
          className="md:hidden text-white/80 hover:text-blue transition-colors duration-200 p-1">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        className={`fixed inset-0 bg-midnight/95 backdrop-blur-2xl z-40 flex flex-col items-center justify-center gap-8 transition-all duration-400 ease-out
          ${menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        {navLinks.map((link, i) => (
          <a key={link.label} href={link.href} onClick={() => setMenuOpen(false)}
            className="text-3xl font-display italic text-white/80 hover:text-blue transition-colors duration-300"
            style={{
              transitionDelay: menuOpen ? `${i * 60}ms` : '0ms',
              transform: menuOpen ? 'translateY(0)' : 'translateY(20px)',
              opacity: menuOpen ? 1 : 0,
              transition: `opacity 400ms ease ${i * 60}ms, transform 400ms ease ${i * 60}ms, color 300ms`,
            }}>
            {link.label}
          </a>
        ))}
        <a href="/login" onClick={() => setMenuOpen(false)}
          className="text-xl font-mono text-white/50 hover:text-white transition-colors uppercase tracking-widest mt-2"
          style={{ transitionDelay: menuOpen ? `${navLinks.length * 60}ms` : '0ms', opacity: menuOpen ? 1 : 0 }}>
          Client Portal
        </a>
        <a href="#contact" onClick={() => setMenuOpen(false)}
          className="mt-4 bg-blue text-midnight text-lg font-semibold rounded-full px-8 py-3 hover:shadow-blue-glow transition-all duration-300"
          style={{ transitionDelay: menuOpen ? `${(navLinks.length + 1) * 60}ms` : '0ms', opacity: menuOpen ? 1 : 0 }}>
          Get Started
        </a>
      </div>
    </>
  );
}
