/**
 * GET /api/geocode?lat=&lon=
 *
 * Server-side proxy for reverse geocoding.
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
import { reverseGeocodeCoordinates } from '@/lib/deviceLocation';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Rate limit: 60 requests per IP per minute. Dashboard tiles no longer use
  // this route directly, but keep a reasonable ceiling for any ad hoc callers.
  const ip = getClientIp(req);
  if (!checkRateLimit(`geocode:${ip}`, 60, 60_000)) {
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

  const location = await reverseGeocodeCoordinates(lat, lon);
  return NextResponse.json({ location }, { status: 200 });
}
