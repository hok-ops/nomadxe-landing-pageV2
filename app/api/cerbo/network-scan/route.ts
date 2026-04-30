import { NextResponse } from 'next/server';
import { ingestNetworkScanPayload, NetworkScanIngestError } from '@/lib/networkScanIngest';
import type { CerboNetworkScanPayload } from '@/lib/networkDevices';

function getCerboIngestToken() {
  const token = process.env.CERBO_INGEST_TOKEN;
  if (!token) throw new Error('CERBO_INGEST_TOKEN not configured');
  return token;
}

function parseBearer(request: Request) {
  const auth = request.headers.get('authorization') ?? '';
  const [scheme, token] = auth.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : null;
}

export async function POST(request: Request) {
  try {
    const token = parseBearer(request);
    if (!token || token !== getCerboIngestToken()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CerboNetworkScanPayload;
    const result = await ingestNetworkScanPayload(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NetworkScanIngestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('[cerbo-network-scan] fatal error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
