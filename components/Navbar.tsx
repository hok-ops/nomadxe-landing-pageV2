'use client';

import { useEffect, useState, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

const navLinks = [
  { label: 'Solutions', href: '#solutions' },
  { label: 'Partners', href: '#partners' },
  { label: 'Use Cases', href: '#use-cases' },
  { label: 'Contact', href: '#contact' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isOps = pathname.startsWith('/admin') || pathname.startsWith('/staff');
  const accentColor = isOps ? '#00FF41' : '#0ea5e9';
  const accentGlow = isOps ? 'shadow-[0_0_15px_rgba(0,255,65,0.3)]' : 'shadow-[0_0_15px_rgba(14,165,233,0.3)]';

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
            ? `bg-midnight/70 backdrop-blur-xl border ${accentGlow}`
            : 'bg-transparent border border-transparent'
          }`}
        style={scrolled ? { borderColor: `${accentColor}33` } : {}}
      >
        <a href="/" className="font-mono text-sm tracking-[0.3em] uppercase text-white hover:text-white transition-colors duration-300" aria-label="Nomadxe home">
          NOMADXE<span style={{ color: accentColor }}>_</span>
        </a>

        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href}
              className="relative text-sm text-white/70 hover:text-white transition-colors duration-300 group">
              {link.label}
              <span
                className="absolute -bottom-0.5 left-0 w-full h-px transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out origin-left"
                style={{ backgroundColor: accentColor }}
                aria-hidden="true"
              />
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {/* CLIENT PORTAL — refined pill button with border */}
          <a
            href={isOps ? '/staff' : '/login'}
            aria-label="Portal Login"
            className="text-[11px] font-semibold tracking-widest uppercase px-4 py-2 rounded-full border transition-all duration-300 hover:scale-[1.02]"
            style={{
              color: accentColor,
              borderColor: `${accentColor}55`,
              backgroundColor: `${accentColor}0D`,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = `${accentColor}22`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = `${accentColor}0D`;
            }}
          >
            {isOps ? 'Staff Terminal' : 'Client Portal'}
          </a>

          {/* GET STARTED — solid filled pill */}
          <a
            href={isOps ? '#' : '#contact'}
            className="inline-flex items-center gap-1.5 text-midnight text-sm font-bold rounded-full px-5 py-2 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-px hover:brightness-110 active:scale-[0.98]"
            style={{ backgroundColor: accentColor, boxShadow: `0 0 18px ${accentColor}55` }}
          >
            {isOps ? 'Deploy' : 'Get Started'}
          </a>
        </div>

        <button
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((o) => !o)}
          className="md:hidden text-white/80 transition-colors duration-200 p-1"
          style={{ color: menuOpen ? accentColor : 'white' }}
        >
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
            className="text-3xl font-display italic text-white/80 hover:text-white transition-colors duration-300"
            style={{
              transitionDelay: menuOpen ? `${i * 60}ms` : '0ms',
              transform: menuOpen ? 'translateY(0)' : 'translateY(20px)',
              opacity: menuOpen ? 1 : 0,
              transition: `opacity 400ms ease ${i * 60}ms, transform 400ms ease ${i * 60}ms, color 300ms`,
            }}>
            {link.label}
          </a>
        ))}
        <a href={isOps ? '/staff' : '/login'} onClick={() => setMenuOpen(false)}
          aria-label="Portal Login"
          className="text-base font-semibold uppercase tracking-widest mt-2 px-6 py-2.5 rounded-full border transition-all duration-300"
          style={{
            color: accentColor,
            borderColor: `${accentColor}55`,
            backgroundColor: `${accentColor}0D`,
            transitionDelay: menuOpen ? `${navLinks.length * 60}ms` : '0ms',
            opacity: menuOpen ? 1 : 0,
          }}>
          {isOps ? 'Staff Terminal' : 'Client Portal'}
        </a>
        <a href={isOps ? '#' : '#contact'} onClick={() => setMenuOpen(false)}
          className="mt-2 text-midnight text-lg font-bold rounded-full px-8 py-3 transition-all duration-300"
          style={{
            transitionDelay: menuOpen ? `${(navLinks.length + 1) * 60}ms` : '0ms',
            opacity: menuOpen ? 1 : 0,
            backgroundColor: accentColor,
            boxShadow: `0 0 18px ${accentColor}55`,
          }}>
          {isOps ? 'Deploy' : 'Get Started'}
        </a>
      </div>
    </>
  );
}
