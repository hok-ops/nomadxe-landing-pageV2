import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page Not Found | NomadXE',
  description: 'The page you are looking for does not exist. Return to NomadXE to learn about our solar-powered mobile security trailers.',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">

      {/* Grid background */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.022]"
        style={{ backgroundImage: 'linear-gradient(#3b82f6 1px,transparent 1px),linear-gradient(to right,#3b82f6 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

      {/* Top accent bar */}
      <div className="fixed top-0 left-0 right-0 h-[3px] z-[100]"
        style={{ background: 'linear-gradient(90deg,#1e40af,#3b82f6,#60a5fa,#3b82f6,#1e40af)' }} />

      <div className="relative z-10 max-w-lg mx-auto">

        {/* Brand mark */}
        <Link href="/" className="inline-flex items-center gap-2.5 mb-10 group">
          <span className="w-2 h-2 rounded-full bg-[#3b82f6] shadow-[0_0_8px_#3b82f6]" />
          <span className="text-[10px] font-bold text-[#3b82f6]/60 group-hover:text-[#3b82f6] uppercase tracking-[0.5em] font-mono transition-colors">NomadXE</span>
        </Link>

        {/* 404 */}
        <div className="font-black text-[clamp(80px,20vw,140px)] leading-none text-[#3b82f6]/15 select-none mb-4"
          aria-hidden="true">
          404
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-4">
          Page not found
        </h1>

        <p className="text-[#93c5fd]/55 text-sm leading-relaxed mb-10 max-w-sm mx-auto">
          This page doesn&rsquo;t exist or has moved. Head back to learn about our solar-powered mobile security trailers.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold px-8 py-3.5 rounded-xl text-sm tracking-wide transition-all hover:shadow-[0_0_28px_rgba(59,130,246,0.4)] active:scale-[0.98]"
          >
            ← Back to Home
          </Link>
          <Link
            href="/#contact"
            className="w-full sm:w-auto border border-[#1e3a5f] hover:border-[#3b82f6]/50 text-[#93c5fd]/70 hover:text-white font-bold px-8 py-3.5 rounded-xl text-sm tracking-wide transition-all"
          >
            Contact Us
          </Link>
        </div>

        {/* Helpful links */}
        <nav className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3" aria-label="Quick links">
          {[
            { href: '/#solutions', label: 'Solutions' },
            { href: '/#how-it-works', label: 'How It Works' },
            { href: '/#use-cases', label: 'Use Cases' },
            { href: '/about', label: 'About' },
          ].map(({ href, label }) => (
            <Link key={href} href={href}
              className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#93c5fd]/40 hover:text-[#3b82f6] transition-colors">
              {label}
            </Link>
          ))}
        </nav>

      </div>
    </div>
  );
}
