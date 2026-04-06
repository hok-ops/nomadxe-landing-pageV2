import Link from 'next/link';

export const metadata = {
  title: 'About Us | NomadXE',
  description: 'Learn about the decades of expertise and customer-first commitment behind NomadXE mobile surveillance.',
};

export default function AboutPage() {
  return (
    <div className="bg-midnight min-h-screen pt-32 pb-24 px-6 md:px-12 flex flex-col items-center">
      <div className="max-w-3xl w-full">
        {/* Humble Headline */}
        <header className="mb-12 border-b border-white/10 pb-8 text-center md:text-left">
          <p className="font-mono text-xs text-blue/70 uppercase tracking-[0.3em] mb-4">The Foundation</p>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
            Committed Service.<br />
            <span className="text-blue">Built on Experience.</span>
          </h1>
        </header>

        {/* Real Story Section */}
        <section className="mb-12 text-center md:text-left">
          <h2 className="font-mono text-xs text-white/40 uppercase tracking-widest mb-6 underline decoration-blue/30 underline-offset-8">Our Journey</h2>
          <div className="space-y-6 text-lg text-white/70 leading-relaxed font-light">
            <p>
              With years of hands-on expertise in the mobile trailer and heavy equipment industry, we&apos;ve 
              learned that field conditions are unpredictable. NomadXE wasn&apos;t built to be a perfect system—it 
              was built to provide a reliable, resilient infrastructure that we stand by every day.
            </p>
            <p>
              We aim for the best possible service in the market, acknowledging the complexities of mobile 
              deployments and prioritizing the uptime of your assets above all else.
            </p>
          </div>
        </section>

        {/* Grounded Why Us Section */}
        <section className="mb-16 grid md:grid-cols-2 gap-8">
          <div className="bg-surface/50 backdrop-blur-sm border border-white/5 p-8 rounded-2xl relative group overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5 font-mono text-xs uppercase tracking-widest">[ Field Proven ]</div>
            <h3 className="text-white font-bold mb-4">Realworld Expertise</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              We&apos;ve worked across challenging terrains and complex sites. Our trailers are engineered from 
              years of practical deployment data, built for durability and continuous operation.
            </p>
          </div>
          <div className="bg-surface/50 backdrop-blur-sm border border-white/5 p-8 rounded-2xl relative group overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5 font-mono text-xs uppercase tracking-widest">[ Active Support ]</div>
            <h3 className="text-white font-bold mb-4">Dedicated Service</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              We aim to provide the best service possible. When things go wrong in the field, we identify, 
              respond, and resolve. Our goal is minimal downtime through proactive site management.
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
