export function buildLocationKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

export function getLocationKey(
  lat: number | null | undefined,
  lon: number | null | undefined
): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return buildLocationKey(lat as number, lon as number);
}
