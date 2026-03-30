import Hero from '../components/Hero';
import TheProblem from '../components/TheProblem';
import HowItWorks from '../components/HowItWorks';
import TwoOptions from '../components/TwoOptions';
import MonitoringPartners from '../components/MonitoringPartners';
import UseCases from '../components/UseCases';
import WhyNomadxe from '../components/WhyNomadxe';
import FooterCTA from '../components/FooterCTA';

export default function Home() {
  return (
    <main>
      <Hero />
      <TheProblem />
      <HowItWorks />
      <TwoOptions />
      <MonitoringPartners />
      <UseCases />
      <WhyNomadxe />
      <FooterCTA />
    </main>
  );
}
