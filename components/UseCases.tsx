'use client';

import Image from 'next/image';

const BLUR_DATA =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUE/8QAIRAAAQQCAgMAAAAAAAAAAAAAAQIDBAURITFBUWH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Amz17TaZdLc2yxH2GUNBKnHCpRJPAA7n4rP6m1ZTQbzRdJpBkGQxHZL7ylHYRtSBx+/2rRRQB/9k=';

const USE_CASES = [
  {
    title: 'Construction & Civil',
    descriptor: 'ACTIVE SITE MONITORING',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=70',
    // TODO: replace with final brand imagery
  },
  {
    title: 'Remote Energy & Utilities',
    descriptor: 'PERIMETER SURVEILLANCE',
    image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&q=70',
  },
  {
    title: 'Events & Temporary Venues',
    descriptor: 'CROWD & ACCESS CONTROL',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=70',
  },
  {
    title: 'Asset Yards & Logistics',
    descriptor: 'INVENTORY PROTECTION',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=70',
  },
];

/* Amber corner bracket SVG */
function CornerBracket() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      className="text-amber/60"
      aria-hidden="true"
    >
      <path d="M2 16 L2 2 L16 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function UseCases() {
  return (
    <section
      id="use-cases"
      className="bg-midnight py-24 px-8"
      aria-label="Nomadxe use cases"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="font-mono text-xs tracking-widest uppercase text-blue/60 mb-4">Applications</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Where Nomadxe{' '}
            <em className="font-display italic text-blue not-italic">deploys.</em>
          </h2>
        </div>

        {/* Desktop 2×2 grid / Mobile horizontal scroll */}
        <div
          className="grid md:grid-cols-2 gap-6 overflow-x-auto md:overflow-visible scrollbar-hide snap-x snap-mandatory md:snap-none flex md:grid"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {USE_CASES.map((uc) => (
            <article
              key={uc.title}
              className="relative rounded-2xl overflow-hidden bg-surface group cursor-default snap-start flex-shrink-0 w-[80vw] md:w-auto"
              style={{ aspectRatio: '4/3' }}
              aria-label={`Use case: ${uc.title}`}
            >
              {/* Background image */}
              <Image
                src={uc.image}
                alt=""
                aria-hidden="true"
                fill
                sizes="(max-width: 768px) 80vw, 50vw"
                className="object-cover opacity-40 group-hover:opacity-55 group-hover:scale-105 transition-all duration-500 ease-out"
                placeholder="blur"
                blurDataURL={BLUR_DATA}
              />

              {/* Gradient overlay */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/40 to-transparent"
              />

              {/* Corner bracket */}
              <div className="absolute top-4 left-4 z-10">
                <CornerBracket />
              </div>

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 z-10 p-6">
                <p className="font-mono text-xs text-white/60 tracking-widest uppercase mb-2">
                  {uc.descriptor}
                </p>
                <h3 className="font-sans font-bold text-xl text-white">{uc.title}</h3>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
