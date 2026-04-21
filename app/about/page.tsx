import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us | Beyond the Unit | NomadXE',
  description: 'NomadXE is built on the belief that reliability in the field isn’t just about hardware—it’s about the tireless support and commitment that keeps your mission moving.',
  keywords: ['mobile surveillance service', 'trailer uptime', 'remote site security support', 'NomadXE expertise'],
};

export default function AboutPage() {
  return (
    <div className="bg-midnight min-h-screen pt-32 pb-24 px-6 md:px-12 flex flex-col items-center">
      <div className="max-w-3xl w-full">
        {/* Psychological Hook Headline */}
        <header className="mb-12 border-b border-white/10 pb-8 text-center md:text-left">
          <p className="font-mono text-xs text-blue/70 uppercase tracking-[0.3em] mb-4">The Mission</p>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
            Beyond the Unit.<br />
            <span className="text-blue">Behind the Mission.</span>
          </h1>
        </header>

        {/* The Partnership Story */}
        <section className="mb-12 text-center md:text-left">
          <h2 className="font-mono text-xs text-white/40 uppercase tracking-widest mb-6 underline decoration-blue/30 underline-offset-8">Our Philosophy</h2>
          <div className="space-y-6 text-lg text-white/70 leading-relaxed font-light">
            <p>
              We&apos;ve learned that reliability in the field isn&apos;t just about what&apos;s on the hitch—it&apos;s 
              about who&apos;s on the other end of the line. NomadXE was founded on the principle that 
              while equipment provides the platform, it&apos;s the unwavering commitment to the mission 
              that carries the day.
            </p>
            <p>
              We don&apos;t just lease hardware; we provide the tireless effort required to keep it 
              operational in environments that never stop testing its limits. Our reputation isn&apos;t 
              measured in units deployed, but in the uptime we maintain for our clients.
            </p>
          </div>
        </section>

        {/* Human-Centric Service Section */}
        <section className="mb-16 grid md:grid-cols-2 gap-8">
          <div className="bg-surface/50 backdrop-blur-sm border border-white/5 p-8 rounded-2xl relative group overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5 font-mono text-xs uppercase tracking-widest">[ Shared Stakes ]</div>
            <h3 className="text-white font-bold mb-4">A Perfect Partner</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              While others focus strictly on specifications, we focus on presence. We pride ourselves on 
              being a partner that outworks the field, ensuring that when challenges arise, you have a 
              team already moving toward a resolution.
            </p>
          </div>
          <div className="bg-surface/50 backdrop-blur-sm border border-white/5 p-8 rounded-2xl relative group overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5 font-mono text-xs uppercase tracking-widest">[ Grit & Support ]</div>
            <h3 className="text-white font-bold mb-4">Persistent Service</h3>
            <h4 className="text-xs text-blue/60 mb-2 uppercase tracking-widest font-mono">Priding on presence.</h4>
            <p className="text-sm text-white/60 leading-relaxed">
              We aim for the best possible version of support. We identify, respond, and resolve with 
              a focus on the human effort required to manage the complexities of mobile deployment. 
              Your uptime is our reputation.
            </p>
          </div>
        </section>

        {/* Call to Action */}
        <div className="text-center bg-blue/10 border border-blue/20 rounded-3xl p-12 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue/20 rounded-full blur-[100px] pointer-events-none" />
          <h2 className="text-2xl font-bold text-white mb-6 relative z-10">Ready for a partner that outworks the field?</h2>
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
