import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { submitPublicForm } from '@/lib/formSubmissions';

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;

interface ContactPayload {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  site_type?: unknown;
  message?: unknown;
}

function cap(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`contact:${ip}`, 5, 60_000)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before submitting again.' },
      { status: 429 }
    );
  }

  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: ContactPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sanitized = {
    name: cap(body.name, 160),
    email: cap(body.email, 254).toLowerCase(),
    company: cap(body.company, 160),
    site_type: cap(body.site_type, 80),
    message: cap(body.message, 2_000),
  };

  if (!sanitized.name || !EMAIL_RE.test(sanitized.email)) {
    return NextResponse.json({ error: 'Name and valid email are required' }, { status: 422 });
  }

  try {
    const submission = await submitPublicForm({
      formType: 'contact',
      payload: sanitized,
      sourceRoute: '/api/contact',
      request,
    });
    return NextResponse.json({ ok: true, submissionId: submission.id, forwarded: submission.forwarded });
  } catch (error) {
    console.error('[contact] submission failed:', error);
    return NextResponse.json({ error: 'Contact submission failed' }, { status: 503 });
  }
}
