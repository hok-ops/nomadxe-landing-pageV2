import type { Metadata } from 'next';
import './globals.css';
import React from 'react';

const DESCRIPTION =
  'Nomadxe deploys mobile surveillance infrastructure to sites traditional security cannot reach. No cables. No delays. Full visibility.';

const OG_DESCRIPTION =
  'Nomadxe deploys mobile surveillance infrastructure to sites traditional security cannot reach.';

export const metadata: Metadata = {
  title: 'Nomadxe | Mobile Surveillance Infrastructure',
  description: DESCRIPTION,
  openGraph: {
    title: 'Nomadxe | Mobile Surveillance Infrastructure',
    description: OG_DESCRIPTION,
    type: 'website',
    locale: 'en_US',
    siteName: 'Nomadxe',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nomadxe | Mobile Surveillance Infrastructure',
    description: OG_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,400;1,700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-midnight text-white antialiased">
        {children}
      </body>
    </html>
  );
}
