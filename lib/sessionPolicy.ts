export const SESSION_STARTED_COOKIE = 'nx_session_started_at';
export const SESSION_LAST_SEEN_COOKIE = 'nx_session_last_seen_at';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getSessionPolicy(pathname: string) {
  const isAdminSurface = pathname.startsWith('/admin') || pathname.startsWith('/access');
  const idleMinutes = readPositiveNumber(
    isAdminSurface
      ? process.env.ADMIN_SESSION_IDLE_TIMEOUT_MINUTES
      : process.env.SESSION_IDLE_TIMEOUT_MINUTES,
    isAdminSurface ? 45 : 180
  );
  const absoluteHours = readPositiveNumber(
    isAdminSurface
      ? process.env.ADMIN_SESSION_ABSOLUTE_TIMEOUT_HOURS
      : process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS,
    isAdminSurface ? 8 : 12
  );

  return {
    idleMs: idleMinutes * MINUTE_MS,
    absoluteMs: absoluteHours * HOUR_MS,
  };
}

export function parseSessionTimestamp(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
