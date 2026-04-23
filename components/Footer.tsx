'use client';

const FOOTER_LINKS = {
  Solutions: [
    { label: 'Trailer & Power Base', href: '#solutions' },
    { label: 'Fully Equipped', href: '#solutions' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Use Cases', href: '#use-cases' },
  ],
  Company: [
    { label: 'About Us', href: '/about' },
    { label: 'Monitoring Partners', href: '#partners' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
  ],
  Portals: [
    { label: 'Client Dashboard', href: '/login' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '/cookies' },
  ],
};

export default function Footer() {
  return (
    <footer
      id="footer"
      className="bg-midnight rounded-t-3xl border-t border-blue/20"
      aria-label="Site footer"
    >
      {/* Main grid */}
      <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12 p-12 md:p-16">
        {/* Col 1: Wordmark + tagline + CTA */}
        <div className="flex flex-col gap-6">
          <div>
            <p className="font-mono text-base tracking-[0.3em] uppercase text-white font-bold">
              NOMADXE
            </p>
            <p className="text-sm text-white/40 mt-2 leading-relaxed">
              Mobile surveillance infrastructure for the sites that can&apos;t wait.
            </p>
          </div>
          {/* Contact CTA */}
          <div className="flex flex-col gap-3">
            <p className="font-mono text-xs uppercase tracking-widest text-blue/60">Sales</p>
            <a
              href="mailto:sales@nomadxe.com"
              className="text-sm text-white/60 hover:text-blue transition-colors duration-300"
              aria-label="Email Nomadxe sales"
            >
              sales@nomadxe.com
            </a>
            <p className="font-mono text-xs uppercase tracking-widest text-blue/60 mt-2">Support</p>
            <a
              href="mailto:support@nomadxe.com"
              className="text-sm text-white/60 hover:text-blue transition-colors duration-300"
              aria-label="Email Nomadxe support"
            >
              support@nomadxe.com
            </a>
          </div>
          <a
            href="#contact"
            className="self-start bg-blue text-midnight font-semibold rounded-full px-6 py-2.5 text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-glow active:scale-[0.98]"
            aria-label="Request a quote or consultation from Nomadxe"
          >
            Request a Quote
          </a>
        </div>

        {/* Link columns */}
        {Object.entries(FOOTER_LINKS).map(([section, links]) => (
          <div key={section} className="flex flex-col gap-4">
            <p className="font-mono text-xs tracking-widest uppercase text-white/40">{section}</p>
            <nav aria-label={`${section} links`}>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      aria-label={link.label}
                      className="text-sm text-white/50 hover:text-blue transition-colors duration-300"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-12 md:px-16 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/30">
            © 2026 Nomadxe. All rights reserved.
          </p>
          <div className="flex items-center gap-2" aria-label="System status">
            <span
              className="w-2 h-2 rounded-full bg-emerald-400"
              aria-hidden="true"
              style={{ animation: 'pulse-green 2s ease infinite' }}
            />
            <span className="font-mono text-xs text-white/40 tracking-widest uppercase">
              [ ALL SYSTEMS OPERATIONAL ]
            </span>
          </div>
        </div>
      </div>
      {/* build:v2.anim */}
</footer>
  );
}
