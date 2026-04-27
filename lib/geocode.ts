/**
 * Shared reverse-geocode utility using Nominatim (OpenStreetMap).
 *
 * Rules:
 *  - One module-level cache shared across all callers (FleetTile + NomadXECoreView)
 *  - Each unique lat/lon key is only ever fetched once per browser session
 *  - Returns null on failure — callers fall back to siteId or a skeleton
 *  - Nominatim ToS: max 1 req/sec; callers must stagger concurrent calls
 */

const geocodeCache = new Map<string, string>();

const US_STATES: Record<string, string> = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA',
  'Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD',
  'Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO',
  'Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ',
  'New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH',
  'Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
  'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
  'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
};

/** Stable cache key rounded to ~110 m precision. */
export function geocodeKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/** Return cached value synchronously, or null if not yet fetched. */
export function getCachedLocation(lat: number, lon: number): string | null {
  return geocodeCache.get(geocodeKey(lat, lon)) ?? null;
}

/**
 * Reverse-geocode lat/lon → "City, ST ZIP".
 * Returns null when GPS unavailable, Nominatim fails, or address fields
 * can't be assembled into a meaningful string.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const key = geocodeKey(lat, lon);
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`,
      { headers: { 'Accept-Language': 'en-US,en' } }
    );
    if (!res.ok) return null;

    const json = await res.json();
    const a    = json.address ?? {};

    const city      = a.city ?? a.town ?? a.village ?? a.suburb ?? a.neighbourhood ?? a.county ?? '';
    const state     = a.state ?? '';
    const zip       = a.postcode ?? '';
    const stateCode = US_STATES[state] ?? state;

    const label = [city, stateCode, zip].filter(Boolean).join(', ');
    if (label) geocodeCache.set(key, label);
    return label || null;
  } catch {
    return null;
  }
}
