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

const POWER_SOURCES = [
  'Option 01 — Trailer & Power Base',
  'Option 02 — Fully Equipped',
];

const TRAILER_COUNTS = ['1', '2', '3', '4+'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormState = 'idle' | 'submitting' | 'success' | 'error';

interface FieldErrors {
  full_name?: string;
  email?: string;
  company?: string;
  site_type?: string;
  site_address?: string;
  gps_lat?: string;
  gps_lng?: string;
  start_date?: string;
  duration?: string;
  trailer_count?: string;
  deployment_option?: string;
}

interface UtmParams {
  [key: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
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
  site_type: '',
  site_address: '',
  gps_lat: '',
  gps_lng: '',
  start_date: '',
  duration: '',
  trailer_count: '',
  deployment_option: '',
  notes: '',
};

function validate(fields: typeof INITIAL_FIELDS): FieldErrors {
  const e: FieldErrors = {};
  if (!fields.full_name.trim()) e.full_name = 'Required';
  if (!fields.email.trim()) {
    e.email = 'Required';
  } else if (!validateEmail(fields.email)) {
    e.email = 'Invalid email address';
  }
  if (!fields.company.trim()) e.company = 'Required';
  if (!fields.site_type) e.site_type = 'Select a site type';
  if (!fields.site_address.trim()) e.site_address = 'Required';
  if (fields.gps_lat.trim() && !validateLat(fields.gps_lat)) {
    e.gps_lat = 'Decimal degrees, −90 to 90';
  }
  if (fields.gps_lng.trim() && !validateLng(fields.gps_lng)) {
    e.gps_lng = 'Decimal degrees, −180 to 180';
  }
  if (!fields.start_date) e.start_date = 'Required';
  if (!fields.duration) e.duration = 'Select duration';
  if (!fields.trailer_count) e.trailer_count = 'Select count';
  if (!fields.deployment_option) e.deployment_option = 'Select power source';
  return e;
}

// ---------------------------------------------------------------------------
// Shared style helpers
// ---------------------------------------------------------------------------

const LABEL =
  'block text-[10.5px] font-semibold text-[#93c5fd]/55 uppercase tracking-[0.12em] mb-1.5';

const INPUT = (err: boolean) =>
  `w-full bg-[#080c14] border rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#93c5fd]/18 outline-none transition-all duration-200 focus:ring-2 ${
    err
      ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/15'
      : 'border-[#1e3a5f] focus:border-[#3b82f6] focus:ring-[#3b82f6]/20'
  }`;

const ERR = 'mt-1 text-[11px] text-red-400 font-mono';

const SELECT_STYLE = (val: string, err: boolean) => ({
  color: val ? 'white' : 'rgba(147,197,253,0.18)',
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
    <div className="bg-[#0d1526] border border-[#1e3a5f]/80 rounded-2xl overflow-hidden">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#3b82f6]/25 to-transparent" />
      <div className="px-6 py-5 border-b border-[#1e3a5f]/50">
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#3b82f6]/60">
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const fieldErrors = validate(fields);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      const firstKey = Object.keys(fieldErrors)[0];
      document.querySelector<HTMLElement>(`[name="${firstKey}"]`)?.focus();
      return;
    }
    setErrors({});
    setFormState('submitting');
    try {
      const payload = {
        full_name: fields.full_name.trim(),
        email: fields.email.trim().toLowerCase(),
        company: fields.company.trim(),
        ...(fields.phone.trim() && { phone: fields.phone.trim() }),
        site_type: fields.site_type,
        site_address: fields.site_address.trim(),
        ...(fields.gps_lat.trim() && { gps_lat: fields.gps_lat.trim() }),
        ...(fields.gps_lng.trim() && { gps_lng: fields.gps_lng.trim() }),
        start_date: fields.start_date,
        duration: fields.duration,
        trailer_count: fields.trailer_count,
        deployment_option: fields.deployment_option,
        ...(fields.notes.trim() && { notes: fields.notes.trim() }),
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

  // =========================================================================
  // SUCCESS STATE
  // =========================================================================

  if (formState === 'success') {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background dot grid */}
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
          style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        {/* Top accent bar */}
        <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />
        {/* Ambient glow */}
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 38%, rgba(37,99,235,0.08) 0%, transparent 100%)' }}
        />

        <div className="relative z-10 w-full max-w-lg text-center space-y-8">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-[#1e40af]/20 border border-[#3b82f6]/30 flex items-center justify-center">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div
                className="absolute inset-0 rounded-full border border-[#3b82f6]/20 animate-ping"
                style={{ animationDuration: '2.5s' }}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Status tag */}
          <div className="inline-flex items-center gap-2 bg-[#1e40af]/15 border border-[#3b82f6]/25 rounded-full px-5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" aria-hidden="true" />
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#3b82f6]/80">
              Order Received
            </span>
          </div>

          {/* Wordmark */}
          <div>
            <span className="font-mono text-2xl font-black tracking-[0.18em] uppercase text-white">
              NOMAD<span className="text-[#3b82f6]">XE</span>
            </span>
          </div>

          {/* Message */}
          <div className="bg-[#0d1526] border border-[#1e3a5f]/80 rounded-2xl overflow-hidden">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#3b82f6]/25 to-transparent" />
            <div className="px-8 py-8 space-y-4">
              <h1 className="text-xl font-bold text-white">
                You&rsquo;re in the queue.
              </h1>
              <p className="text-[13.5px] text-[#93c5fd]/60 leading-relaxed">
                Your Nomadxe order has been secured. Our SOC team is reviewing
                your site profile and will send a confirmation email shortly.
              </p>
            </div>
          </div>

          {/* Order summary */}
          <div className="bg-[#0d1526] border border-[#1e3a5f]/80 rounded-2xl overflow-hidden text-left">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#3b82f6]/25 to-transparent" />
            <div className="px-6 py-4 border-b border-[#1e3a5f]/50">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#3b82f6]/60">
                Order Summary
              </span>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                { label: 'Site Type', value: fields.site_type },
                { label: 'Trailers', value: fields.trailer_count },
                {
                  label: 'Start Date',
                  value: new Date(fields.start_date + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  }),
                },
                { label: 'Duration', value: fields.duration },
                { label: 'Deployment', value: fields.deployment_option },
                {
                  label: 'GPS',
                  value:
                    fields.gps_lat.trim() && fields.gps_lng.trim()
                      ? `${parseFloat(fields.gps_lat).toFixed(4)}, ${parseFloat(fields.gps_lng).toFixed(4)}`
                      : '—',
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-[#93c5fd]/30 mb-0.5">
                    {label}
                  </p>
                  <p className="text-[13px] text-white/80">{value || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Nav */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[11px] text-[#93c5fd]/35 hover:text-[#93c5fd]/70 transition-colors duration-200 font-mono uppercase tracking-[0.15em]"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 12L6 8l4-4" />
              </svg>
              Back to NomadXE.com
            </Link>
            <span className="hidden sm:block text-[#1e3a5f]">·</span>
            <a
              href="mailto:sales@nomadxe.com"
              className="text-[11px] text-[#3b82f6]/50 hover:text-[#3b82f6] transition-colors duration-200 font-mono uppercase tracking-[0.15em]"
            >
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
    <div className="min-h-screen bg-[#080c14] relative overflow-x-hidden">
      {/* Background dot grid */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />
      {/* Top accent bar */}
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(37,99,235,0.07) 0%, transparent 100%)' }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-5 py-16 sm:py-20">

        {/* ── Header ── */}
        <div className="text-center mb-10">
          <Link
            href="/"
            className="inline-flex flex-col items-center gap-3 group mb-8"
            aria-label="Back to NomadXE home"
          >
            <div className="w-11 h-11 rounded-xl bg-[#1e40af]/20 border border-[#3b82f6]/20 flex items-center justify-center group-hover:border-[#3b82f6]/50 group-hover:bg-[#1e40af]/30 transition-all duration-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <span className="font-mono text-[21px] font-black tracking-[0.18em] uppercase text-white leading-none">
              NOMAD<span className="text-[#3b82f6]">XE</span>
            </span>
          </Link>

          <h1 className="text-[22px] font-bold text-white tracking-tight mb-2">
            Secure a Deployment
          </h1>
          <p className="text-[12.5px] text-[#93c5fd]/40 leading-relaxed max-w-sm mx-auto">
            Complete the form below. Our SOC team will review your site profile
            and send a confirmation email shortly.
          </p>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} noValidate aria-label="Deployment order form" className="space-y-4">

          {/* Contact */}
          <Section title="Contact Information">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ord-full-name" className={LABEL}>
                  Full Name <span className="text-red-400/80">*</span>
                </label>
                <input id="ord-full-name" name="full_name" type="text" required autoComplete="name"
                  value={fields.full_name} onChange={handleChange} placeholder="Jane Smith"
                  aria-invalid={!!errors.full_name} className={INPUT(!!errors.full_name)} />
                {errors.full_name && <p className={ERR} role="alert">{errors.full_name}</p>}
              </div>
              <div>
                <label htmlFor="ord-email" className={LABEL}>
                  Work Email <span className="text-red-400/80">*</span>
                </label>
                <input id="ord-email" name="email" type="email" required autoComplete="email"
                  value={fields.email} onChange={handleChange} placeholder="jane@company.com"
                  aria-invalid={!!errors.email} className={INPUT(!!errors.email)} />
                {errors.email && <p className={ERR} role="alert">{errors.email}</p>}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ord-company" className={LABEL}>
                  Company <span className="text-red-400/80">*</span>
                </label>
                <input id="ord-company" name="company" type="text" required autoComplete="organization"
                  value={fields.company} onChange={handleChange} placeholder="Acme Construction LLC"
                  aria-invalid={!!errors.company} className={INPUT(!!errors.company)} />
                {errors.company && <p className={ERR} role="alert">{errors.company}</p>}
              </div>
              <div>
                <label htmlFor="ord-phone" className={LABEL}>Phone</label>
                <input id="ord-phone" name="phone" type="tel" autoComplete="tel"
                  value={fields.phone} onChange={handleChange} placeholder="+1 (555) 000-0000"
                  className={INPUT(false)} />
              </div>
            </div>
          </Section>

          {/* Site Details */}
          <Section title="Site Details">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ord-site-type" className={LABEL}>
                  Site Type <span className="text-red-400/80">*</span>
                </label>
                <select id="ord-site-type" name="site_type" required
                  value={fields.site_type} onChange={handleChange}
                  aria-invalid={!!errors.site_type}
                  className={`${INPUT(!!errors.site_type)} appearance-none cursor-pointer`}
                  style={SELECT_STYLE(fields.site_type, !!errors.site_type)}>
                  <option value="" disabled>Select type…</option>
                  {SITE_TYPES.map((t) => (
                    <option key={t} value={t} style={{ color: 'white', background: '#080c14' }}>{t}</option>
                  ))}
                </select>
                {errors.site_type && <p className={ERR} role="alert">{errors.site_type}</p>}
              </div>
              <div>
                <label htmlFor="ord-site-address" className={LABEL}>
                  Site Address <span className="text-red-400/80">*</span>
                </label>
                <input id="ord-site-address" name="site_address" type="text" required
                  value={fields.site_address} onChange={handleChange} placeholder="123 Site Rd, City, ST"
                  aria-invalid={!!errors.site_address} className={INPUT(!!errors.site_address)} />
                {errors.site_address && <p className={ERR} role="alert">{errors.site_address}</p>}
              </div>
            </div>

            {/* GPS */}
            <div>
              <p className={`${LABEL} mb-0.5`}>
                GPS Coordinates — Decimal Degrees{' '}
                <span className="normal-case text-[#93c5fd]/40 font-normal tracking-normal">(optional)</span>
              </p>
              <p className="font-mono text-[10.5px] text-[#93c5fd]/25 mb-3">
                e.g. Lat: 40.7128 &nbsp;·&nbsp; Lng: −74.0060
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ord-gps-lat" className={LABEL}>Latitude</label>
                  <input id="ord-gps-lat" name="gps_lat" type="text" inputMode="decimal"
                    value={fields.gps_lat} onChange={handleChange} placeholder="40.7128"
                    aria-invalid={!!errors.gps_lat} className={INPUT(!!errors.gps_lat)} />
                  <p className="mt-1 font-mono text-[10px] text-[#93c5fd]/22">−90 to 90</p>
                  {errors.gps_lat && <p className={ERR} role="alert">{errors.gps_lat}</p>}
                </div>
                <div>
                  <label htmlFor="ord-gps-lng" className={LABEL}>Longitude</label>
                  <input id="ord-gps-lng" name="gps_lng" type="text" inputMode="decimal"
                    value={fields.gps_lng} onChange={handleChange} placeholder="-74.0060"
                    aria-invalid={!!errors.gps_lng} className={INPUT(!!errors.gps_lng)} />
                  <p className="mt-1 font-mono text-[10px] text-[#93c5fd]/22">−180 to 180</p>
                  {errors.gps_lng && <p className={ERR} role="alert">{errors.gps_lng}</p>}
                </div>
              </div>
            </div>
          </Section>

          {/* Deployment */}
          <Section title="Deployment Requirements">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ord-start-date" className={LABEL}>
                  Target Start Date <span className="text-red-400/80">*</span>
                </label>
                <input id="ord-start-date" name="start_date" type="date" required min={today}
                  value={fields.start_date} onChange={handleChange}
                  aria-invalid={!!errors.start_date}
                  className={`${INPUT(!!errors.start_date)} [color-scheme:dark]`} />
                {errors.start_date && <p className={ERR} role="alert">{errors.start_date}</p>}
              </div>
              <div>
                <label htmlFor="ord-duration" className={LABEL}>
                  Duration <span className="text-red-400/80">*</span>
                </label>
                <select id="ord-duration" name="duration" required
                  value={fields.duration} onChange={handleChange}
                  aria-invalid={!!errors.duration}
                  className={`${INPUT(!!errors.duration)} appearance-none cursor-pointer`}
                  style={SELECT_STYLE(fields.duration, !!errors.duration)}>
                  <option value="" disabled>Select duration…</option>
                  {DURATIONS.map((d) => (
                    <option key={d} value={d} style={{ color: 'white', background: '#080c14' }}>{d}</option>
                  ))}
                </select>
                {errors.duration && <p className={ERR} role="alert">{errors.duration}</p>}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ord-trailer-count" className={LABEL}>
                  No. of Trailers <span className="text-red-400/80">*</span>
                </label>
                <select id="ord-trailer-count" name="trailer_count" required
                  value={fields.trailer_count} onChange={handleChange}
                  aria-invalid={!!errors.trailer_count}
                  className={`${INPUT(!!errors.trailer_count)} appearance-none cursor-pointer`}
                  style={SELECT_STYLE(fields.trailer_count, !!errors.trailer_count)}>
                  <option value="" disabled>Select…</option>
                  {TRAILER_COUNTS.map((c) => (
                    <option key={c} value={c} style={{ color: 'white', background: '#080c14' }}>{c}</option>
                  ))}
                </select>
                {errors.trailer_count && <p className={ERR} role="alert">{errors.trailer_count}</p>}
              </div>
              <div>
                <label htmlFor="ord-power-source" className={LABEL}>
                  Deployment Option <span className="text-red-400/80">*</span>
                </label>
                <select id="ord-power-source" name="deployment_option" required
                  value={fields.deployment_option} onChange={handleChange}
                  aria-invalid={!!errors.deployment_option}
                  className={`${INPUT(!!errors.deployment_option)} appearance-none cursor-pointer`}
                  style={SELECT_STYLE(fields.deployment_option, !!errors.deployment_option)}>
                  <option value="" disabled>Select…</option>
                  {POWER_SOURCES.map((p) => (
                    <option key={p} value={p} style={{ color: 'white', background: '#080c14' }}>{p}</option>
                  ))}
                </select>
                {errors.deployment_option && <p className={ERR} role="alert">{errors.deployment_option}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="ord-notes" className={LABEL}>Additional Notes</label>
              <textarea id="ord-notes" name="notes" rows={3}
                value={fields.notes} onChange={handleChange}
                placeholder="Access requirements, existing infrastructure, preferred monitoring partner…"
                className={`${INPUT(false)} resize-none`} />
            </div>
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
            className="w-full mt-2 bg-[#2563eb] hover:bg-[#3b82f6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm tracking-wide transition-all duration-200 hover:shadow-[0_0_28px_rgba(59,130,246,0.45)] active:scale-[0.98] flex items-center justify-center gap-2.5"
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

          {/* Footer note */}
          <p className="text-center text-[10px] text-[#93c5fd]/20 font-mono uppercase tracking-[0.15em] pb-4">
            Secure · Confidential · NomadXE
          </p>
        </form>
      </div>
    </div>
  );
}
