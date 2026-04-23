'use client';

/* Placeholder partner logos — styled SVG text.
   TODO: replace with real partner SVG logos when available. */
const PARTNERS: Array<{ name: string; abbr: string; url?: string }> = [];

function PartnerLogo({ name, abbr, url }: { name: string; abbr: string; url?: string }) {
  const content = (
    <div
      className="group flex items-center justify-center px-6 py-4 rounded-xl border border-white/5 transition-all duration-300 hover:border-blue/30 hover:shadow-blue-glow cursor-pointer"
      title={name}
      aria-label={name}
    >
      <span className="font-sans font-bold text-2xl text-white/25 group-hover:text-blue/80 transition-colors duration-300 tracking-wider select-none">
        {abbr}
      </span>
    </div>
  );

  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : content;
}

export default function MonitoringPartners() {
  return (
    <section
      id="partners"
      className="bg-surface py-24 px-8"
      aria-label="Monitoring partners"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="font-mono text-xs tracking-widest uppercase text-blue/60 mb-4">Network</p>
          <h2 className="text-3xl md:text-4xl font-sans font-bold tracking-tight text-white">
            We work with leading monitoring partners — <span className="text-blue">or yours.</span>
          </h2>
          <p className="mt-6 text-white/50 max-w-xl mx-auto leading-relaxed">
            Nomadxe integrates with your preferred monitoring station. If you don&apos;t have one,
            we&apos;ll connect you with a vetted partner from our network.
          </p>
        </div>

        {/* Logo row */}
        <div
          className="flex flex-wrap justify-center gap-4 items-center mb-16"
          aria-label="Partner logos"
        >
          {PARTNERS.map((p) => (
            <PartnerLogo key={p.name} {...p} />
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
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
