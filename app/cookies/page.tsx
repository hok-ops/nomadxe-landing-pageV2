import Link from 'next/link';

export const metadata = {
  title: 'Cookie Policy | NomadXE',
  description: 'Cookie Policy regarding the NomadXE web platform.',
};

export default function CookiesPage() {
  return (
    <div className="bg-surface min-h-screen pt-32 pb-24 px-8 md:px-16">
      <div className="max-w-3xl mx-auto text-white/80">
        <h1 className="text-4xl md:text-5xl text-white font-bold mb-8">Cookie Policy</h1>
        <p className="mb-4 text-sm tracking-widest text-blue/60 uppercase">Last Updated: April 5, 2026</p>

        <section className="mb-8">
          <h2 className="text-2xl text-white font-semibold mb-4">1. What Are Cookies</h2>
          <p className="mb-4 leading-relaxed">
            Cookies are small text files that are placed on your computer or mobile device when you visit our website. They are widely used to make websites work more efficiently and to provide platform analytics to the owners of the site.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl text-white font-semibold mb-4">2. How We Use Cookies</h2>
          <p className="mb-4 leading-relaxed">
            NomadXE uses cookies to understand how you interact with our platform, to keep our website secure, and to provide a high-quality user experience. We do not use advertising cookies to track you across the internet.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl text-white font-semibold mb-4">3. Managing Your Preferences</h2>
          <p className="mb-4 leading-relaxed">
            You can configure your browser to refuse all or some browser cookies, or to alert you when websites set or access cookies. If you disable or refuse cookies, please note that some parts of the NomadXE site may become inaccessible or not function properly.
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
