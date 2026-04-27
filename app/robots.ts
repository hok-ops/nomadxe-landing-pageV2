import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private app routes and auth flows — never index
        disallow: [
          '/dashboard/',
          '/admin/',
          '/staff/',
          '/api/',
          '/auth/',
          '/login',
          '/forgot-password',
          '/reset-password',
          '/reset-otp',
          '/activate-account',
          '/access/',
          '/order',
          '/deactivate',
          '/relocate',
        ],
      },
    ],
    sitemap: 'https://nomadxe.com/sitemap.xml',
    host: 'https://nomadxe.com',
  };
}
