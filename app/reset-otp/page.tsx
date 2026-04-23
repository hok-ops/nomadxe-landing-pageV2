import OtpResetForm from '@/app/forgot-password/OtpResetForm';

export const metadata = { title: 'Reset Password | NomadXE' };

export default function ResetOtpPage() {
  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="bg-[#0d1526] border border-[#1e3a5f]/80 rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)]">
          <div className="h-px w-full rounded-t-2xl bg-gradient-to-r from-transparent via-[#3b82f6]/30 to-transparent" />
          <div className="px-8 pt-10 pb-8 sm:px-10 sm:pt-12 sm:pb-10">

            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl bg-[#1e40af]/20 border border-[#3b82f6]/20 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <span className="font-mono text-[22px] font-black tracking-[0.18em] uppercase text-white">
                NOMAD<span className="text-[#3b82f6]">XE</span>
              </span>
              <div className="mt-4 space-y-1">
                <h1 className="text-[17px] font-bold text-white">Reset your password</h1>
                <p className="text-[12px] text-[#93c5fd]/45">Enter the code from your email below.</p>
              </div>
            </div>

            <OtpResetForm prefillEmail="" />
          </div>
        </div>
      </div>
    </div>
  );
}
