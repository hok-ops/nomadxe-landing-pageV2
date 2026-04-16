import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import OrderFormClient from './OrderFormClient';

export const metadata: Metadata = {
  title: 'Place a Deployment Order | NomadXE',
  description:
    'Secure your NomadXE mobile surveillance trailer deployment. Fill out the order form and our SOC team will confirm your site profile within one business day.',
  robots: { index: false, follow: false }, // order page excluded from search indexes
};

export default function OrderPage() {
  return (
    <>
      <Navbar />
      <main id="main">
        <OrderFormClient />
      </main>
      <Footer />
    </>
  );
}
