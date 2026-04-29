import { redirect } from 'next/navigation';
import AuthHashProcessor from '../components/AuthHashProcessor';
import JsonLd from '../components/JsonLd';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Features from '../components/Features';
import HowItWorks from '../components/HowItWorks';
import Manifesto from '../components/Manifesto';
import TwoOptions from '../components/TwoOptions';
import MonitoringPartners from '../components/MonitoringPartners';
import UseCases from '../components/UseCases';
import ContactForm from '../components/ContactForm';
import Footer from '../components/Footer';
import ScrollReveal from '../components/ScrollReveal';

// Supabase auth callbacks land here. Catch auth params and forward appropriately.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string; error_code?: string; error_description?: string }>;
}) {
  const query = await searchParams;
  // Successful auth redirect — forward to the route handler
  if (query.code) {
    redirect(`/auth/confirm?code=${encodeURIComponent(query.code)}`);
  }
  if (query.token_hash && query.type) {
    redirect(
      `/auth/confirm?token_hash=${encodeURIComponent(query.token_hash)}&type=${encodeURIComponent(query.type)}`
    );
  }
  // Supabase error redirect (expired/invalid OTP) — show proper error page
  if (query.error_code) {
    redirect(
      `/auth/auth-code-error?error=${encodeURIComponent(query.error_description ?? query.error_code)}`
    );
  }

  return (
    <>
      <JsonLd />
      <AuthHashProcessor />
      <Navbar />
      <ScrollReveal />
      <main id="main">
        <Hero />
        <Features />
        <HowItWorks />
        <Manifesto />
        <TwoOptions />
        <MonitoringPartners />
        <UseCases />
        <ContactForm />
        <Footer />
      </main>
    </>
  );
}
