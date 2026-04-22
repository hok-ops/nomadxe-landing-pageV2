'use client';

import { useState } from 'react';

function CopyLinkCard({
  title,
  description,
  path,
  accentColor,
}: {
  title: string;
  description: string;
  path: string;
  accentColor: 'blue' | 'red' | 'amber';
}) {
  const [copied, setCopied] = useState(false);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.nomadxe.com';
  const fullUrl = siteUrl.replace(/\/$/, '') + path;

  const colorMap = {
    blue:  { border: 'border-[#1e40af]/60', hover: 'hover:bg-[#1e40af]/20', text: 'text-[#93c5fd]/70', ok: 'bg-emerald-700/40 border border-emerald-500/40 text-emerald-300' },
    red:   { border: 'border-red-900/60',   hover: 'hover:bg-red-950/20',   text: 'text-red-400/70',   ok: 'bg-emerald-700/40 border border-emerald-500/40 text-emerald-300' },
    amber: { border: 'border-amber-900/60', hover: 'hover:bg-amber-950/20', text: 'text-amber-400/70', ok: 'bg-emerald-700/40 border border-emerald-500/40 text-emerald-300' },
  };
  const c = colorMap[accentColor];

  function handleCopy() {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-white mb-0.5">{title}</h3>
        <p className="text-[11px] text-[#93c5fd]/70 leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center gap-2 bg-[#080c14] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-xs text-[#93c5fd]/80 font-mono overflow-hidden">
        <span className="truncate flex-1">{fullUrl}</span>
      </div>
      <button
        onClick={handleCopy}
        className={`w-full font-bold py-2.5 rounded-lg text-sm transition-all active:scale-[0.98] ${copied ? c.ok : `border ${c.border} ${c.text} ${c.hover}`}`}
      >
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
    </div>
  );
}

export default function CopyOrderLink() {
  return (
    <section className="bg-[#0d1526] border border-[#1e3a5f] rounded-xl p-6 space-y-6">
      <h2 className="text-sm font-bold text-white">Client Form Links</h2>
      <CopyLinkCard
        title="Order Form"
        description="Send to a client to secure a new deployment."
        path="/order"
        accentColor="blue"
      />
      <div className="border-t border-[#1e3a5f]/50" />
      <CopyLinkCard
        title="Deactivation & Pick-Up"
        description="Client submits a call-off and pick-up request."
        path="/deactivate"
        accentColor="red"
      />
      <div className="border-t border-[#1e3a5f]/50" />
      <CopyLinkCard
        title="Trailer Relocation"
        description="Client requests a site-to-site unit transfer."
        path="/relocate"
        accentColor="amber"
      />
    </section>
  );
}
