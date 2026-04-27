/**
 * GET /api/geocode?lat=&lon=
 *
 * Server-side proxy for Nominatim reverse geocoding.
 *
 * Why proxy instead of calling Nominatim from the browser?
 *  1. Nominatim ToS requires a valid User-Agent identifying the application.
 *     Browsers block setting User-Agent on client-side fetch requests.
 *  2. Proxying prevents end-user IPs from being sent to Nominatim's servers.
 *  3. Centralises rate-limit compliance — the server is the single caller.
 *
 * Rate limiting: 1 request per (IP, key) per second via the sliding-window
 * limiter. Nominatim enforces 1 req/sec globally; our client-side stagger
 * already spaces calls, so this is a belt-and-suspenders guard.
 *
 * Auth: unauthenticated — coordinates are not sensitive and the endpoint
 * returns only a city/state/zip string. No user data is stored or logged.
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT    = 'NomadXE/1.0 (https://nomadxe.com; contact@nomadxe.com)';

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

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Rate limit: 10 geocode requests per IP per minute (generous for a fleet UI)
  const ip = getClientIp(req);
  if (!checkRateLimit(`geocode:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { searchParams } = req.nextUrl;
  const rawLat = searchParams.get('lat');
  const rawLon = searchParams.get('lon');

  const lat = parseFloat(rawLat ?? '');
  const lon = parseFloat(rawLon ?? '');

  if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
      Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

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
      return NextResponse.json({ location: null }, { status: 200 });
    }

    const json = await res.json();
    const a    = json.address ?? {};

    const city      = a.city ?? a.town ?? a.village ?? a.suburb ?? a.neighbourhood ?? a.county ?? '';
    const state     = a.state ?? '';
    const zip       = a.postcode ?? '';
    const stateCode = US_STATES[state] ?? state;

    const label = [city, stateCode, zip].filter(Boolean).join(', ');
    return NextResponse.json({ location: label || null });
  } catch {
    return NextResponse.json({ location: null }, { status: 200 });
  }
}
