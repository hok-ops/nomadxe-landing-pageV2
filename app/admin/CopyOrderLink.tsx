'use client';

import { useState } from 'react';

export default function CopyOrderLink() {
  const [copied, setCopied] = useState(false);

  const orderUrl =
    (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.nomadxe.com') + '/order';

  function handleCopy() {
    navigator.clipboard.writeText(orderUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section className="bg-[#0d1526] border border-[#1e3a5f] rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-white mb-1">Order Form Link</h2>
        <p className="text-[11px] text-[#93c5fd]/70 leading-relaxed">
          Send this link to a client so they can submit a deployment order.
        </p>
      </div>

      {/* URL display */}
      <div className="flex items-center gap-2 bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-xs text-[#93c5fd]/80 font-mono overflow-hidden">
        <span className="truncate flex-1">{orderUrl}</span>
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className={`w-full font-bold py-3 rounded-lg text-sm transition-all active:scale-[0.98] ${
          copied
            ? 'bg-emerald-700/40 border border-emerald-500/40 text-emerald-300'
            : 'border border-[#1e40af]/60 text-[#93c5fd]/70 hover:bg-[#1e40af]/20'
        }`}
      >
        {copied ? '✓ Copied!' : 'Copy Link'}
      </button>
    </section>
  );
}
