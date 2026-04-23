'use client';

import { useState, useRef, useLayoutEffect } from 'react';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const SITE_TYPES = [
  'Construction Site',
  'Events & Temporary Venue',
  'Asset Yard / Logistics',
  'Industrial Facility',
  'Remote / Off-Grid Site',
  'Other',
];

export default function ContactForm() {
  const sectionRef = useRef<HTMLElement>(null);
  const [formState, setFormState] = useState<FormState>('idle');
  const [fields, setFields] = useState({
    name: '',
    email: '',
    company: '',
    siteType: '',
    message: '',
  });

  // GSAP entrance
  useLayoutEffect(() => {
    let ctx: { revert: () => void } | null = null;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    import('gsap').then(({ gsap }) =>
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);
        ctx = gsap.context(() => {
          gsap.fromTo(
            '[data-contact-animate]',
            { opacity: 0, y: 32 },
            {
              opacity: 1,
              y: 0,
              duration: 0.8,
              ease: 'power3.out',
              stagger: 0.1,
              scrollTrigger: {
                trigger: sectionRef.current,
                start: 'top 70%',
              },
            }
          );
        }, sectionRef);
      })
    );

    return () => ctx?.revert();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState('submitting');

    try {
      const res = await fetch('https://formspree.io/f/xqeylqgg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: fields.name,
          email: fields.email,
          company: fields.company,
          site_type: fields.siteType,
          message: fields.message,
        }),
      });

      if (res.ok) {
        setFormState('success');
        setFields({ name: '', email: '', company: '', siteType: '', message: '' });
      } else {
        setFormState('error');
      }
    } catch {
      setFormState('error');
    }
  };

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="bg-surface py-28 px-8"
      aria-label="Request a demo"
    >
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-start">

        {/* Left — copy */}
        <div className="flex flex-col gap-8">
          <div data-contact-animate>
            <p className="font-mono text-xs tracking-widest uppercase text-blue/60 mb-4">
              Start with a conversation
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
              We&apos;ll tailor the deployment{' '}
              <em className="font-display italic text-blue not-italic">to your site.</em>
            </h2>
          </div>

          <p data-contact-animate className="text-white/60 leading-relaxed">
            Tell us about the site — acreage, access, incident history. We&apos;ll come back within one
            business day with a deployment plan, timeline, and honest quote. Site walks and assessments
            are follow-ups, not prerequisites.
          </p>

          {/* Trust signals */}
          <div data-contact-animate className="flex flex-col gap-4">
            {[
              { icon: '⚡', label: 'Site-ready in hours, not weeks' },
              { icon: '📡', label: 'Solar, shore, and generator power options' },
              { icon: '🔒', label: 'Vetted monitoring partner network' },
              { icon: '🚛', label: 'Fully mobile — relocate anytime' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-full bg-blue/10 border border-blue/20 flex items-center justify-center text-sm flex-shrink-0"
                  aria-hidden="true"
                >
                  {icon}
                </span>
                <span className="text-sm text-white/70">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div data-contact-animate>
          {formState === 'success' ? (
            <div
              className="bg-midnight rounded-2xl border border-blue/20 p-12 flex flex-col items-center text-center gap-6"
              role="status"
              aria-live="polite"
            >
              <div className="w-16 h-16 rounded-full bg-blue/10 border border-blue/30 flex items-center justify-center text-3xl">
                ✓
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Message received.</h3>
                <p className="text-white/50 text-sm leading-relaxed">
                  We&apos;ll be in touch within one business day with a deployment plan for your site.
                </p>
              </div>
              <button
                onClick={() => setFormState('idle')}
                className="font-mono text-xs tracking-widest uppercase text-blue/70 hover:text-blue transition-colors duration-200"
              >
                Send another →
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-midnight rounded-2xl border border-white/8 p-8 md:p-10 flex flex-col gap-5"
              noValidate
              aria-label="Demo request form"
            >
              {/* Row: Name + Email */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contact-name" className="font-mono text-xs tracking-widest uppercase text-white/40">
                    Name *
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    value={fields.name}
                    onChange={handleChange}
                    placeholder="Jane Smith"
                    className="bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all duration-200 focus:border-blue/60 focus:shadow-blue-glow"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contact-email" className="font-mono text-xs tracking-widest uppercase text-white/40">
                    Email *
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={fields.email}
                    onChange={handleChange}
                    placeholder="jane@company.com"
                    className="bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all duration-200 focus:border-blue/60 focus:shadow-blue-glow"
                  />
                </div>
              </div>

              {/* Row: Company + Site Type */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contact-company" className="font-mono text-xs tracking-widest uppercase text-white/40">
                    Company
                  </label>
                  <input
                    id="contact-company"
                    name="company"
                    type="text"
                    autoComplete="organization"
                    value={fields.company}
                    onChange={handleChange}
                    placeholder="Acme Corp"
                    className="bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all duration-200 focus:border-blue/60 focus:shadow-blue-glow"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contact-site-type" className="font-mono text-xs tracking-widest uppercase text-white/40">
                    Site Type
                  </label>
                  <select
                    id="contact-site-type"
                    name="siteType"
                    value={fields.siteType}
                    onChange={handleChange}
                    className="bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all duration-200 focus:border-blue/60 focus:shadow-blue-glow appearance-none cursor-pointer"
                    style={{ color: fields.siteType ? 'white' : 'rgba(255,255,255,0.2)' }}
                  >
                    <option value="" disabled>Select type…</option>
                    {SITE_TYPES.map((t) => (
                      <option key={t} value={t} style={{ color: 'white', background: '#13151A' }}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Message */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-message" className="font-mono text-xs tracking-widest uppercase text-white/40">
                  Tell us about your site
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  rows={4}
                  value={fields.message}
                  onChange={handleChange}
                  placeholder="Site location, duration, number of cameras needed, timeline…"
                  className="bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all duration-200 focus:border-blue/60 focus:shadow-blue-glow resize-none"
                />
              </div>

              {/* Error banner */}
              {formState === 'error' && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400" role="alert">
                  Something went wrong — please try again or email us at{' '}
                  <a href="mailto:sales@nomadxe.com" className="underline hover:text-red-300">
                    sales@nomadxe.com
                  </a>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={formState === 'submitting'}
                className="w-full bg-blue text-midnight font-semibold rounded-full py-4 text-sm transition-all duration-300 hover:scale-[1.01] hover:shadow-blue-glow active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2"
                aria-busy={formState === 'submitting'}
              >
                {formState === 'submitting' ? (
                  <>
                    <span
                      className="w-4 h-4 rounded-full border-2 border-midnight/30 border-t-midnight animate-spin"
                      aria-hidden="true"
                    />
                    Sending…
                  </>
                ) : (
                  'Request a Quote →'
                )}
              </button>

              <p className="text-center text-xs text-white/25">
                No spam. We&apos;ll only use this to follow up on your request.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
