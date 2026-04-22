'use client';

import { useState } from 'react';

const FORMS = [
  {
    title: 'Order Form',
    description: 'Send to a client to secure a new deployment.',
    path: '/order',
    accent: {
      dot: 'bg-[#3b82f6] shadow-[0_0_8px_#3b82f6]',
      badge: 'bg-[#1e40af]/20 text-[#93c5fd] border border-[#1e40af]/50',
      url: 'text-[#3b82f6] hover:text-[#60a5fa]',
      copyIdle: 'border-[#1e40af]/60 text-[#93c5fd]/60 hover:bg-[#1e40af]/20 hover:text-[#93c5fd]',
    },
  },
  {
    title: 'Deactivation & Pick-Up',
    description: 'Client submits a call-off and pick-up request.',
    path: '/deactivate',
    accent: {
      dot: 'bg-red-500 shadow-[0_0_8px_#ef4444]',
      badge: 'bg-red-950/20 text-red-400 border border-red-900/50',
      url: 'text-red-400 hover:text-red-300',
      copyIdle: 'border-red-900/60 text-red-400/60 hover:bg-red-950/20 hover:text-red-400',
    },
  },
  {
    title: 'Trailer Relocation',
    description: 'Client requests a site-to-site unit transfer.',
    path: '/relocate',
    accent: {
      dot: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
      badge: 'bg-amber-950/20 text-amber-400 border border-amber-900/50',
      url: 'text-amber-400 hover:text-amber-300',
      copyIdle: 'border-amber-900/60 text-amber-400/60 hover:bg-amber-950/20 hover:text-amber-400',
    },
  },
] as const;

function FormLinkRow({
  title,
  description,
  path,
  accent,
}: (typeof FORMS)[number]) {
  const [copied, setCopied] = useState(false);
  const siteUrl =
    (typeof window !== 'undefined' && (process.env.NEXT_PUBLIC_SITE_URL ?? '')) ||
    'https://www.nomadxe.com';
  const fullUrl = siteUrl.replace(/\/$/, '') + path;

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="group rounded-xl border border-[#1e3a5f] bg-[#080c14] p-4 transition-colors hover:border-[#2a4a7f]/70">
      {/* Row 1: dot + title link + copy button */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-[3px] ${accent.dot}`} />
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold text-white hover:underline underline-offset-2 decoration-[#3b82f6]/50 truncate"
          >
            {title}
            <svg
              className="inline-block ml-1.5 mb-[2px] opacity-40 group-hover:opacity-70 transition-opacity"
              width="11" height="11" viewBox="0 0 12 12" fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M2.5 1.5H10.5V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
        <button
          onClick={handleCopy}
          className={`flex-shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${
            copied
              ? 'bg-emerald-800/40 border-emerald-500/40 text-emerald-300'
              : accent.copyIdle
          }`}
          aria-label={`Copy ${title} link`}
        >
          {copied ? (
            <>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.5 6.5L4.5 9.5L10.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4.5" y="4.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4.5 7.5H3C2.17 7.5 1.5 6.83 1.5 6V3C1.5 2.17 2.17 1.5 3 1.5H6C6.83 1.5 7.5 2.17 7.5 3V4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Row 2: description */}
      <p className="text-[11px] text-[#93c5fd]/60 leading-relaxed mt-1.5 ml-[18px]">
        {description}
      </p>

      {/* Row 3: URL bar — clickable */}
      <a
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`block mt-3 ml-[18px] text-[10px] font-mono truncate transition-colors ${accent.url}`}
        title={fullUrl}
      >
        {fullUrl}
      </a>
    </div>
  );
}

export default function CopyOrderLink() {
  return (
    <section className="bg-[#0d1526] border border-[#1e3a5f] rounded-xl p-5 space-y-3">
      <h2 className="text-[10px] font-bold text-[#93c5fd]/70 uppercase tracking-widest px-1">
        Client Form Links
      </h2>
      {FORMS.map(form => (
        <FormLinkRow key={form.path} {...form} />
      ))}
    </section>
  );
}
