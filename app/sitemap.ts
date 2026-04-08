import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://nomadxe.com';

  return [
    {
      url: baseUrl,
      lastModified: new Date('2026-04-08'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date('2026-04-08'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date('2026-01-01'),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date('2026-01-01'),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified: new Date('2026-01-01'),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ];
}
