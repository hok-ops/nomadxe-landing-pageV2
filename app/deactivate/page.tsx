import type { Metadata } from 'next';
import DeactivateFormClient from './DeactivateFormClient';

export const metadata: Metadata = {
  title: 'Deactivation & Pick-Up Request | NomadXE',
  description: 'Submit a call-off request to schedule retrieval of your NomadXE unit. Our logistics team will confirm a pick-up window within 1-2 business days.',
  robots: { index: false, follow: false },
};

export default function DeactivatePage() {
  return <DeactivateFormClient />;
}
