import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | NomadXE',
  description: 'Terms and Conditions regarding the lease and operation of NomadXE mobile surveillance infrastructure.',
};

export default function TermsPage() {
  return (
    <div className="bg-surface min-h-screen pt-32 pb-24 px-8">
      <div className="max-w-3xl mx-auto text-white/80">
        <h1 className="text-4xl text-white font-bold mb-8">Terms of Service</h1>
        <p className="mb-4 text-sm tracking-widest text-blue/60 uppercase">Last Updated: April 5, 2026</p>

        <section className="mb-8">
          <h2 className="text-2xl text-white font-semibold mb-4">1. Acceptance of Terms</h2>
          <p className="mb-4 leading-relaxed">
            By leasing, renting, or operating NomadXE hardware, mobile surveillance trailers, or related software services (the &quot;Equipment&quot;), you agree to be bound by these Terms of Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl text-white font-semibold mb-4">2. Risk of Loss and Liability</h2>
          <p className="mb-4 leading-relaxed">
            Upon delivery of the Equipment to the designated deployment site, the lessee assumes all risk of loss, damage, theft, or destruction. NomadXE shall not be liable for any damage to the Equipment caused by severe weather, vandalism, accidents, or improper handling by the lessee or third parties at the site.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl text-white font-semibold mb-4">3. Operation and Movement</h2>
          <p className="mb-4 leading-relaxed">
            Lessee agrees to abide by all operational guidelines provided by NomadXE. This includes strictly following procedures for lowering the surveillance mast prior to any movement of the trailer. Lessee is strictly liable for any damage incurred during the relocation or unauthorized modification of the Equipment.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl text-white font-semibold mb-4">4. Indemnification</h2>
          <p className="mb-4 leading-relaxed">
            Lessee agrees to indemnify, defend, and hold harmless NomadXE, its affiliates, and monitoring partners against any and all claims, damages, losses, liabilities, or expenses (including legal fees) arising out of or related to the use, operation, or deployment of the Equipment on the lessee&apos;s property.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl text-white font-semibold mb-4">5. Limitation of Liability</h2>
          <p className="mb-4 leading-relaxed">
            NomadXE provides the Equipment &quot;as-is&quot;. Under no circumstances will NomadXE be liable for consequential, incidental, special, or indirect damages, including but not loss of profits or business interruption.
          </p>
        </section>

        <div className="mt-16 pt-8 border-t border-white/10 text-center">
          <Link href="/" className="text-blue hover:text-white transition-colors">
            &larr; Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
