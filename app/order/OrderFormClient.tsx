'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SITE_TYPES = [
  'Construction Site',
  'Events & Temporary Venue',
  'Asset Yard / Logistics',
  'Industrial Facility',
  'Remote / Off-Grid Site',
  'Other',
];

const DURATIONS = [
  '1 Week',
  '2 Weeks',
  '1 Month',
  '3 Months',
  '6 Months',
  '12 Months',
  'Custom / TBD',
];

const DEPLOYMENT_OPTIONS = [
  'Option 01 — Trailer & Power Base',
  'Option 02 — Fully Equipped',
];

const TRAILER_COUNTS = ['1', '2', '3', '4+'];

const YES_NO = ['Yes', 'No'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormState = 'idle' | 'submitting' | 'success' | 'error';

interface PhotoFile {
  id: string;
  name: string;
  type: string;
  size: number;
  preview: string;   // object URL for thumbnail
  data: string;      // base64 data URL sent in payload
}

const MAX_PHOTOS    = 4;
const MAX_PHOTO_MB  = 2;
const MAX_PHOTO_B   = MAX_PHOTO_MB * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

interface DeliveryContact {
  name: string;
  phone: string;
}

interface DeliveryContactError {
  name?: string;
  phone?: string;
}

interface FieldErrors {
  full_name?: string;
  email?: string;
  company?: string;
  phone?: string;
  location_name?: string;
  site_type?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  gps_lat?: string;
  gps_lng?: string;
  start_date?: string;
  duration?: string;
  trailer_count?: string;
  deployment_option?: string;
  technician_setup?: string;
  forklift_available?: string;
}

interface UtmParams {
  [key: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEmail(v: string) {
  // Stricter RFC-based check: requires valid local part, domain label, and 2+ char TLD
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/.test(v.trim());
}

function validateLat(v: string): boolean {
  const n = parseFloat(v.trim());
  if (isNaN(n) || n < -90 || n > 90) return false;
  return /^-?\d+(\.\d+)?$/.test(v.trim());
}

function validateLng(v: string): boolean {
  const n = parseFloat(v.trim());
  if (isNaN(n) || n < -180 || n > 180) return false;
  return /^-?\d+(\.\d+)?$/.test(v.trim());
}

const INITIAL_FIELDS = {
  full_name: '',
  email: '',
  company: '',
  phone: '',
  location_name: '',
  site_type: '',
  street_address: '',
  city: '',
  state: '',
  zip_code: '',
  gps_lat: '',
  gps_lng: '',
  start_date: '',
  duration: '',
  trailer_count: '',
  deployment_option: '',
  technician_setup: '',
  forklift_available: '',
  notes: '',
};

const INITIAL_DELIVERY_CONTACT: DeliveryContact = { name: '', phone: '' };

function validate(fields: typeof INITIAL_FIELDS): FieldErrors {
  const e: FieldErrors = {};
  if (!fields.full_name.trim()) e.full_name = 'Required';
  if (!fields.email.trim()) {
    e.email = 'Required';
  } else if (!validateEmail(fields.email)) {
    e.email = 'Invalid email address';
  }
  if (!fields.company.trim()) e.company = 'Required';
  if (!fields.location_name.trim()) e.location_name = 'Required';
  if (!fields.site_type) e.site_type = 'Select a site type';
  if (!fields.street_address.trim()) e.street_address = 'Required';
  if (!fields.city.trim()) e.city = 'Required';
  if (!fields.state.trim()) e.state = 'Required';
  if (!fields.zip_code.trim()) e.zip_code = 'Required';
  if (fields.gps_lat.trim() && !validateLat(fields.gps_lat)) {
    e.gps_lat = 'Decimal degrees, −90 to 90';
  }
  if (fields.gps_lng.trim() && !validateLng(fields.gps_lng)) {
    e.gps_lng = 'Decimal degrees, −180 to 180';
  }
  if (!fields.start_date) e.start_date = 'Required';
  if (!fields.duration) e.duration = 'Select duration';
  if (!fields.trailer_count) e.trailer_count = 'Select count';
  if (!fields.deployment_option) e.deployment_option = 'Select deployment option';
  if (!fields.technician_setup) e.technician_setup = 'Required';
  if (!fields.forklift_available) e.forklift_available = 'Required';
  return e;
}

// ---------------------------------------------------------------------------
// Shared style helpers
// ---------------------------------------------------------------------------

const LABEL =
  'block text-[10.5px] font-semibold text-slate-500 uppercase tracking-[0.12em] mb-1.5';

const INPUT = (err: boolean) =>
  `w-full bg-white border rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 outline-none transition-all duration-200 focus:ring-2 ${
    err
      ? 'border-red-300 focus:border-red-500 focus:ring-red-500/15'
      : 'border-slate-200 focus:border-blue/70 focus:ring-blue/15'
  }`;

const ERR = 'mt-1 text-[11px] text-red-500 font-mono';

const SELECT_STYLE = (val: string, err: boolean) => ({
  color: val ? '#0f172a' : '#94a3b8',
  ...(!err ? {} : {}),
});

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-blue/30 to-transparent" />
      <div className="px-6 py-4 border-b border-slate-100">
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-blue/70">
          {title}
        </span>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrderFormClient() {
  const [formState, setFormState] = useState<FormState>('idle');
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [utmParams, setUtmParams] = useState<UtmParams>({});
  const [additionalRecipients, setAdditionalRecipients] = useState<string[]>([]);
  const [recipientErrors, setRecipientErrors] = useState<(string | undefined)[]>([]);
  const [deliveryContacts, setDeliveryContacts] = useState<DeliveryContact[]>([{ ...INITIAL_DELIVERY_CONTACT }]);
  const [deliveryContactErrors, setDeliveryContactErrors] = useState<DeliveryContactError[]>([{}]);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Capture UTMs on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const captured: UtmParams = {};
    params.forEach((v, k) => { captured[k] = v; });
    if (Object.keys(captured).length) setUtmParams(captured);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFields((p) => ({ ...p, [name]: value }));
      if (errors[name as keyof FieldErrors]) {
        setErrors((p) => ({ ...p, [name]: undefined }));
      }
    },
    [errors]
  );

  function updateDeliveryContact(i: number, field: keyof DeliveryContact, value: string) {
    const updated = [...deliveryContacts];
    updated[i] = { ...updated[i], [field]: value };
    setDeliveryContacts(updated);
    if (deliveryContactErrors[i]?.[field]) {
      const errs = [...deliveryContactErrors];
      errs[i] = { ...errs[i], [field]: undefined };
      setDeliveryContactErrors(errs);
    }
  }

  function addDeliveryContact() {
    setDeliveryContacts([...deliveryContacts, { ...INITIAL_DELIVERY_CONTACT }]);
    setDeliveryContactErrors([...deliveryContactErrors, {}]);
  }

  function removeDeliveryContact(i: number) {
    setDeliveryContacts(deliveryContacts.filter((_, j) => j !== i));
    setDeliveryContactErrors(deliveryContactErrors.filter((_, j) => j !== i));
  }

  async function addPhotos(files: FileList | File[]) {
    setPhotoError(null);
    const incoming = Array.from(files);
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) { setPhotoError(`Maximum ${MAX_PHOTOS} photos allowed.`); return; }
    const toAdd = incoming.slice(0, remaining);
    const errors: string[] = [];
    const valid: PhotoFile[] = [];
    for (const file of toAdd) {
      if (!ACCEPTED_TYPES.includes(file.type)) { errors.push(`${file.name}: unsupported type`); continue; }
      if (file.size > MAX_PHOTO_B) { errors.push(`${file.name}: exceeds ${MAX_PHOTO_MB} MB limit`); continue; }
      try {
        const data = await readFileAsBase64(file);
        valid.push({ id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, preview: URL.createObjectURL(file), data });
      } catch { errors.push(`${file.name}: could not read file`); }
    }
    if (errors.length) setPhotoError(errors.join(' · '));
    if (valid.length) setPhotos(p => [...p, ...valid]);
  }

  function removePhoto(id: string) {
    setPhotos(p => {
      const removed = p.find(f => f.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return p.filter(f => f.id !== id);
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // Validate main fields
    const fieldErrors = validate(fields);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      const firstKey = Object.keys(fieldErrors)[0];
      document.querySelector<HTMLElement>(`[name="${firstKey}"]`)?.focus();
      return;
    }

    // Validate delivery contacts — first contact name required
    const dcErrs: DeliveryContactError[] = deliveryContacts.map((c, i) => {
      const err: DeliveryContactError = {};
      if (i === 0 && !c.name.trim()) err.name = 'Required';
      if (!c.phone.trim()) err.phone = 'Required';
      return err;
    });
    if (dcErrs.some((e) => Object.keys(e).length > 0)) {
      setDeliveryContactErrors(dcErrs);
      return;
    }
    setDeliveryContactErrors(deliveryContacts.map(() => ({})));

    // Validate additional recipients
    const recipientErrs = additionalRecipients.map((r) =>
      r.trim() && !validateEmail(r) ? 'Invalid email address' : undefined
    );
    if (recipientErrs.some(Boolean)) {
      setRecipientErrors(recipientErrs);
      return;
    }
    setRecipientErrors([]);
    setErrors({});
    setFormState('submitting');

    const validRecipients = additionalRecipients.filter((r) => r.trim());
    const validDeliveryContacts = deliveryContacts.filter((c) => c.name.trim());

    try {
      const payload = {
        full_name: fields.full_name.trim(),
        email: fields.email.trim().toLowerCase(),
        company: fields.company.trim(),
        phone: fields.phone.trim(),
        location_name: fields.location_name.trim(),
        site_type: fields.site_type,
        street_address: fields.street_address.trim(),
        city: fields.city.trim(),
        state: fields.state.trim(),
        zip_code: fields.zip_code.trim(),
        ...(fields.gps_lat.trim() && { gps_lat: fields.gps_lat.trim() }),
        ...(fields.gps_lng.trim() && { gps_lng: fields.gps_lng.trim() }),
        // Sanitize name/phone: strip semicolons so the '; ' delimiter stays unambiguous
        delivery_contacts: validDeliveryContacts
          .map((c) => {
            const name  = c.name.replace(/;/g, ',').trim();
            const phone = c.phone.replace(/;/g, ',').trim();
            return phone ? `${name} (${phone})` : name;
          })
          .join('; '),
        start_date: fields.start_date,
        duration: fields.duration,
        trailer_count: fields.trailer_count,
        deployment_option: fields.deployment_option,
        technician_setup: fields.technician_setup,
        forklift_available: fields.forklift_available,
        ...(validRecipients.length > 0 && {
          additional_recipients: validRecipients.join(', '),
        }),
        ...(fields.notes.trim() && { notes: fields.notes.trim() }),
        ...(photos.length > 0 && {
          photos: photos.map(p => ({ name: p.name, type: p.type, data: p.data })),
        }),
        ...utmParams,
      };
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setFormState('success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const data = await res.json().catch(() => ({}));
        setServerError(data?.error ?? 'Something went wrong — please try again.');
        setFormState('error');
      }
    } catch {
      setServerError('Network error — please check your connection and try again.');
      setFormState('error');
    }
  };

  const isSubmitting = formState === 'submitting';
  const today = new Date().toISOString().split('T')[0];

  function handleReset() {
    setFormState('idle');
    setFields(INITIAL_FIELDS);
    setErrors({});
    setServerError(null);
    setAdditionalRecipients([]);
    setRecipientErrors([]);
    setDeliveryContacts([{ ...INITIAL_DELIVERY_CONTACT }]);
    setDeliveryContactErrors([{}]);
    photos.forEach(p => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    setPhotoError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // =========================================================================
  // SUCCESS STATE
  // =========================================================================

  if (formState === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-dark via-blue to-blue-dark z-[100]" />

        <div className="relative z-10 w-full max-w-lg text-center space-y-8">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-blue/10 border border-blue/30 flex items-center justify-center">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="absolute inset-0 rounded-full border border-blue/20 animate-ping" style={{ animationDuration: '2.5s' }} aria-hidden="true" />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 bg-blue/10 border border-blue/25 rounded-full px-5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue animate-pulse" aria-hidden="true" />
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-blue/80">Order Received</span>
          </div>

          <div>
            <span className="font-mono text-2xl font-black tracking-[0.18em] uppercase text-slate-900">
              NOMAD<span className="text-blue">XE</span>
            </span>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-blue/30 to-transparent" />
            <div className="px-8 py-8 space-y-4">
              <h1 className="text-xl font-bold text-slate-900">You&rsquo;re in the queue.</h1>
              <p className="text-[13.5px] text-slate-500 leading-relaxed">
                Your NomadXE order has been secured. Our SOC team is reviewing your site profile and will send a confirmation email shortly.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm text-left">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-blue/30 to-transparent" />
            <div className="px-6 py-4 border-b border-slate-100">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-blue/70">Order Summary</span>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                { label: 'Location', value: fields.location_name },
                { label: 'Site Type', value: fields.site_type },
                { label: 'Address', value: `${fields.street_address}, ${fields.city}, ${fields.state} ${fields.zip_code}` },
                { label: 'Trailers', value: fields.trailer_count },
                { label: 'Start Date', value: new Date(fields.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                { label: 'Duration', value: fields.duration },
                { label: 'Deployment', value: fields.deployment_option },
                { label: 'Technician Setup', value: fields.technician_setup },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-slate-400 mb-0.5">{label}</p>
                  <p className="text-[13px] text-slate-700">{value || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleReset}
            className="w-full bg-blue hover:bg-blue-dark text-white font-bold py-3.5 rounded-xl text-sm tracking-wide transition-all duration-200 hover:shadow-blue-glow active:scale-[0.98]"
          >
            Submit Another Order →
          </button>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors duration-200 font-mono uppercase tracking-[0.15em]"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 12L6 8l4-4" />
              </svg>
              Back to NomadXE.com
            </Link>
            <span className="hidden sm:block text-slate-300">·</span>
            <a href="mailto:sales@nomadxe.com" className="text-[11px] text-blue/60 hover:text-blue transition-colors duration-200 font-mono uppercase tracking-[0.15em]">
              sales@nomadxe.com
            </a>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // FORM STATE
  // =========================================================================

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-x-hidden">
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-dark via-blue to-blue-dark z-[100]" />

      <div className="relative z-10 max-w-2xl mx-auto px-5 py-16 sm:py-20">

        {/* ── Header ── */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex flex-col items-center gap-3 group mb-8" aria-label="Back to NomadXE home">
            <div className="w-11 h-11 rounded-xl bg-blue/10 border border-blue/20 flex items-center justify-center group-hover:border-blue/50 group-hover:bg-blue/15 transition-all duration-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <span className="font-mono text-[21px] font-black tracking-[0.18em] uppercase text-slate-900 leading-none">
              NOMAD<span className="text-blue">XE</span>
            </span>
          </Link>
          <h1 className="text-[22px] font-bold text-slate-900 tracking-tight mb-2">Secure a Deployment</h1>
          <p className="text-[12.5px] text-slate-500 leading-relaxed max-w-sm mx-auto">
            Complete the form below. Our SOC team will review your site profile and send a confirmation email shortly.
          </p>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} noValidate aria-label="Deployment order form" className="space-y-4">

          {/* ── Contact Information ── */}
          <Section title="Contact Information">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ord-full-name" className={LABEL}>Full Name <span className="text-red-400/80">*</span></label>
                <input id="ord-full-name" name="full_name" type="text" required autoComplete="name"
                  value={fields.full_name} onChange={handleChange} placeholder="Jane Smith"
                  aria-invalid={!!errors.full_name} className={INPUT(!!errors.full_name)} />
                {errors.full_name && <p className={ERR} role="alert">{errors.full_name}</p>}
              </div>
              <div>
                <label htmlFor="ord-email" className={LABEL}>Business Email <span className="text-red-400/80">*</span></label>
                <input id="ord-email" name="email" type="email" required autoComplete="email"
                  value={fields.email} onChange={handleChange} placeholder="jane@company.com"
                  aria-invalid={!!errors.email} className={INPUT(!!errors.email)} />
                {errors.email && <p className={ERR} role="alert">{errors.email}</p>}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ord-company" className={LABEL}>Company <span className="text-red-400/80">*</span></label>
                <input id="ord-company" name="company" type="text" required autoComplete="organization"
                  value={fields.company} onChange={handleChange} placeholder="Acme Construction LLC"
                  aria-invalid={!!errors.company} className={INPUT(!!errors.company)} />
                {errors.company && <p className={ERR} role="alert">{errors.company}</p>}
              </div>
              <div>
                <label htmlFor="ord-phone" className={LABEL}>Phone Number <span className="text-red-400/80">*</span></label>
                <input id="ord-phone" name="phone" type="tel" required autoComplete="tel"
                  value={fields.phone} onChange={handleChange} placeholder="+1 (555) 000-0000"
                  aria-invalid={!!errors.phone} className={INPUT(!!errors.phone)} />
                {errors.phone && <p className={ERR} role="alert">{errors.phone}</p>}
              </div>
            </div>

            {/* Additional Recipients */}
            <div>
              <p className={`${LABEL} mb-1`}>
                Additional Recipients{' '}
                <span className="normal-case text-slate-400 font-normal tracking-normal">(optional)</span>
              </p>
              <p className="font-mono text-[10.5px] text-slate-400 mb-3">
                These addresses will also receive the order confirmation email.
              </p>
              <div className="space-y-2">
                {additionalRecipients.map((r, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <input
                        type="email"
                        value={r}
                        onChange={(e) => {
                          const updated = [...additionalRecipients];
                          updated[i] = e.target.value;
                          setAdditionalRecipients(updated);
                          if (recipientErrors[i]) {
                            const errs = [...recipientErrors];
                            errs[i] = undefined;
                            setRecipientErrors(errs);
                          }
                        }}
                        placeholder="colleague@company.com"
                        className={INPUT(!!recipientErrors[i])}
                      />
                      {recipientErrors[i] && <p className={ERR} role="alert">{recipientErrors[i]}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAdditionalRecipients(additionalRecipients.filter((_, j) => j !== i));
                        setRecipientErrors(recipientErrors.filter((_, j) => j !== i));
                      }}
                      className="mt-2.5 text-slate-400 hover:text-red-500 transition-colors text-lg leading-none"
                      aria-label="Remove recipient"
                    >×</button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setAdditionalRecipients([...additionalRecipients, ''])}
                className="mt-3 w-full flex items-center justify-center gap-2 border border-slate-200 hover:border-blue/50 hover:bg-blue/[0.04] text-slate-500 hover:text-slate-700 rounded-xl py-2.5 text-xs font-semibold tracking-wide transition-all duration-200 active:scale-[0.98]"
              >
                <span className="text-sm leading-none">+</span> Add Recipient
              </button>
            </div>
          </Section>

          {/* ── Site Details ── */}
          <Section title="Site Details">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ord-location-name" className={LABEL}>Location Name <span className="text-red-400/80">*</span></label>
                <input id="ord-location-name" name="location_name" type="text" required
                  value={fields.location_name} onChange={handleChange} placeholder="Eastside Yard — Phase 2"
                  aria-invalid={!!errors.location_name} className={INPUT(!!errors.location_name)} />
                {errors.location_name && <p className={ERR} role="alert">{errors.location_name}</p>}
              </div>
              <div>
                <label htmlFor="ord-site-type" className={LABEL}>Site Type <span className="text-red-400/80">*</span></label>
                <select id="ord-site-type" name="site_type" required
                  value={fields.site_type} onChange={handleChange}
                  aria-invalid={!!errors.site_type}
                  className={`${INPUT(!!errors.site_type)} appearance-none cursor-pointer`}
                  style={SELECT_STYLE(fields.site_type, !!errors.site_type)}>
                  <option value="" disabled>Select type…</option>
                  {SITE_TYPES.map((t) => (
                    <option key={t} value={t} style={{ color: '#0f172a', background: '#ffffff' }}>{t}</option>
                  ))}
                </select>
                {errors.site_type && <p className={ERR} role="alert">{errors.site_type}</p>}
              </div>
            </div>

            {/* Street Address */}
            <div>
              <label htmlFor="ord-street-address" className={LABEL}>Street Address <span className="text-red-400/80">*</span></label>
              <input
                id="ord-street-address"
                name="street_address"
                type="text"
                required
                autoComplete="street-address"
                value={fields.street_address}
                onChange={handleChange}
                placeholder="123 Site Road"
                aria-invalid={!!errors.street_address}
                className={INPUT(!!errors.street_address)}
              />
              {errors.street_address && <p className={ERR} role="alert">{errors.street_address}</p>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label htmlFor="ord-city" className={LABEL}>City <span className="text-red-400/80">*</span></label>
                <input id="ord-city" name="city" type="text" required
                  value={fields.city} onChange={handleChange} placeholder="Houston"
                  aria-invalid={!!errors.city} className={INPUT(!!errors.city)} />
                {errors.city && <p className={ERR} role="alert">{errors.city}</p>}
              </div>
              <div>
                <label htmlFor="ord-state" className={LABEL}>State <span className="text-red-400/80">*</span></label>
                <input id="ord-state" name="state" type="text" required maxLength={2}
                  value={fields.state} onChange={handleChange} placeholder="TX"
                  aria-invalid={!!errors.state} className={INPUT(!!errors.state)} />
                {errors.state && <p className={ERR} role="alert">{errors.state}</p>}
              </div>
              <div>
                <label htmlFor="ord-zip" className={LABEL}>Zip Code <span className="text-red-400/80">*</span></label>
                <input id="ord-zip" name="zip_code" type="text" required inputMode="numeric"
                  value={fields.zip_code} onChange={handleChange} placeholder="77001"
                  aria-invalid={!!errors.zip_code} className={INPUT(!!errors.zip_code)} />
                {errors.zip_code && <p className={ERR} role="alert">{errors.zip_code}</p>}
              </div>
            </div>

            {/* GPS */}
            <div>
              <p className={`${LABEL} mb-0.5`}>
                GPS Coordinates — Decimal Degrees{' '}
                <span className="normal-case text-slate-400 font-normal tracking-normal">(optional)</span>
              </p>
              <p className="font-mono text-[10.5px] text-slate-400 mb-3">
                e.g. Lat: 40.7128 &nbsp;·&nbsp; Lng: −74.0060
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ord-gps-lat" className={LABEL}>Latitude</label>
                  <input id="ord-gps-lat" name="gps_lat" type="text" inputMode="decimal"
                    value={fields.gps_lat} onChange={handleChange} placeholder="40.7128"
                    aria-invalid={!!errors.gps_lat} className={INPUT(!!errors.gps_lat)} />
                  <p className="mt-1 font-mono text-[10px] text-slate-400">−90 to 90</p>
                  {errors.gps_lat && <p className={ERR} role="alert">{errors.gps_lat}</p>}
                </div>
                <div>
                  <label htmlFor="ord-gps-lng" className={LABEL}>Longitude</label>
                  <input id="ord-gps-lng" name="gps_lng" type="text" inputMode="decimal"
                    value={fields.gps_lng} onChange={handleChange} placeholder="-74.0060"
                    aria-invalid={!!errors.gps_lng} className={INPUT(!!errors.gps_lng)} />
                  <p className="mt-1 font-mono text-[10px] text-slate-400">−180 to 180</p>
                  {errors.gps_lng && <p className={ERR} role="alert">{errors.gps_lng}</p>}
                </div>
              </div>
            </div>
          </Section>

          {/* ── Delivery Contacts ── */}
          <Section title="Delivery Contact(s)">
            <p className="font-mono text-[10.5px] text-slate-400 -mt-1">
              Person(s) who will be on-site to receive and sign for the delivery.
            </p>
            <div className="space-y-4">
              {deliveryContacts.map((contact, i) => (
                <div key={i} className="space-y-3">
                  {i > 0 && <div className="border-t border-slate-100 pt-4" />}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL}>
                        Contact Name {i === 0 && <span className="text-red-400/80">*</span>}
                        {i > 0 && <span className="normal-case text-slate-400 font-normal tracking-normal">(optional)</span>}
                      </label>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={contact.name}
                            onChange={(e) => updateDeliveryContact(i, 'name', e.target.value)}
                            placeholder="John Smith"
                            className={INPUT(!!deliveryContactErrors[i]?.name)}
                          />
                          {deliveryContactErrors[i]?.name && (
                            <p className={ERR} role="alert">{deliveryContactErrors[i].name}</p>
                          )}
                        </div>
                        {i > 0 && (
                          <button
                            type="button"
                            onClick={() => removeDeliveryContact(i)}
                            className="mt-2.5 text-slate-400 hover:text-red-500 transition-colors text-lg leading-none"
                            aria-label="Remove contact"
                          >×</button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className={LABEL}>
                        Phone Number <span className="text-red-400/80">*</span>
                      </label>
                      <input
                        type="tel"
                        value={contact.phone}
                        onChange={(e) => updateDeliveryContact(i, 'phone', e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className={INPUT(!!deliveryContactErrors[i]?.phone)}
                      />
                      {deliveryContactErrors[i]?.phone && (
                        <p className={ERR} role="alert">{deliveryContactErrors[i].phone}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addDeliveryContact}
              className="mt-1 w-full flex items-center justify-center gap-2 border border-slate-200 hover:border-blue/50 hover:bg-blue/[0.04] text-slate-500 hover:text-slate-700 rounded-xl py-2.5 text-xs font-semibold tracking-wide transition-all duration-200 active:scale-[0.98]"
            >
              <span className="text-sm leading-none">+</span> Add Another Contact
            </button>
          </Section>

          {/* ── Deployment Requirements ── */}
          <Section title="Deployment Requirements">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ord-start-date" className={LABEL}>Projected Lease Start Date <span className="text-red-400/80">*</span></label>
                <input id="ord-start-date" name="start_date" type="date" required min={today}
                  value={fields.start_date} onChange={handleChange}
                  aria-invalid={!!errors.start_date}
                  className={`${INPUT(!!errors.start_date)} [color-scheme:dark]`} />
                {errors.start_date && <p className={ERR} role="alert">{errors.start_date}</p>}
              </div>
              <div>
                <label htmlFor="ord-duration" className={LABEL}>Estimated Duration <span className="text-red-400/80">*</span></label>
                <select id="ord-duration" name="duration" required
                  value={fields.duration} onChange={handleChange}
                  aria-invalid={!!errors.duration}
                  className={`${INPUT(!!errors.duration)} appearance-none cursor-pointer`}
                  style={SELECT_STYLE(fields.duration, !!errors.duration)}>
                  <option value="" disabled>Select duration…</option>
                  {DURATIONS.map((d) => (
                    <option key={d} value={d} style={{ color: '#0f172a', background: '#ffffff' }}>{d}</option>
                  ))}
                </select>
                {errors.duration && <p className={ERR} role="alert">{errors.duration}</p>}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ord-trailer-count" className={LABEL}>Quantity Requesting <span className="text-red-400/80">*</span></label>
                <select id="ord-trailer-count" name="trailer_count" required
                  value={fields.trailer_count} onChange={handleChange}
                  aria-invalid={!!errors.trailer_count}
                  className={`${INPUT(!!errors.trailer_count)} appearance-none cursor-pointer`}
                  style={SELECT_STYLE(fields.trailer_count, !!errors.trailer_count)}>
                  <option value="" disabled>Select…</option>
                  {TRAILER_COUNTS.map((c) => (
                    <option key={c} value={c} style={{ color: '#0f172a', background: '#ffffff' }}>{c}</option>
                  ))}
                </select>
                {errors.trailer_count && <p className={ERR} role="alert">{errors.trailer_count}</p>}
              </div>
              <div>
                <label htmlFor="ord-deployment-option" className={LABEL}>Deployment Option <span className="text-red-400/80">*</span></label>
                <select id="ord-deployment-option" name="deployment_option" required
                  value={fields.deployment_option} onChange={handleChange}
                  aria-invalid={!!errors.deployment_option}
                  className={`${INPUT(!!errors.deployment_option)} appearance-none cursor-pointer`}
                  style={SELECT_STYLE(fields.deployment_option, !!errors.deployment_option)}>
                  <option value="" disabled>Select…</option>
                  {DEPLOYMENT_OPTIONS.map((p) => (
                    <option key={p} value={p} style={{ color: '#0f172a', background: '#ffffff' }}>{p}</option>
                  ))}
                </select>
                {errors.deployment_option && <p className={ERR} role="alert">{errors.deployment_option}</p>}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ord-technician-setup" className={LABEL}>Technician Setup Service Required? <span className="text-red-400/80">*</span></label>
                <select id="ord-technician-setup" name="technician_setup" required
                  value={fields.technician_setup} onChange={handleChange}
                  aria-invalid={!!errors.technician_setup}
                  className={`${INPUT(!!errors.technician_setup)} appearance-none cursor-pointer`}
                  style={SELECT_STYLE(fields.technician_setup, !!errors.technician_setup)}>
                  <option value="" disabled>Select…</option>
                  {YES_NO.map((v) => (
                    <option key={v} value={v} style={{ color: '#0f172a', background: '#ffffff' }}>{v}</option>
                  ))}
                </select>
                {errors.technician_setup && <p className={ERR} role="alert">{errors.technician_setup}</p>}
              </div>
              <div>
                <label htmlFor="ord-forklift" className={LABEL}>Forklift Available On-Site? <span className="text-red-400/80">*</span></label>
                <select id="ord-forklift" name="forklift_available" required
                  value={fields.forklift_available} onChange={handleChange}
                  aria-invalid={!!errors.forklift_available}
                  className={`${INPUT(!!errors.forklift_available)} appearance-none cursor-pointer`}
                  style={SELECT_STYLE(fields.forklift_available, !!errors.forklift_available)}>
                  <option value="" disabled>Select…</option>
                  {YES_NO.map((v) => (
                    <option key={v} value={v} style={{ color: '#0f172a', background: '#ffffff' }}>{v}</option>
                  ))}
                </select>
                {errors.forklift_available && <p className={ERR} role="alert">{errors.forklift_available}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="ord-notes" className={LABEL}>Additional Notes or Questions</label>
              <textarea id="ord-notes" name="notes" rows={3}
                value={fields.notes} onChange={handleChange}
                placeholder="Access requirements, existing infrastructure, preferred monitoring partner…"
                className={`${INPUT(false)} resize-none`} />
            </div>
          </Section>

          {/* ── Site Photos ── */}
          <Section title="Site Photos">
            <p className="font-mono text-[10.5px] text-slate-400 -mt-1">
              Optional — upload up to {MAX_PHOTOS} photos of the site (JPG, PNG, WEBP · max {MAX_PHOTO_MB} MB each).
            </p>

            {/* Drop zone */}
            {photos.length < MAX_PHOTOS && (
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); addPhotos(e.dataTransfer.files); }}
                className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 transition-all duration-200 cursor-pointer
                  ${isDragging ? 'border-blue/60 bg-blue/[0.06]' : 'border-slate-200 hover:border-blue/40 hover:bg-blue/[0.03]'}`}
                onClick={() => document.getElementById('photo-input')?.click()}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isDragging ? '#0EA5E9' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <div className="text-center">
                  <p className="text-[13px] font-semibold text-slate-600">
                    {isDragging ? 'Drop photos here' : 'Drag & drop or click to upload'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {MAX_PHOTOS - photos.length} of {MAX_PHOTOS} slots remaining
                  </p>
                </div>
                <input
                  id="photo-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  className="sr-only"
                  onChange={e => { if (e.target.files) addPhotos(e.target.files); e.target.value = ''; }}
                />
              </div>
            )}

            {/* Thumbnails */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {photos.map(photo => (
                  <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.preview} alt={photo.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200" />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-500"
                      aria-label={`Remove ${photo.name}`}
                    >
                      <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" />
                      </svg>
                    </button>
                    <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <p className="text-[9px] text-white truncate">{photo.name}</p>
                      <p className="text-[9px] text-white/60">{(photo.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {photoError && (
              <p className={ERR} role="alert">{photoError}</p>
            )}
          </Section>

          {/* Server error */}
          {formState === 'error' && serverError && (
            <div role="alert" className="rounded-2xl bg-red-950/25 border border-red-500/35 px-5 py-4 flex items-start gap-3">
              <svg className="flex-shrink-0 mt-0.5 text-red-400" width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span className="text-[12.5px] text-red-400 leading-relaxed">{serverError}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="w-full mt-2 bg-blue hover:bg-blue-light text-midnight disabled:opacity-50 disabled:cursor-not-allowed font-bold py-3.5 rounded-xl text-sm tracking-wide transition-all duration-200 hover:shadow-blue-glow active:scale-[0.98] flex items-center justify-center gap-2.5"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" aria-hidden="true" />
                Submitting Order…
              </>
            ) : (
              'Submit Order →'
            )}
          </button>

          <p className="text-center text-[10px] text-slate-400 font-mono uppercase tracking-[0.15em] pb-4">
            Secure · Confidential · NomadXE
          </p>
        </form>
      </div>
    </div>
  );
}
