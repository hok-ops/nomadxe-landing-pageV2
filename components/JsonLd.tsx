/**
 * JSON-LD structured data for NomadXE.
 * Renders server-side so Google's first-wave crawler reads it immediately.
 * Implements: Organization, LocalBusiness, Service, FAQPage, WebSite schemas.
 */
export default function JsonLd() {
  const BASE = 'https://nomadxe.com';

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE}/#organization`,
    name: 'NomadXE',
    url: BASE,
    logo: {
      '@type': 'ImageObject',
      url: `${BASE}/trailer.jpg`,
      width: 1200,
      height: 630,
    },
    description:
      'NomadXE deploys solar-powered mobile security trailers and surveillance infrastructure to construction sites, events, and remote locations. Rapid deployment, no fixed infrastructure required.',
    sameAs: [
      'https://www.linkedin.com/company/nomadxe',
      'https://twitter.com/nomadxe',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      url: `${BASE}/#contact`,
      availableLanguage: 'English',
    },
  };

  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'SecurityService'],
    '@id': `${BASE}/#business`,
    name: 'NomadXE',
    url: BASE,
    image: `${BASE}/trailer.jpg`,
    description:
      'Mobile security trailer deployment and solar-powered surveillance infrastructure for construction sites, events, utility sites, and remote locations.',
    priceRange: '$$',
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Mobile Security Trailer Services',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Mobile Security Trailer Deployment',
            description:
              'Solar-powered mobile surveillance trailers deployed to your site. Operational within hours. Includes 24/7 remote monitoring, HD cameras, and real-time alerts.',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Construction Site Surveillance',
            description:
              'Dedicated mobile security trailer solution for active construction sites. Deters theft, monitors access points, and provides incident documentation.',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Remote & Off-Grid Security Monitoring',
            description:
              'Self-contained solar security trailers for remote energy, utility, and off-grid sites where traditional security infrastructure is unavailable.',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Event & Temporary Venue Security',
            description:
              'Rapidly deployable mobile surveillance trailers for events, festivals, and temporary venues. Set up same-day.',
          },
        },
      ],
    },
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE}/#website`,
    name: 'NomadXE',
    url: BASE,
    publisher: { '@id': `${BASE}/#organization` },
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is a mobile security trailer?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A mobile security trailer is a self-contained, solar-powered surveillance unit mounted on a road-legal trailer. It includes HD cameras, onboard recording, remote monitoring capability, and wireless connectivity — allowing rapid deployment to any location without requiring fixed power or internet infrastructure.',
        },
      },
      {
        '@type': 'Question',
        name: 'How quickly can a NomadXE security trailer be deployed?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'NomadXE security trailers are operational within hours of arrival on site. The solar-powered design eliminates the need for grid power, and the system connects to remote monitoring immediately upon deployment.',
        },
      },
      {
        '@type': 'Question',
        name: 'What sites are mobile security trailers used for?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Mobile security trailers are commonly deployed to construction sites, asset yards, events and festivals, remote energy and utility sites, industrial facilities, and any temporary or off-grid location that requires surveillance without permanent infrastructure.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do NomadXE trailers work without grid power?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Every NomadXE trailer runs on integrated solar panels and a battery storage system, making them fully self-sufficient. They operate 24/7 with no external power source required.',
        },
      },
      {
        '@type': 'Question',
        name: 'What cameras and monitoring features are included?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'NomadXE trailers include high-definition cameras with night vision, onboard NVR recording, remote live viewing, motion detection alerts, and optional integration with your existing camera and monitoring platform.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does NomadXE pricing work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'NomadXE offers flexible deployment packages. Contact our sales team at nomadxe.com/#contact to discuss options for your site size, monitoring needs, and deployment duration.',
        },
      },
    ],
  };

  const schemas = [organization, localBusiness, website, faqPage];

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
