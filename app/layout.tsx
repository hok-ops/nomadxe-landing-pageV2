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

// Primary description targets actual search intent, not internal brand language
const DESCRIPTION =
  'Solar-powered mobile security trailers deployed to construction sites, events, and remote locations. Operational within hours — no grid power or fixed infrastructure required. 24/7 remote monitoring included.';

const OG_IMAGE = 'https://nomadxe.com/trailer-hires.jpg';

export const metadata: Metadata = {
  other: { 'x-build': 'v2-anim-apr22' },
  metadataBase: new URL('https://nomadxe.com'),
  title: {
    default: 'Mobile Security Trailers | NomadXE Surveillance Solutions',
    template: '%s | NomadXE',
  },
  description: DESCRIPTION,
  // Keywords ordered by search volume — primary terms first
  keywords: [
    'mobile security trailers',
    'mobile surveillance trailer',
    'security camera trailer',
    'solar security trailer',
    'construction site security trailer',
    'temporary surveillance trailer',
    'mobile security trailer rental',
    'solar powered surveillance trailer',
    'construction site security cameras',
    'remote site security monitoring',
    'off-grid surveillance system',
    'rapid deploy security trailer',
    'trailer mounted security cameras',
    'mobile security infrastructure',
    'NomadXE',
  ],
  authors: [{ name: 'NomadXE' }],
  creator: 'NomadXE',
  publisher: 'NomadXE',
  category: 'Security Services',
  openGraph: {
    title: 'Mobile Security Trailers | NomadXE Surveillance Solutions',
    description: DESCRIPTION,
    url: 'https://nomadxe.com',
    siteName: 'NomadXE',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'NomadXE solar-powered mobile security trailer deployed on site',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mobile Security Trailers | NomadXE',
    description: DESCRIPTION,
    creator: '@nomadxe',
    images: [OG_IMAGE],
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
    canonical: 'https://nomadxe.com',
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

