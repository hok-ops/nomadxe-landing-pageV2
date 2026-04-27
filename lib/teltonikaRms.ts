const RMS_REMOTE_HTTP_URL = 'https://rms.teltonika-networks.com/api/remote/http';

// 15-minute session — sufficient for a WebUI task without leaving dangling sessions
const SESSION_TIMEOUT_S = 900;

// 15-second request timeout — RMS is a third-party API, give it reasonable time
const REQUEST_TIMEOUT_MS = 15_000;

export class TeltonikaRmsError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status = 502, details: unknown = null) {
    super(message);
    this.name = 'TeltonikaRmsError';
    this.status = status;
    this.details = details;
  }
}

function getRmsAccessToken(): string {
  const token = process.env.TELTONIKA_RMS_API_TOKEN;
  if (!token) throw new TeltonikaRmsError('TELTONIKA_RMS_API_TOKEN not configured', 500);
  return token;
}

export function getGatewayBearerToken(): string | null {
  return process.env.TELTONIKA_GATEWAY_BEARER_TOKEN ?? null;
}

function extractSessionUrl(payload: unknown): string | null {
  const p = payload as Record<string, any>;
  const candidates = [
    p?.url,
    p?.data?.url,
    p?.session?.url,
    p?.data?.session?.url,
    p?.result?.url,
  ];
  return candidates.find((v) => typeof v === 'string' && /^https?:\/\//i.test(v)) ?? null;
}

function normalizeErrorMessage(payload: unknown): string {
  const p = payload as Record<string, any>;
  const candidates = [
    p?.message,
    p?.error,
    p?.details,
    p?.data?.message,
    p?.data?.error,
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return candidates[0] ?? 'Unable to open remote modem access session';
}

function mapRmsFailure(payload: unknown, status: number): TeltonikaRmsError {
  const message = normalizeErrorMessage(payload);
  const lower = message.toLowerCase();

  if (lower.includes('offline')) {
    return new TeltonikaRmsError('Device is offline in Teltonika RMS', 409, payload);
  }
  if (lower.includes('credit')) {
    return new TeltonikaRmsError('Insufficient RMS credits to create a remote WebUI session', 402, payload);
  }
  return new TeltonikaRmsError(message, status >= 400 ? status : 502, payload);
}

/**
 * Creates an RMS Remote HTTP session for the modem WebUI.
 *
 * Uses native fetch (consistent with the rest of the codebase) instead of axios.
 * Session timeout is 15 minutes — enough for a WebUI task, not enough to leave
 * dangling sessions running for hours.
 */
export async function createRemoteWebUiSession(deviceId: string) {
  if (!/^\d+$/.test(deviceId)) {
    throw new TeltonikaRmsError('Invalid RMS device ID', 400);
  }

  const token = getRmsAccessToken();

  let res: Response;
  try {
    res = await fetch(RMS_REMOTE_HTTP_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_id: deviceId,
        port: 80,
        name: 'Remote_WebUI_Session',
        timeout: SESSION_TIMEOUT_S,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    if (err instanceof TeltonikaRmsError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new TeltonikaRmsError(`Teltonika RMS request failed: ${msg}`, 502, err);
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new TeltonikaRmsError('Teltonika RMS returned non-JSON response', 502);
  }

  if (!res.ok) {
    throw mapRmsFailure(payload, res.status);
  }

  const url = extractSessionUrl(payload);
  if (!url) {
    throw new TeltonikaRmsError('RMS did not return a remote session URL', 502, payload);
  }

  return { url, raw: payload };
}
