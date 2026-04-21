import Link from 'next/link';
import type { ReactNode } from 'react';

interface LegalLayoutProps {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}

export default function LegalLayout({ title, effectiveDate, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-midnight text-white">
      {/* Top bar */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 py-4 bg-midnight/80 backdrop-blur-md border-b border-white/5">
        <Link href="/" className="font-mono text-sm tracking-[0.3em] uppercase text-white font-bold hover:text-blue transition-colors duration-200">
          NOMADXE
        </Link>
        <Link href="/" className="text-xs text-white/50 hover:text-blue transition-colors duration-200">
          ← Back to site
        </Link>
      </nav>

      {/* Hero bar */}
      <div className="pt-24 pb-12 px-8 bg-surface border-b border-white/5">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono text-xs tracking-widest uppercase text-blue/60 mb-3">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{title}</h1>
          <p className="text-sm text-white/40">Effective date: {effectiveDate}</p>
        </div>
      </div>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-8 py-16">
        <div className="prose-legal">
          {children}
        </div>
      </main>

      {/* Footer nav */}
      <div className="border-t border-white/5 py-8 px-8">
        <div className="max-w-3xl mx-auto flex flex-wrap gap-6 text-sm text-white/40">
          <span>© 2026 Nomadxe, LLC. All rights reserved.</span>
          <Link href="/privacy" className="hover:text-blue transition-colors duration-200">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-blue transition-colors duration-200">Terms of Service</Link>
          <Link href="/cookies" className="hover:text-blue transition-colors duration-200">Cookie Policy</Link>
        </div>
      </div>
    </div>
  );
}
