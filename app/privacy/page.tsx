import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | NomadXE',
  description: 'Privacy Policy regarding the capture and retention of video surveillance data via NomadXE infrastructure.',
};

export default function PrivacyPage() {
  return (
    <div className="bg-surface min-h-screen pt-32 pb-24 px-8">
      <div className="max-w-3xl mx-auto text-white/80">
        <h1 className="text-4xl text-white font-bold mb-8">Privacy Policy</h1>
        <p className="mb-4 text-sm tracking-widest text-blue/60 uppercase">Last Updated: April 5, 2026</p>

        <section className="mb-8">
          <h2 className="text-2xl text-white font-semibold mb-4">1. Data Capture</h2>
          <p className="mb-4 leading-relaxed">
            NomadXE mobile surveillance trailers are equipped to capture high-definition video, telemetry data, thermal imaging, and AI-driven analytics (such as automated license plate reading and perimeter intrusion detection). This data is captured to ensure the safety and security of the deployment site.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl text-white font-semibold mb-4">2. Lessee Responsibilities</h2>
          <p className="mb-4 leading-relaxed">
            The lessee of the NomadXE equipment is the data controller. It is the lessee&apos;s sole responsibility to ensure that adequate and legally compliant notification signage is displayed at the deployment site to inform individuals that video surveillance and recording are in operation.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl text-white font-semibold mb-4">3. Data Retention</h2>
          <p className="mb-4 leading-relaxed">
            Video footage is stored locally on the Equipment and synced to secured cloud servers over cellular networks. Standard retention policy stores footage for up to 30 days, after which it is automatically overwritten unless explicitly archived or flagged due to an ongoing investigation.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl text-white font-semibold mb-4">4. Law Enforcement and Third-Party Sharing</h2>
          <p className="mb-4 leading-relaxed">
            NomadXE does not sell or share surveillance footage with direct third-party marketers. We may disclose retained footage to our authorized monitoring partners (e.g. SEC, AUS, AlphaVision) to actively manage site security, or to law enforcement agencies upon receipt of a valid subpoena, court order, or formal request.
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
