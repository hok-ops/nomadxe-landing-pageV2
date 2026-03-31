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

export default function Home() {
  return (
    <>
      <Navbar />
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
