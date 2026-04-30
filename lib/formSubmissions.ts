import { createAdminClient } from '@/utils/supabase/admin';

export type PublicFormType = 'contact' | 'order' | 'relocation' | 'deactivation';

type SubmitPublicFormInput = {
  formType: PublicFormType;
  payload: Record<string, unknown>;
  sourceRoute: string;
  request: Request;
  webhookUrl?: string | null;
};

function capText(value: string | null, max: number) {
  return value ? value.slice(0, max) : null;
}

function firstText(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function optionalWebhookUrl(formType: PublicFormType, explicitUrl?: string | null) {
  if (explicitUrl) return explicitUrl;
  if (formType === 'contact') return process.env.FORMS_FORWARD_WEBHOOK_URL ?? null;
  if (formType === 'order') return process.env.ORDER_FORM_FORWARD_WEBHOOK_URL ?? process.env.FORMS_FORWARD_WEBHOOK_URL ?? process.env.MAKE_WEBHOOK_URL ?? null;
  if (formType === 'relocation') return process.env.RELOCATE_FORM_FORWARD_WEBHOOK_URL ?? process.env.FORMS_FORWARD_WEBHOOK_URL ?? process.env.MAKE_RELOCATE_WEBHOOK_URL ?? null;
  if (formType === 'deactivation') return process.env.DEACTIVATE_FORM_FORWARD_WEBHOOK_URL ?? process.env.FORMS_FORWARD_WEBHOOK_URL ?? process.env.MAKE_DEACTIVATE_WEBHOOK_URL ?? null;
  return null;
}

function redactLargePayloadValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactLargePayloadValues);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const copy: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'data' && typeof item === 'string' && item.startsWith('data:image/')) {
      copy.dataRedacted = true;
      copy.originalBytesApprox = Math.ceil(item.length * 0.75);
      continue;
    }
    copy[key] = redactLargePayloadValues(item);
  }
  return copy;
}

async function forwardSubmission(url: string, payload: Record<string, unknown>) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error('[form-submissions] optional forward failed:', response.status, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('[form-submissions] optional forward error:', error);
    return false;
  }
}

export async function submitPublicForm({
  formType,
  payload,
  sourceRoute,
  request,
  webhookUrl,
}: SubmitPublicFormInput) {
  const submittedAt = new Date().toISOString();
  const normalizedPayload = {
    ...payload,
    form_type: formType,
    submitted_at: submittedAt,
  };
  const storedPayload = redactLargePayloadValues(normalizedPayload) as Record<string, unknown>;
  const adminClient = createAdminClient();
  const name = firstText(payload, ['full_name', 'name']);
  const email = firstText(payload, ['email']);
  const company = firstText(payload, ['company']);
  const phone = firstText(payload, ['phone']);

  const { data, error } = await adminClient
    .from('public_form_submissions')
    .insert({
      form_type: formType,
      source_route: sourceRoute,
      name: capText(name, 200),
      email: capText(email?.toLowerCase() ?? null, 254),
      company: capText(company, 200),
      phone: capText(phone, 40),
      payload: storedPayload,
      request_context: {
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        userAgent: capText(request.headers.get('user-agent'), 500),
      },
    })
    .select('id')
    .single();

  if (error) {
    console.error('[form-submissions] insert failed:', error.message);
    throw new Error('Could not save form submission.');
  }

  const forwardUrl = optionalWebhookUrl(formType, webhookUrl);
  const forwarded = forwardUrl ? await forwardSubmission(forwardUrl, normalizedPayload) : false;

  return {
    id: String(data.id),
    forwarded,
  };
}
