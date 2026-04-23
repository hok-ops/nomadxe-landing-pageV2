import Link from 'next/link';

export const metadata = { title: 'Authentication Error | NomadXE' };

export default function AuthCodeErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const message = searchParams.error
    ? decodeURIComponent(searchParams.error)
    : 'This authentication link has expired or has already been used.';
  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-6 relative overflow-hidden">
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="bg-[#0d1526] border border-[#1e3a5f] rounded-2xl p-10 text-center space-y-6">
          <div className="w-12 h-12 rounded-xl bg-red-900/20 border border-red-500/20 flex items-center justify-center mx-auto">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <div>
            <span className="font-mono text-[18px] font-black tracking-[0.18em] uppercase text-white">
              NOMAD<span className="text-[#3b82f6]">XE</span>
            </span>
            <h1 className="text-white font-bold text-lg mt-3 mb-2">Link Expired or Invalid</h1>
            <p className="text-[#93c5fd]/50 text-sm leading-relaxed">
              {message}
            </p>
          </div>

          <div className="flex flex-col gap-3 items-center">
            <Link
              href="/forgot-password"
              className="inline-block bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold px-6 py-3 rounded-xl text-sm transition-all hover:shadow-[0_0_28px_rgba(59,130,246,0.45)]"
            >
              Request New Link
            </Link>
            <Link href="/login" className="text-sm text-[#3b82f6]/70 hover:text-[#3b82f6] transition-colors">
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
