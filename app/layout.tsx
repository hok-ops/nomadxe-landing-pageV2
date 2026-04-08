import type { Metadata } from 'next';
import { Inter, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import React from 'react';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const DESCRIPTION =
  'NomadXE deploys robust mobile surveillance infrastructure to sites where traditional security cannot reach. Reliable, service-first, and rapidly deployable.';

export const metadata: Metadata = {
  metadataBase: new URL('https://nomadxe.com'),
  title: {
    default: 'NomadXE | Mobile Surveillance Infrastructure',
    template: '%s | NomadXE',
  },
  description: DESCRIPTION,
  keywords: [
    'mobile surveillance',
    'site security',
    'remote monitoring',
    'surveillance trailers',
    'NomadXE',
    'construction site security',
    'mobile solar security',
  ],
  authors: [{ name: 'NomadXE Team' }],
  creator: 'NomadXE',
  openGraph: {
    title: 'NomadXE | Mobile Surveillance Infrastructure',
    description: DESCRIPTION,
    url: 'https://nomadxe.com',
    siteName: 'NomadXE',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NomadXE | Mobile Surveillance Infrastructure',
    description: DESCRIPTION,
    creator: '@nomadxe',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: '/',
  },
};

import { ToastProvider } from '@/components/ToastProvider';
import AutoToast from '@/components/AutoToast';
import { ThemeProvider } from '@/components/ThemeProvider';

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${playfair.variable} ${jetbrains.variable}`}>
      {/* Anti-flash: read localStorage before first paint and set data-theme */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('nx-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-midnight text-white antialiased font-sans">
        <ThemeProvider>
          <ToastProvider>
            {children}
            <AutoToast />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

