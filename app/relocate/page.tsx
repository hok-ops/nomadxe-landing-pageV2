import type { Metadata } from 'next';
import RelocateFormClient from './RelocateFormClient';

export const metadata: Metadata = {
  title: 'Trailer Relocation Request | NomadXE',
  description: 'Request a site-to-site transfer of your NomadXE unit. Our logistics team will coordinate pickup and delivery with both site contacts.',
  robots: { index: false, follow: false },
};

export default function RelocatePage() {
  return <RelocateFormClient />;
}
