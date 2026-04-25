import axios from 'axios';

const RMS_REMOTE_HTTP_URL = 'https://rms.teltonika-networks.com/api/remote/http';

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

function extractSessionUrl(payload: any): string | null {
  const candidates = [
    payload?.url,
    payload?.data?.url,
    payload?.session?.url,
    payload?.data?.session?.url,
    payload?.result?.url,
  ];

  const match = candidates.find((value) => typeof value === 'string' && /^https?:\/\//i.test(value));
  return match ?? null;
}

function normalizeErrorMessage(payload: any): string {
  const candidates = [
    payload?.message,
    payload?.error,
    payload?.details,
    payload?.data?.message,
    payload?.data?.error,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0);

  return candidates[0] ?? 'Unable to open remote modem access session';
}

function mapRmsFailure(payload: any, status: number) {
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
 * The `deviceId` is the Teltonika RMS device ID. You can retrieve it from the
 * RMS API `GET /devices` response or store it in `public.vrm_devices.teltonika_rms_device_id`.
 */
export async function createRemoteWebUiSession(deviceId: string) {
  if (!/^\d+$/.test(deviceId)) {
    throw new TeltonikaRmsError('Invalid RMS device ID', 400);
  }

  try {
    const response = await axios.post(
      RMS_REMOTE_HTTP_URL,
      {
        device_id: deviceId,
        port: 80,
        name: 'Remote_WebUI_Session',
        timeout: 3600,
      },
      {
        headers: {
          Authorization: `Bearer ${getRmsAccessToken()}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      }
    );

    const url = extractSessionUrl(response.data);
    if (!url) {
      throw new TeltonikaRmsError('RMS did not return a remote session URL', 502, response.data);
    }

    return { url, raw: response.data };
  } catch (error: any) {
    if (error instanceof TeltonikaRmsError) throw error;

    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const payload = error.response?.data ?? { message: error.message };
      throw mapRmsFailure(payload, status);
    }

    throw new TeltonikaRmsError('Unexpected Teltonika RMS gateway failure', 502, error);
  }
}
