'use client';

/**
 * OrderFormClient
 *
 * Headless "Method 2" order form — POSTs JSON to /api/order which proxies
 * to Make.com → Airtable → Missive/Front draft.
 *
 * Features:
 *  • Full client-side validation before any network call
 *  • GPS decimal-degree validation (lat -90→90, lng -180→180)
 *  • UTM / URL-param capture on mount stored as hidden payload fields
 *  • Three UI states: idle | submitting | success
 *  • Zero third-party scripts or external redirects
 */

import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';

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

const POWER_SOURCES = ['Solar (Self-contained)', 'Shore Power (Grid-tied)', 'Generator', 'Hybrid'];

const TRAILER_COUNTS = ['1', '2', '3', '4+'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormState = 'idle' | 'submitting' | 'success' | 'error';

interface FieldErrors {
  full_name?: string;
  email?: string;
  company?: string;
  phone?: string;
  site_type?: string;
  site_address?: string;
  gps_lat?: string;
  gps_lng?: string;
  start_date?: string;
  duration?: string;
  trailer_count?: string;
  power_source?: string;
}

interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  utm_id?: string;
  [key: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/**
 * Decimal-degree latitude: -90 to +90
 * Accepts: "40.7128", "-33.8688", "90", "-90.0"
 */
function validateLat(v: string): boolean {
  const n = parseFloat(v.trim());
  if (isNaN(n)) return false;
  if (n < -90 || n > 90) return false;
  // Must look like a decimal number (no extra chars)
  return /^-?\d+(\.\d+)?$/.test(v.trim());
}

/**
 * Decimal-degree longitude: -180 to +180
 */
function validateLng(v: string): boolean {
  const n = parseFloat(v.trim());
  if (isNaN(n)) return false;
  if (n < -180 || n > 180) return false;
  return /^-?\d+(\.\d+)?$/.test(v.trim());
}

function validate(fields: typeof INITIAL_FIELDS): FieldErrors {
  const e: FieldErrors = {};

  if (!fields.full_name.trim()) e.full_name = 'Full name is required.';
  if (!fields.email.trim()) {
    e.email = 'Email is required.';
  } else if (!validateEmail(fields.email)) {
    e.email = 'Enter a valid email address.';
  }
  if (!fields.company.trim()) e.company = 'Company / organisation is required.';

  if (!fields.site_type) e.site_type = 'Select a site type.';
  if (!fields.site_address.trim()) e.site_address = 'Site address is required.';

  if (!fields.gps_lat.trim()) {
    e.gps_lat = 'Latitude is required.';
  } else if (!validateLat(fields.gps_lat)) {
    e.gps_lat = 'Enter decimal degrees between −90 and 90 (e.g. 40.7128).';
  }

  if (!fields.gps_lng.trim()) {
    e.gps_lng = 'Longitude is required.';
  } else if (!validateLng(fields.gps_lng)) {
    e.gps_lng = 'Enter decimal degrees between −180 and 180 (e.g. −74.0060).';
  }

  if (!fields.start_date) e.start_date = 'Deployment start date is required.';
  if (!fields.duration) e.duration = 'Select a deployment duration.';
  if (!fields.trailer_count) e.trailer_count = 'Select number of trailers.';
  if (!fields.power_source) e.power_source = 'Select a power source.';

  return e;
}

// ---------------------------------------------------------------------------
// Initial form state
// ---------------------------------------------------------------------------

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
  power_source: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Shared input / label className factories
// ---------------------------------------------------------------------------

const labelCls =
  'block font-mono text-[10.5px] tracking-widest uppercase text-white/40 mb-1.5';

const inputCls = (hasError: boolean) =>
  `w-full bg-surface border rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all duration-200 focus:ring-2 ${
    hasError
      ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
      : 'border-white/10 focus:border-blue/60 focus:ring-blue/20 focus:shadow-blue-glow'
  }`;

const errorCls = 'mt-1 text-xs text-red-400 font-mono';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrderFormClient() {
  const sectionRef = useRef<HTMLElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const [formState, setFormState] = useState<FormState>('idle');
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [utmParams, setUtmParams] = useState<UtmParams>({});

  // ── UTM capture on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const captured: UtmParams = {};
    // Capture ALL query params; standard UTMs + any extras (gclid, fbclid, …)
    params.forEach((value, key) => {
      captured[key] = value;
    });
    if (Object.keys(captured).length > 0) setUtmParams(captured);
  }, []);

  // ── GSAP entrance animation ───────────────────────────────────────────────
  useLayoutEffect(() => {
    let ctx: { revert: () => void } | null = null;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    import('gsap').then(({ gsap }) =>
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);
        ctx = gsap.context(() => {
          gsap.fromTo(
            '[data-order-animate]',
            { opacity: 0, y: 28 },
            {
              opacity: 1,
              y: 0,
              duration: 0.75,
              ease: 'power3.out',
              stagger: 0.08,
              scrollTrigger: {
                trigger: sectionRef.current,
                start: 'top 72%',
              },
            }
          );
        }, sectionRef);
      })
    );

    return () => ctx?.revert();
  }, []);

  // Scroll success panel into view
  useEffect(() => {
    if (formState === 'success' && successRef.current) {
      successRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [formState]);

  // ── Field change handler ──────────────────────────────────────────────────
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFields((prev) => ({ ...prev, [name]: value }));
      // Clear the specific field error on change
      if (errors[name as keyof FieldErrors]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [errors]
  );

  // ── Submit handler ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // Client-side validation pass
    const fieldErrors = validate(fields);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      // Focus first errored input
      const firstKey = Object.keys(fieldErrors)[0];
      const el = document.querySelector<HTMLElement>(`[name="${firstKey}"]`);
      el?.focus();
      return;
    }

    setErrors({});
    setFormState('submitting');

    try {
      const payload = {
        // Contact
        full_name: fields.full_name.trim(),
        email: fields.email.trim().toLowerCase(),
        company: fields.company.trim(),
        ...(fields.phone.trim() && { phone: fields.phone.trim() }),

        // Site
        site_type: fields.site_type,
        site_address: fields.site_address.trim(),
        gps_lat: fields.gps_lat.trim(),
        gps_lng: fields.gps_lng.trim(),

        // Deployment
        start_date: fields.start_date,
        duration: fields.duration,
        trailer_count: fields.trailer_count,
        power_source: fields.power_source,

        // Optional
        ...(fields.notes.trim() && { notes: fields.notes.trim() }),

        // UTM attribution (spreads all captured params into payload)
        ...utmParams,
      };

      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setFormState('success');
      } else {
        const data = await res.json().catch(() => ({}));
        setServerError(
          data?.error ?? 'Something went wrong. Please try again or email sales@nomadxe.com.'
        );
        setFormState('error');
      }
    } catch {
      setServerError(
        'Network error — please check your connection and try again.'
      );
      setFormState('error');
    }
  };

  const isSubmitting = formState === 'submitting';

  // ── Today's date for min on start_date input ──────────────────────────────
  const today = new Date().toISOString().split('T')[0];

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <section
      ref={sectionRef}
      id="order"
      aria-label="Place a deployment order"
      className="bg-midnight min-h-screen py-24 px-6 md:px-12 lg:px-20"
    >
      {/* ── Page header ── */}
      <div className="max-w-3xl mx-auto mb-14">
        <p data-order-animate className="font-mono text-xs tracking-widest uppercase text-blue/60 mb-4">
          Deploy NomadXE
        </p>
        <h1 data-order-animate className="text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
          Secure your{' '}
          <em className="font-display italic text-blue not-italic">deployment.</em>
        </h1>
        <p data-order-animate className="text-white/55 leading-relaxed max-w-xl">
          Complete the form below to place your order. Our SOC team will review your site profile
          and send a confirmation email shortly.
        </p>
      </div>

      {/* ── Main content: form or success ── */}
      <div className="max-w-3xl mx-auto">

        {/* ────────────────── SUCCESS STATE ────────────────── */}
        {formState === 'success' ? (
          <div
            ref={successRef}
            data-order-animate
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="bg-surface rounded-3xl border border-blue/20 shadow-blue-glow-lg p-12 md:p-16 flex flex-col items-center text-center gap-8"
          >
            {/* Animated check */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-blue/10 border border-blue/30 flex items-center justify-center">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0EA5E9"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              {/* Pulse ring */}
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-full border border-blue/20 animate-ping"
                style={{ animationDuration: '2s' }}
              />
            </div>

            {/* Status tag */}
            <div className="font-mono text-xs tracking-widest uppercase text-blue/70 bg-blue/10 border border-blue/20 rounded-full px-4 py-1.5">
              Order Received
            </div>

            {/* Headline */}
            <div className="space-y-4 max-w-md">
              <h2 className="text-2xl md:text-3xl font-bold text-white leading-snug">
                You&rsquo;re in the queue.
              </h2>
              <p className="text-white/60 leading-relaxed">
                Your Nomadxe order has been secured. Our SOC team is reviewing your site profile
                and will send a confirmation email shortly.
              </p>
            </div>

            {/* Order meta */}
            <div className="w-full bg-midnight rounded-2xl border border-white/8 p-6 grid sm:grid-cols-2 gap-4 text-left">
              {[
                { label: 'Site Type', value: fields.site_type },
                { label: 'Trailers', value: fields.trailer_count },
                { label: 'Start Date', value: new Date(fields.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
                { label: 'Duration', value: fields.duration },
                { label: 'Power Source', value: fields.power_source },
                { label: 'GPS', value: `${parseFloat(fields.gps_lat).toFixed(5)}, ${parseFloat(fields.gps_lng).toFixed(5)}` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-0.5">
                    {label}
                  </p>
                  <p className="text-sm text-white/80">{value || '—'}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
              <a
                href="/"
                className="inline-flex items-center gap-2 border border-white/15 text-white/60 hover:text-white hover:border-white/30 font-mono text-xs tracking-widest uppercase rounded-full px-6 py-2.5 transition-all duration-200"
              >
                ← Back to NomadXE.com
              </a>
              <a
                href="mailto:sales@nomadxe.com"
                className="inline-flex items-center gap-2 text-blue/70 hover:text-blue font-mono text-xs tracking-widest uppercase transition-colors duration-200"
              >
                Questions? sales@nomadxe.com
              </a>
            </div>
          </div>
        ) : (

          /* ────────────────── FORM ────────────────── */
          <form
            onSubmit={handleSubmit}
            noValidate
            aria-label="Deployment order form"
            className="space-y-8"
          >

            {/* ── Section: Contact ── */}
            <fieldset data-order-animate className="bg-surface rounded-2xl border border-white/8 p-6 md:p-8 space-y-5">
              <legend className="font-mono text-[11px] tracking-widest uppercase text-blue/60 px-1">
                Contact Information
              </legend>

              {/* Name + Email */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ord-full-name" className={labelCls}>
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="ord-full-name"
                    name="full_name"
                    type="text"
                    required
                    autoComplete="name"
                    value={fields.full_name}
                    onChange={handleChange}
                    placeholder="Jane Smith"
                    aria-invalid={!!errors.full_name}
                    aria-describedby={errors.full_name ? 'err-full-name' : undefined}
                    className={inputCls(!!errors.full_name)}
                  />
                  {errors.full_name && (
                    <p id="err-full-name" className={errorCls} role="alert">
                      {errors.full_name}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="ord-email" className={labelCls}>
                    Work Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="ord-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={fields.email}
                    onChange={handleChange}
                    placeholder="jane@company.com"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'err-email' : undefined}
                    className={inputCls(!!errors.email)}
                  />
                  {errors.email && (
                    <p id="err-email" className={errorCls} role="alert">
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Company + Phone */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ord-company" className={labelCls}>
                    Company / Organisation <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="ord-company"
                    name="company"
                    type="text"
                    required
                    autoComplete="organization"
                    value={fields.company}
                    onChange={handleChange}
                    placeholder="Acme Construction LLC"
                    aria-invalid={!!errors.company}
                    aria-describedby={errors.company ? 'err-company' : undefined}
                    className={inputCls(!!errors.company)}
                  />
                  {errors.company && (
                    <p id="err-company" className={errorCls} role="alert">
                      {errors.company}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="ord-phone" className={labelCls}>
                    Phone Number
                  </label>
                  <input
                    id="ord-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={fields.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                    className={inputCls(false)}
                  />
                </div>
              </div>
            </fieldset>

            {/* ── Section: Site Details ── */}
            <fieldset data-order-animate className="bg-surface rounded-2xl border border-white/8 p-6 md:p-8 space-y-5">
              <legend className="font-mono text-[11px] tracking-widest uppercase text-blue/60 px-1">
                Site Details
              </legend>

              {/* Site Type + Address */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ord-site-type" className={labelCls}>
                    Site Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="ord-site-type"
                    name="site_type"
                    required
                    value={fields.site_type}
                    onChange={handleChange}
                    aria-invalid={!!errors.site_type}
                    aria-describedby={errors.site_type ? 'err-site-type' : undefined}
                    className={`${inputCls(!!errors.site_type)} appearance-none cursor-pointer`}
                    style={{ color: fields.site_type ? 'white' : 'rgba(255,255,255,0.2)' }}
                  >
                    <option value="" disabled>
                      Select type…
                    </option>
                    {SITE_TYPES.map((t) => (
                      <option key={t} value={t} style={{ color: 'white', background: '#13151A' }}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {errors.site_type && (
                    <p id="err-site-type" className={errorCls} role="alert">
                      {errors.site_type}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="ord-site-address" className={labelCls}>
                    Site Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="ord-site-address"
                    name="site_address"
                    type="text"
                    required
                    autoComplete="street-address"
                    value={fields.site_address}
                    onChange={handleChange}
                    placeholder="123 Site Rd, City, ST 00000"
                    aria-invalid={!!errors.site_address}
                    aria-describedby={errors.site_address ? 'err-site-address' : undefined}
                    className={inputCls(!!errors.site_address)}
                  />
                  {errors.site_address && (
                    <p id="err-site-address" className={errorCls} role="alert">
                      {errors.site_address}
                    </p>
                  )}
                </div>
              </div>

              {/* GPS coordinates */}
              <div>
                <p className={labelCls}>
                  GPS Coordinates — Decimal Degrees <span className="text-red-400">*</span>
                </p>
                <p className="text-[11px] text-white/30 font-mono mb-3">
                  e.g.&nbsp; Lat: 40.7128 &nbsp;|&nbsp; Lng: −74.0060
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="ord-gps-lat" className={labelCls}>
                      Latitude
                    </label>
                    <input
                      id="ord-gps-lat"
                      name="gps_lat"
                      type="text"
                      inputMode="decimal"
                      required
                      value={fields.gps_lat}
                      onChange={handleChange}
                      placeholder="40.7128"
                      pattern="-?\d+(\.\d+)?"
                      aria-invalid={!!errors.gps_lat}
                      aria-describedby={errors.gps_lat ? 'err-gps-lat' : 'hint-gps-lat'}
                      className={inputCls(!!errors.gps_lat)}
                    />
                    <p id="hint-gps-lat" className="mt-1 text-[11px] text-white/25 font-mono">
                      −90 to 90
                    </p>
                    {errors.gps_lat && (
                      <p id="err-gps-lat" className={errorCls} role="alert">
                        {errors.gps_lat}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="ord-gps-lng" className={labelCls}>
                      Longitude
                    </label>
                    <input
                      id="ord-gps-lng"
                      name="gps_lng"
                      type="text"
                      inputMode="decimal"
                      required
                      value={fields.gps_lng}
                      onChange={handleChange}
                      placeholder="-74.0060"
                      pattern="-?\d+(\.\d+)?"
                      aria-invalid={!!errors.gps_lng}
                      aria-describedby={errors.gps_lng ? 'err-gps-lng' : 'hint-gps-lng'}
                      className={inputCls(!!errors.gps_lng)}
                    />
                    <p id="hint-gps-lng" className="mt-1 text-[11px] text-white/25 font-mono">
                      −180 to 180
                    </p>
                    {errors.gps_lng && (
                      <p id="err-gps-lng" className={errorCls} role="alert">
                        {errors.gps_lng}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </fieldset>

            {/* ── Section: Deployment ── */}
            <fieldset data-order-animate className="bg-surface rounded-2xl border border-white/8 p-6 md:p-8 space-y-5">
              <legend className="font-mono text-[11px] tracking-widest uppercase text-blue/60 px-1">
                Deployment Requirements
              </legend>

              {/* Start Date + Duration */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ord-start-date" className={labelCls}>
                    Target Start Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="ord-start-date"
                    name="start_date"
                    type="date"
                    required
                    min={today}
                    value={fields.start_date}
                    onChange={handleChange}
                    aria-invalid={!!errors.start_date}
                    aria-describedby={errors.start_date ? 'err-start-date' : undefined}
                    className={`${inputCls(!!errors.start_date)} [color-scheme:dark]`}
                  />
                  {errors.start_date && (
                    <p id="err-start-date" className={errorCls} role="alert">
                      {errors.start_date}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="ord-duration" className={labelCls}>
                    Deployment Duration <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="ord-duration"
                    name="duration"
                    required
                    value={fields.duration}
                    onChange={handleChange}
                    aria-invalid={!!errors.duration}
                    aria-describedby={errors.duration ? 'err-duration' : undefined}
                    className={`${inputCls(!!errors.duration)} appearance-none cursor-pointer`}
                    style={{ color: fields.duration ? 'white' : 'rgba(255,255,255,0.2)' }}
                  >
                    <option value="" disabled>
                      Select duration…
                    </option>
                    {DURATIONS.map((d) => (
                      <option key={d} value={d} style={{ color: 'white', background: '#13151A' }}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {errors.duration && (
                    <p id="err-duration" className={errorCls} role="alert">
                      {errors.duration}
                    </p>
                  )}
                </div>
              </div>

              {/* Trailer count + Power */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ord-trailer-count" className={labelCls}>
                    Number of Trailers <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="ord-trailer-count"
                    name="trailer_count"
                    required
                    value={fields.trailer_count}
                    onChange={handleChange}
                    aria-invalid={!!errors.trailer_count}
                    aria-describedby={errors.trailer_count ? 'err-trailer-count' : undefined}
                    className={`${inputCls(!!errors.trailer_count)} appearance-none cursor-pointer`}
                    style={{ color: fields.trailer_count ? 'white' : 'rgba(255,255,255,0.2)' }}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {TRAILER_COUNTS.map((c) => (
                      <option key={c} value={c} style={{ color: 'white', background: '#13151A' }}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {errors.trailer_count && (
                    <p id="err-trailer-count" className={errorCls} role="alert">
                      {errors.trailer_count}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="ord-power-source" className={labelCls}>
                    Power Source <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="ord-power-source"
                    name="power_source"
                    required
                    value={fields.power_source}
                    onChange={handleChange}
                    aria-invalid={!!errors.power_source}
                    aria-describedby={errors.power_source ? 'err-power-source' : undefined}
                    className={`${inputCls(!!errors.power_source)} appearance-none cursor-pointer`}
                    style={{ color: fields.power_source ? 'white' : 'rgba(255,255,255,0.2)' }}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {POWER_SOURCES.map((p) => (
                      <option key={p} value={p} style={{ color: 'white', background: '#13151A' }}>
                        {p}
                      </option>
                    ))}
                  </select>
                  {errors.power_source && (
                    <p id="err-power-source" className={errorCls} role="alert">
                      {errors.power_source}
                    </p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="ord-notes" className={labelCls}>
                  Additional Notes
                </label>
                <textarea
                  id="ord-notes"
                  name="notes"
                  rows={4}
                  value={fields.notes}
                  onChange={handleChange}
                  placeholder="Special access requirements, existing infrastructure, security concerns, preferred monitoring partner…"
                  className={`${inputCls(false)} resize-none`}
                />
              </div>
            </fieldset>

            {/* ── Server error banner ── */}
            {formState === 'error' && serverError && (
              <div
                data-order-animate
                role="alert"
                className="rounded-2xl bg-red-500/10 border border-red-500/30 px-5 py-4 flex items-start gap-3"
              >
                <svg
                  className="flex-shrink-0 mt-0.5 text-red-400"
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm text-red-400 leading-relaxed">{serverError}</span>
              </div>
            )}

            {/* ── UTM debug (dev only) ── */}
            {process.env.NODE_ENV === 'development' && Object.keys(utmParams).length > 0 && (
              <details className="text-xs font-mono text-white/20 border border-white/5 rounded-xl p-3">
                <summary className="cursor-pointer">UTM params captured ({Object.keys(utmParams).length})</summary>
                <pre className="mt-2 overflow-auto">{JSON.stringify(utmParams, null, 2)}</pre>
              </details>
            )}

            {/* ── Submit ── */}
            <div data-order-animate className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                aria-disabled={isSubmitting}
                className="w-full bg-blue text-midnight font-bold rounded-full py-4 text-sm tracking-wide transition-all duration-300 hover:scale-[1.01] hover:shadow-blue-glow active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2.5"
              >
                {isSubmitting ? (
                  <>
                    <span
                      className="w-4 h-4 rounded-full border-2 border-midnight/30 border-t-midnight animate-spin"
                      aria-hidden="true"
                    />
                    Submitting Order…
                  </>
                ) : (
                  'Submit Order →'
                )}
              </button>

              <p className="text-center text-xs text-white/25 font-mono">
                By submitting you agree to be contacted by the NomadXE team regarding your
                deployment.
              </p>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
