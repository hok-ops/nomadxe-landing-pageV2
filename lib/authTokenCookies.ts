export type AuthTokenType = 'invite' | 'recovery';

export const AUTH_TOKEN_COOKIE_NAMES: Record<AuthTokenType, string> = {
  invite: 'nomadxe_invite_token',
  recovery: 'nomadxe_recovery_token',
};

export function authTokenCookieOptions(expiresAt?: string) {
  const fallbackMaxAge = 30 * 60;
  const expiresIn = expiresAt
    ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
    : fallbackMaxAge;

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.max(60, Math.min(fallbackMaxAge, expiresIn)),
  };
}
