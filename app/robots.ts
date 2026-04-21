import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private app routes — never index
        disallow: ['/dashboard/', '/admin/', '/staff/', '/api/', '/auth/'],
      },
    ],
    sitemap: 'https://nomadxe.com/sitemap.xml',
    host: 'https://nomadxe.com',
  };
}
