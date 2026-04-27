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
          /**
           * Content-Security-Policy
           *
           * Prevents XSS escalation if any user input reaches the DOM unsanitised.
           * Directives are tight but permit what the app actually uses:
           *  - 'self'              — same-origin scripts, styles, images, fonts
           *  - data:               — base64 photo previews in OrderFormClient
           *  - blob:               — object URLs for photo thumbnails
           *  - images.unsplash.com — Next.js <Image> remote pattern (next.config)
           *  - vrmapi.victronenergy.com — VRM API (server-side only, included for SW)
           *  - api.open-meteo.com  — weather fetch from browser
           *  - nominatim.openstreetmap.org — blocked; geocoding now proxied via /api/geocode
           *  - rms.teltonika-networks.com  — modem session API (server-side only)
           *  - *.supabase.co       — Supabase auth/realtime
           *  - 'unsafe-inline'     — required by Tailwind CSS-in-JS and GSAP; remove if
           *                          a nonce-based approach is adopted in future
           */
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://images.unsplash.com",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co https://api.open-meteo.com https://www.windy.com",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
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
