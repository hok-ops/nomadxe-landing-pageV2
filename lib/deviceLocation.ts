import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';
import { getLocationKey } from '@/lib/location';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'NomadXE/1.0 (https://nomadxe.com; contact@nomadxe.com)';
const LOCATION_CACHE_TTL_MS = 24 * 60 * 60_000;

const US_STATES: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
};

type CachedLookup = {
  label: string | null;
  fetchedAt: number;
};

export type StoredDeviceLocation = {
  locationLabel: string | null;
  locationGeocodeKey: string | null;
};

const lookupCache = new Map<string, CachedLookup>();
const inFlightLookups = new Map<string, Promise<string | null>>();

function formatLocationLabel(address: Record<string, unknown>): string | null {
  const city = String(
    address.city ??
    address.town ??
    address.village ??
    address.suburb ??
    address.neighbourhood ??
    address.county ??
    ''
  ).trim();
  const state = String(address.state ?? '').trim();
  const zip = String(address.postcode ?? '').trim();
  const stateCode = US_STATES[state] ?? state;
  const label = [city, stateCode, zip].filter(Boolean).join(', ');
  return label || null;
}

export async function reverseGeocodeCoordinates(lat: number, lon: number): Promise<string | null> {
  const key = getLocationKey(lat, lon);
  if (!key || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }

  const cached = lookupCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < LOCATION_CACHE_TTL_MS) {
    return cached.label;
  }

  const pending = inFlightLookups.get(key);
  if (pending) return pending;

  const lookup = (async () => {
    try {
      const res = await fetch(
        `${NOMINATIM_URL}?format=json&lat=${lat}&lon=${lon}&zoom=18`,
        {
          headers: {
            'Accept-Language': 'en-US,en',
            'User-Agent': USER_AGENT,
          },
          signal: AbortSignal.timeout(6_000),
        }
      );

      if (!res.ok) {
        lookupCache.set(key, { label: null, fetchedAt: Date.now() });
        return null;
      }

      const json = await res.json();
      const label = formatLocationLabel((json?.address ?? {}) as Record<string, unknown>);
      lookupCache.set(key, { label, fetchedAt: Date.now() });
      return label;
    } catch {
      return null;
    } finally {
      inFlightLookups.delete(key);
    }
  })();

  inFlightLookups.set(key, lookup);
  return lookup;
}

export async function getStoredDeviceLocations(siteIds: string[]): Promise<Map<string, StoredDeviceLocation>> {
  const uniqueIds = Array.from(new Set(siteIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map();

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('vrm_devices')
    .select('vrm_site_id, location_label, location_geocode_key')
    .in('vrm_site_id', uniqueIds);

  if (error || !data) return new Map();

  return new Map(
    data.map((row: any) => [
      String(row.vrm_site_id),
      {
        locationLabel: row.location_label ?? null,
        locationGeocodeKey: row.location_geocode_key ?? null,
      },
    ])
  );
}

export async function resolveAndPersistDeviceLocation(
  siteId: string,
  lat: number | null,
  lon: number | null
): Promise<string | null> {
  const adminClient = createAdminClient();
  const { data: deviceRow } = await adminClient
    .from('vrm_devices')
    .select('location_label, location_geocode_key')
    .eq('vrm_site_id', siteId)
    .maybeSingle();

  const geocodeKey = getLocationKey(lat, lon);
  if (!geocodeKey) {
    return deviceRow?.location_label ?? null;
  }

  if (deviceRow?.location_geocode_key === geocodeKey && deviceRow.location_label) {
    return deviceRow.location_label;
  }

  const label = await reverseGeocodeCoordinates(lat as number, lon as number);

  await adminClient
    .from('vrm_devices')
    .update({
      location_label: label,
      location_geocode_key: geocodeKey,
      location_updated_at: new Date().toISOString(),
    })
    .eq('vrm_site_id', siteId);

  return label;
}
