'use client';

const FEATURES = [
  { label: 'AI Inspector',        desc: 'Autonomous PTZ patrol & real-time object detection across every camera' },
  { label: 'AI Deterrence Agent', desc: 'Responds to threats with automated audio warnings before escalation'   },
  { label: 'AI Investigator',     desc: 'Natural language & image-based search across all recorded footage'      },
  { label: 'Automated Reporting', desc: 'Daily intelligence summaries, incident timelines & delivery logs'       },
];

const CREDENTIALS = ['Backed by NEC', 'Axis Partner', 'NDAA Compliant'];

export default function MonitoringPartners() {
  return (
    <section
      id="partners"
      className="bg-midnight py-28 px-6 md:px-8"
      aria-label="Monitoring partners"
    >
      <div className="max-w-5xl mx-auto">

        {/* ── Partnership Header ───────────────────────────────────── */}
        <div className="text-center mb-16">
          <p className="font-mono text-xs tracking-widest uppercase text-blue/60 mb-4">
            Option 02 · Fully Equipped
          </p>
          <h2 className="text-3xl md:text-5xl font-sans font-bold tracking-tight text-white leading-tight mb-6">
            Your site is secured{' '}
            <span className="text-blue">before you arrive.</span>
          </h2>
          <p className="text-base md:text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
            The{' '}
            <a href="#deployment" className="text-white/70 hover:text-blue transition-colors duration-200 underline underline-offset-2 decoration-white/20">
              Fully Equipped lease
            </a>
            {' '}ships with AI already running on the trailer.
            You pull up. You&apos;re live. No setup, no integration, no on-site IT.
          </p>
        </div>

        {/* ── Alpha Vision AGI7 Partner Card ──────────────────────── */}
        <div className="mb-20 rounded-2xl border border-white/[0.08] bg-surface overflow-hidden shadow-[0_24px_64px_-12px_rgba(14,165,233,0.14)]">

          {/* Card header stripe */}
          <div className="px-8 py-4 border-b border-white/[0.06] flex items-center justify-between bg-[#0d1018]">
            <div className="flex items-center gap-2.5">
              <span className="relative inline-flex w-2 h-2 flex-shrink-0">
                <span className="absolute inline-block w-2 h-2 rounded-full bg-blue animate-pulseRing" />
                <span className="relative inline-block w-2 h-2 rounded-full bg-blue" />
              </span>
              <span className="font-mono text-[10px] tracking-widest uppercase text-blue/65">
                Featured AI Platform
              </span>
            </div>
            <a
              href="https://alphavision.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] tracking-wider text-white/25 hover:text-blue/70 transition-colors duration-200 uppercase"
            >
              alphavision.ai ↗
            </a>
          </div>

          {/* Card body */}
          <div className="px-8 py-10 md:px-12 md:py-12">

            {/* Name + subtitle */}
            <div className="mb-8">
              <h3 className="text-3xl md:text-4xl font-sans font-bold text-white tracking-tight leading-tight mb-2">
                Alpha Vision AGI7
              </h3>
              <p className="font-mono text-[11px] tracking-wider text-white/35 uppercase">
                Physical AI Platform · AGI7 Inc. · Redwood City, CA
              </p>
            </div>

            {/* Description */}
            <p className="text-base text-white/55 leading-relaxed max-w-3xl mb-10">
              Alpha Vision AGI7 is built for exactly this environment — remote sites, mobile
              infrastructure, and no on-site IT. Its Physical AI agents work the site continuously:
              patrolling on schedule, issuing real-time audio deterrents when a threat appears,
              and making every recorded incident searchable by natural language in seconds.
              This isn&apos;t a camera system with alerts bolted on. It&apos;s an autonomous security
              workforce running 24/7 from the trailer mast.
            </p>

            {/* Feature grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/[0.04] rounded-xl overflow-hidden mb-10 border border-white/[0.06]">
              {FEATURES.map(f => (
                <div key={f.label} className="bg-surface px-6 py-5 hover:bg-[#181d26] transition-colors duration-300">
                  <div className="flex items-start gap-3">
                    <span className="mt-[5px] w-1.5 h-1.5 flex-shrink-0 rounded-full bg-blue/60" />
                    <div>
                      <div className="text-sm font-semibold text-white/85 mb-1">{f.label}</div>
                      <div className="text-[13px] text-white/38 leading-snug">{f.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Credentials + CTA row */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {CREDENTIALS.map(tag => (
                  <span
                    key={tag}
                    className="font-mono text-[9px] tracking-wider text-white/30 border border-white/[0.08] rounded-full px-3 py-1 uppercase"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <a
                href="https://alphavision.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue hover:text-blue-light transition-colors duration-200 group"
                aria-label="Learn about the Alpha Vision AGI7 platform (opens in new tab)"
              >
                Learn about the platform
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </a>
            </div>
          </div>
        </div>

        {/* ── Monitoring Partners Message ──────────────────────────── */}
        <div className="text-center mb-10 pt-4 border-t border-white/[0.05]">
          <p className="font-mono text-xs tracking-widest uppercase text-blue/60 mb-4 mt-10">
            Network
          </p>
          <h3 className="text-2xl md:text-3xl font-sans font-bold tracking-tight text-white mb-5">
            We work with leading monitoring partners —{' '}
            <span className="text-blue">or yours.</span>
          </h3>
          <p className="text-white/50 max-w-xl mx-auto leading-relaxed mb-10">
            Nomadxe integrates with your preferred monitoring station. If you don&apos;t have one,
            we&apos;ll connect you with a vetted partner from our network.
          </p>
          <a
            href="#contact"
            className="inline-flex items-center border border-white/20 text-white font-semibold rounded-full px-8 py-3 text-sm transition-all duration-300 hover:border-blue hover:text-blue hover:scale-[1.02] active:scale-[0.98]"
            aria-label="Talk to us about monitoring partners"
          >
            Talk to Us About Partners
          </a>
        </div>

      </div>
    </section>
  );
}
