import Link from 'next/link';

export const metadata = {
  title: 'About Us | NomadXE',
  description: 'Learn about the decades of expertise and customer-first commitment behind NomadXE mobile surveillance.',
};

export default function AboutPage() {
  return (
    <div className="bg-midnight min-h-screen pt-32 pb-24 px-6 md:px-12 flex flex-col items-center">
      <div className="max-w-3xl w-full">
        {/* Punchy Headline */}
        <header className="mb-12 border-b border-white/10 pb-8 text-center md:text-left">
          <p className="font-mono text-xs text-blue/70 uppercase tracking-[0.3em] mb-4">The Foundation</p>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
            Decades of Reliability.<br />
            <span className="text-blue">Customer-First Driven.</span>
          </h1>
        </header>

        {/* Our Story Section */}
        <section className="mb-12">
          <h2 className="font-mono text-xs text-white/40 uppercase tracking-widest mb-6">Our Story</h2>
          <div className="space-y-6 text-lg text-white/70 leading-relaxed font-light">
            <p>
              With over twenty years of hands-on expertise in the mobile trailer and heavy equipment industry, 
              NomadXE wasn&apos;t born in a boardroom—it was built in the field. We understand that in mobile 
              surveillance, reliability isn&apos;t just a feature; it&apos;s the mission.
            </p>
            <p>
              We’ve combined old-school service values with next-generation technology to ensure that 
              wherever your assets are, they are protected by the toughest, smartest infrastructure available.
            </p>
          </div>
        </section>

        {/* Why Us Section */}
        <section className="mb-16 grid md:grid-cols-2 gap-8">
          <div className="bg-surface/50 backdrop-blur-sm border border-white/5 p-8 rounded-2xl">
            <h3 className="text-white font-bold mb-4">Proven Expertise</h3>
            <p className="text-sm text-white/60 leading-relaxed italic">
              &quot;We&apos;ve seen every terrain and every challenge. Our trailers are engineered from decades of real-world deployment data.&quot;
            </p>
          </div>
          <div className="bg-surface/50 backdrop-blur-sm border border-white/5 p-8 rounded-2xl">
            <h3 className="text-white font-bold mb-4">Service Obsession</h3>
            <p className="text-sm text-white/60 leading-relaxed italic">
              &quot;A handshake still means something here. We don&apos;t just lease equipment; we provide an unwavering 24/7 commitment to your uptime.&quot;
            </p>
          </div>
        </section>

        {/* Call to Action */}
        <div className="text-center bg-blue/10 border border-blue/20 rounded-3xl p-12 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue/20 rounded-full blur-[100px] pointer-events-none" />
          <h2 className="text-2xl font-bold text-white mb-6 relative z-10">Ready to secure your perimeter?</h2>
          <Link 
            href="/#contact" 
            className="inline-flex relative z-10 bg-blue text-midnight font-bold tracking-widest uppercase py-4 px-10 rounded-full transition-all duration-300 hover:shadow-blue-glow hover:scale-105 active:scale-95"
          >
            Request a Consultation
          </Link>
        </div>

        <div className="mt-12 text-center">
          <Link href="/" className="text-[10px] font-mono text-white/30 hover:text-white transition-colors uppercase tracking-[0.2em]">
            &larr; Return to main site
          </Link>
        </div>
      </div>
    </div>
  );
}
