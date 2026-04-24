import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NomadXE — Mobile Security Trailers',
    short_name: 'NomadXE',
    description:
      'Solar-powered mobile security trailers deployed to construction sites, events, and remote locations. Operational within hours.',
    start_url: '/',
    display: 'standalone',
    background_color: '#080c14',
    theme_color: '#3b82f6',
    orientation: 'portrait-primary',
    categories: ['security', 'business'],
    icons: [
      {
        src: '/web-app-manifest-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
