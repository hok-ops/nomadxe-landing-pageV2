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
export default function Home({
  searchParams,
}: {
  searchParams: { code?: string; token_hash?: string; type?: string; error_code?: string; error_description?: string };
}) {
  // Successful auth redirect — forward to the route handler
  if (searchParams.code) {
    redirect(`/auth/confirm?code=${encodeURIComponent(searchParams.code)}`);
  }
  if (searchParams.token_hash && searchParams.type) {
    redirect(
      `/auth/confirm?token_hash=${encodeURIComponent(searchParams.token_hash)}&type=${encodeURIComponent(searchParams.type)}`
    );
  }
  // Supabase error redirect (expired/invalid OTP) — show proper error page
  if (searchParams.error_code) {
    redirect(
      `/auth/auth-code-error?error=${encodeURIComponent(searchParams.error_description ?? searchParams.error_code)}`
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
        <UseCases />
        <MonitoringPartners />
        <ContactForm />
        <Footer />
      </main>
    </>
  );
}
