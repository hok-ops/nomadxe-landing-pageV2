/**
 * Shared reverse-geocode utility — calls /api/geocode (server proxy → Nominatim).
 *
 * Why proxy and not Nominatim directly from the browser?
 *  - Nominatim ToS requires a valid User-Agent; browsers block setting it on fetch.
 *  - Proxying prevents end-user IPs from being sent to Nominatim's servers.
 *  - The server owns rate-limit compliance; tiles just call our own endpoint.
 *
 * Rules:
 *  - One module-level cache shared across all callers (FleetTile + NomadXECoreView)
 *  - Each unique lat/lon key is only ever fetched once per browser session
 *  - Cache is capped at MAX_CACHE_SIZE entries — oldest entry evicted on overflow
 *  - Returns null on failure — callers fall back to siteId
 */

const MAX_CACHE_SIZE = 500;

// Insertion-ordered Map — oldest entry is always at the front (.keys().next())
const geocodeCache = new Map<string, string>();

/** Stable cache key rounded to ~110 m precision. */
export function geocodeKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/** Return cached value synchronously, or null if not yet fetched. */
export function getCachedLocation(lat: number, lon: number): string | null {
  return geocodeCache.get(geocodeKey(lat, lon)) ?? null;
}

function cacheSet(key: string, value: string) {
  // Evict the oldest entry when the cap is reached
  if (geocodeCache.size >= MAX_CACHE_SIZE && !geocodeCache.has(key)) {
    const oldest = geocodeCache.keys().next().value;
    if (oldest !== undefined) geocodeCache.delete(oldest);
  }
  geocodeCache.set(key, value);
}

/**
 * Reverse-geocode lat/lon → "City, ST ZIP" via /api/geocode server proxy.
 * Returns null when the proxy fails or no meaningful address can be assembled.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const key = geocodeKey(lat, lon);
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
    if (!res.ok) return null;
    const json = await res.json();
    const label: string | null = json.location ?? null;
    if (label) cacheSet(key, label);
    return label;
  } catch {
    return null;
  }
}
