/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },

  /**
   * HTTP response headers applied to every route.
   *
   * Security headers improve trust signals Google uses in ranking.
   * Cache headers improve Core Web Vitals (LCP) by keeping static
   * assets warm in CDN/browser caches.
   */
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          // Prevent clickjacking — stops NomadXE pages being embedded in iframes
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Stop browsers guessing MIME types (helps prevent XSS via file upload)
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Limit referrer data sent to third-party domains
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restrict browser features not needed for this site
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          // Tell browsers to always use HTTPS for this origin (1 year)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // Basic XSS protection for older browsers (modern browsers use CSP)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
      {
        // Long-lived cache for Next.js static chunks (hashed filenames)
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache public images for 7 days
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=86400',
          },
        ],
      },
      {
        // Cache hero images for 7 days
        source: '/(trailer-hires\\.jpg|trailer\\.jpg)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
