'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

const RETURN_REASONS = [
  'Project Complete',
  'Site Closed',
  'Budget Hold',
  'Contract End / Lease Expired',
  'Unit Being Relocated — Use Relocation Form',
  'Other',
];

const CONDITION_OPTIONS = [
  'No Issues — Unit in Good Condition',
  'Minor Cosmetic Damage — No Functional Impact',
  'Functional Damage — Describe Below',
  'Theft or Vandalism — Police Report Required',
];

const PICKUP_WINDOWS = [
  'Morning (7am – 12pm)',
  'Afternoon (12pm – 5pm)',
  'Flexible — Any Time',
];

const FORKLIFT_OPTIONS = [
  'Yes — Forklift On-Site',
  'No — NomadXE Will Need to Arrange Equipment',
];

const QUANTITIES = ['1', '2', '3', '4+'];

const LABEL = 'block text-[10.5px] font-semibold text-slate-500 uppercase tracking-[0.12em] mb-1.5';
const INPUT = (err: boolean) =>
  `w-full bg-white border rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 outline-none transition-all duration-200 focus:ring-2 ${
    err
      ? 'border-red-300 focus:border-red-500 focus:ring-red-500/15'
      : 'border-slate-200 focus:border-blue/70 focus:ring-blue/15'
  }`;
const ERR = 'mt-1 text-[11px] text-red-500 font-mono';
const SEL = (val: string) => ({ color: val ? '#0f172a' : '#94a3b8' });

type FormState = 'idle' | 'submitting' | 'success' | 'error';
interface SiteContact { name: string; phone: string; }
type ContactErr = { name?: string; phone?: string };

interface Fields {
  full_name: string; email: string; company: string; phone: string;
  cc_emails: string;
  unit_identifier: string; quantity: string;
  site_name: string; street_address: string; city: string; state: string; zip_code: string;
  pickup_date: string; pickup_window: string;
  pickup_contact_name: string; pickup_contact_phone: string;
  forklift_at_pickup: string; gate_access_instructions: string;
  return_reason: string; equipment_condition: string;
  condition_notes: string; police_report_number: string; last_use_date: string;
  notes: string;
}

type FE = Partial<Record<keyof Fields, string>>;

const INIT: Fields = {
  full_name: '', email: '', company: '', phone: '',
  cc_emails: '',
  unit_identifier: '', quantity: '',
  site_name: '', street_address: '', city: '', state: '', zip_code: '',
  pickup_date: '', pickup_window: '',
  pickup_contact_name: '', pickup_contact_phone: '',
  forklift_at_pickup: '', gate_access_instructions: '',
  return_reason: '', equipment_condition: '',
  condition_notes: '', police_report_number: '', last_use_date: '',
  notes: '',
};

function validate(f: Fields): FE {
  const e: FE = {};
  if (!f.full_name.trim()) e.full_name = 'Required';
  if (!f.email.trim()) { e.email = 'Required'; }
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = 'Invalid email';
  if (!f.company.trim()) e.company = 'Required';
  if (!f.phone.trim()) e.phone = 'Required';
  if (!f.unit_identifier.trim()) e.unit_identifier = 'Required';
  if (!f.quantity) e.quantity = 'Required';
  if (!f.site_name.trim()) e.site_name = 'Required';
  if (!f.street_address.trim()) e.street_address = 'Required';
  if (!f.city.trim()) e.city = 'Required';
  if (!f.state.trim()) e.state = 'Required';
  if (!f.zip_code.trim()) e.zip_code = 'Required';
  if (!f.pickup_date) e.pickup_date = 'Required';
  if (!f.pickup_window) e.pickup_window = 'Required';
  if (!f.pickup_contact_name.trim()) e.pickup_contact_name = 'Required';
  if (!f.pickup_contact_phone.trim()) e.pickup_contact_phone = 'Required';
  if (!f.forklift_at_pickup) e.forklift_at_pickup = 'Required';
  if (!f.return_reason) e.return_reason = 'Required';
  if (!f.equipment_condition) e.equipment_condition = 'Required';
  if (!f.last_use_date) e.last_use_date = 'Required';
  if (f.equipment_condition === 'Functional Damage — Describe Below' && !f.condition_notes.trim())
    e.condition_notes = 'Please describe the damage';
  if (f.equipment_condition === 'Theft or Vandalism — Police Report Required' && !f.police_report_number.trim())
    e.police_report_number = 'Police report number is required';
  return e;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-red-300/50 to-transparent" />
      <div className="px-6 py-4 border-b border-slate-100">
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate-400">{title}</span>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

export default function DeactivateFormClient() {
  const [formState, setFormState] = useState<FormState>('idle');
  const [fields, setFields] = useState<Fields>(INIT);
  const [errors, setErrors] = useState<FE>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [additionalContacts, setAdditionalContacts] = useState<SiteContact[]>([]);
  const [contactErrors, setContactErrors] = useState<ContactErr[]>([]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFields(p => ({ ...p, [name]: value }));
      if (errors[name as keyof FE]) setErrors(p => ({ ...p, [name]: undefined }));
    }, [errors]
  );

  const addContact = () => setAdditionalContacts(p => [...p, { name: '', phone: '' }]);
  const removeContact = (idx: number) => {
    setAdditionalContacts(p => p.filter((_, i) => i !== idx));
    setContactErrors(p => p.filter((_, i) => i !== idx));
  };
  const updateContact = (idx: number, field: 'name' | 'phone', value: string) => {
    setAdditionalContacts(p => p.map((c, i) => i === idx ? { ...c, [field]: value } : c));
    if (contactErrors[idx]?.[field]) setContactErrors(p => p.map((ce, i) => i === idx ? { ...ce, [field]: undefined } : ce));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const cErrs: ContactErr[] = additionalContacts.map(c => ({
      name: !c.name.trim() ? 'Required' : undefined,
      phone: !c.phone.trim() ? 'Required' : undefined,
    }));
    setContactErrors(cErrs);
    const hasContactErrors = cErrs.some(c => c.name || c.phone);

    const errs = validate(fields);
    if (Object.keys(errs).length > 0 || hasContactErrors) {
      setErrors(errs);
      const firstField = Object.keys(errs)[0];
      if (firstField) document.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus();
      return;
    }
    setErrors({});
    setFormState('submitting');
    try {
      const res = await fetch('/api/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          full_name: fields.full_name.trim(),
          email: fields.email.trim().toLowerCase(),
          company: fields.company.trim(),
          additional_pickup_contacts: additionalContacts.filter(c => c.name.trim() || c.phone.trim()),
        }),
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

  const today = new Date().toISOString().split('T')[0];
  const isSubmitting = formState === 'submitting';
  const needsDamageNote = fields.equipment_condition === 'Functional Damage — Describe Below';
  const needsPoliceReport = fields.equipment_condition === 'Theft or Vandalism — Police Report Required';

  function handleReset() {
    setFormState('idle');
    setFields(INIT);
    setErrors({});
    setServerError(null);
    setAdditionalContacts([]);
    setContactErrors([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (formState === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-700 via-red-500 to-red-700 z-[100]" />
        <div className="relative z-10 w-full max-w-lg text-center space-y-8">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-red-900/20 border border-red-500/30 flex items-center justify-center">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="absolute inset-0 rounded-full border border-red-500/20 animate-ping" style={{ animationDuration: '2.5s' }} />
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-red-500/80">Call-Off Received</span>
          </div>
          <div><span className="font-mono text-2xl font-black tracking-[0.18em] uppercase text-slate-900">NOMAD<span className="text-blue">XE</span></span></div>
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-red-300/50 to-transparent" />
            <div className="px-8 py-8 space-y-4">
              <h1 className="text-xl font-bold text-slate-900">Pick-Up Request Logged</h1>
              <p className="text-[13.5px] text-slate-500 leading-relaxed">
                Your deactivation request has been received. Our logistics team will contact the on-site pick-up contact to confirm a window within 1–2 business days.
              </p>
            </div>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm text-left">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-red-300/50 to-transparent" />
            <div className="px-6 py-4 border-b border-slate-100">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate-400">Summary</span>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                { label: 'Unit', value: fields.unit_identifier },
                { label: 'Quantity', value: fields.quantity },
                { label: 'Current Site', value: fields.site_name },
                { label: 'Pick-Up Date', value: fields.pickup_date ? new Date(fields.pickup_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '' },
                { label: 'Window', value: fields.pickup_window },
                { label: 'Last Use Date', value: fields.last_use_date ? new Date(fields.last_use_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-slate-400 mb-0.5">{label}</p>
                  <p className="text-[13px] text-slate-700">{value || '—'}</p>
                </div>
              ))}
            </div>
          </div>
          <button onClick={handleReset} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl text-sm tracking-wide transition-all duration-200 active:scale-[0.98]">
            Submit Another Request
          </button>
          <Link href="/" className="block text-[11px] text-slate-400 hover:text-slate-600 transition-colors font-mono uppercase tracking-[0.15em]">
            Back to NomadXE.com
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-x-hidden">
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-900 via-red-500 to-red-900 z-[100]" />

      <div className="relative z-10 max-w-2xl mx-auto px-5 py-16 sm:py-20">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex flex-col items-center gap-3 group mb-8">
            <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center group-hover:border-red-400 transition-all duration-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7" />
                <path d="M16 2v4M8 2v4M3 10h18" />
                <path d="m17 17 2 2 4-4" />
              </svg>
            </div>
            <span className="font-mono text-[21px] font-black tracking-[0.18em] uppercase text-slate-900 leading-none">
              NOMAD<span className="text-blue">XE</span>
            </span>
          </Link>
          <h1 className="text-[22px] font-bold text-slate-900 tracking-tight mb-2">Deactivation & Pick-Up Request</h1>
          <p className="text-[12.5px] text-slate-500 leading-relaxed max-w-sm mx-auto">
            Submit a call-off request to schedule retrieval of your NomadXE unit. Allow a minimum of 3 business days for logistics coordination.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* Requestor Information */}
          <Section title="Requestor Information">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="d-full-name" className={LABEL}>Full Name <span className="text-red-400/80">*</span></label>
                <input id="d-full-name" name="full_name" type="text" required autoComplete="name"
                  value={fields.full_name} onChange={handleChange} placeholder="Jane Smith"
                  aria-invalid={!!errors.full_name} className={INPUT(!!errors.full_name)} />
                {errors.full_name && <p className={ERR}>{errors.full_name}</p>}
              </div>
              <div>
                <label htmlFor="d-email" className={LABEL}>Business Email <span className="text-red-400/80">*</span></label>
                <input id="d-email" name="email" type="email" required autoComplete="email"
                  value={fields.email} onChange={handleChange} placeholder="jane@company.com"
                  aria-invalid={!!errors.email} className={INPUT(!!errors.email)} />
                {errors.email && <p className={ERR}>{errors.email}</p>}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="d-company" className={LABEL}>Company <span className="text-red-400/80">*</span></label>
                <input id="d-company" name="company" type="text" required
                  value={fields.company} onChange={handleChange} placeholder="Acme Construction LLC"
                  aria-invalid={!!errors.company} className={INPUT(!!errors.company)} />
                {errors.company && <p className={ERR}>{errors.company}</p>}
              </div>
              <div>
                <label htmlFor="d-phone" className={LABEL}>Phone Number <span className="text-red-400/80">*</span></label>
                <input id="d-phone" name="phone" type="tel" required
                  value={fields.phone} onChange={handleChange} placeholder="+1 (555) 000-0000"
                  aria-invalid={!!errors.phone} className={INPUT(!!errors.phone)} />
                {errors.phone && <p className={ERR}>{errors.phone}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="d-cc" className={LABEL}>CC Recipients <span className="normal-case text-slate-400 font-normal tracking-normal">(optional)</span></label>
              <textarea id="d-cc" name="cc_emails" rows={2}
                value={fields.cc_emails} onChange={handleChange}
                placeholder="ops@company.com, manager@company.com"
                className={`${INPUT(false)} resize-none`} />
              <p className="mt-1 font-mono text-[10px] text-slate-400">Comma-separated — additional addresses to receive a copy of this request</p>
            </div>
          </Section>

          {/* Unit Identification */}
          <Section title="Unit Identification">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="d-qty" className={LABEL}>Quantity Being Returned <span className="text-red-400/80">*</span></label>
                <select id="d-qty" name="quantity" required value={fields.quantity} onChange={handleChange}
                  aria-invalid={!!errors.quantity}
                  className={`${INPUT(!!errors.quantity)} appearance-none cursor-pointer`}
                  style={SEL(fields.quantity)}>
                  <option value="" disabled>Select…</option>
                  {QUANTITIES.map(q => <option key={q} value={q} style={{ color: '#0f172a', background: '#ffffff' }}>{q}</option>)}
                </select>
                {errors.quantity && <p className={ERR}>{errors.quantity}</p>}
              </div>
              <div>
                <label htmlFor="d-unit" className={LABEL}>Unit Name / Identifier <span className="text-red-400/80">*</span></label>
                <input id="d-unit" name="unit_identifier" type="text" required
                  value={fields.unit_identifier} onChange={handleChange} placeholder="Unit Alpha"
                  aria-invalid={!!errors.unit_identifier} className={INPUT(!!errors.unit_identifier)} />
                {errors.unit_identifier && <p className={ERR}>{errors.unit_identifier}</p>}
              </div>
            </div>
          </Section>

          {/* Current Site Location */}
          <Section title="Current Site Location">
            <div>
              <label htmlFor="d-site-name" className={LABEL}>Site Name <span className="text-red-400/80">*</span></label>
              <input id="d-site-name" name="site_name" type="text" required
                value={fields.site_name} onChange={handleChange} placeholder="Eastside Yard — Phase 2"
                aria-invalid={!!errors.site_name} className={INPUT(!!errors.site_name)} />
              {errors.site_name && <p className={ERR}>{errors.site_name}</p>}
            </div>
            <div>
              <label htmlFor="d-addr" className={LABEL}>Street Address <span className="text-red-400/80">*</span></label>
              <input id="d-addr" name="street_address" type="text" required
                value={fields.street_address} onChange={handleChange} placeholder="123 Site Road"
                aria-invalid={!!errors.street_address} className={INPUT(!!errors.street_address)} />
              {errors.street_address && <p className={ERR}>{errors.street_address}</p>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label htmlFor="d-city" className={LABEL}>City <span className="text-red-400/80">*</span></label>
                <input id="d-city" name="city" type="text" required
                  value={fields.city} onChange={handleChange} placeholder="Houston"
                  aria-invalid={!!errors.city} className={INPUT(!!errors.city)} />
                {errors.city && <p className={ERR}>{errors.city}</p>}
              </div>
              <div>
                <label htmlFor="d-state" className={LABEL}>State <span className="text-red-400/80">*</span></label>
                <input id="d-state" name="state" type="text" required maxLength={2}
                  value={fields.state} onChange={handleChange} placeholder="TX"
                  aria-invalid={!!errors.state} className={INPUT(!!errors.state)} />
                {errors.state && <p className={ERR}>{errors.state}</p>}
              </div>
              <div>
                <label htmlFor="d-zip" className={LABEL}>Zip <span className="text-red-400/80">*</span></label>
                <input id="d-zip" name="zip_code" type="text" required inputMode="numeric"
                  value={fields.zip_code} onChange={handleChange} placeholder="77001"
                  aria-invalid={!!errors.zip_code} className={INPUT(!!errors.zip_code)} />
                {errors.zip_code && <p className={ERR}>{errors.zip_code}</p>}
              </div>
            </div>
          </Section>

          {/* Pick-Up Logistics */}
          <Section title="Pick-Up Logistics">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="d-pickup-date" className={LABEL}>Requested Pick-Up Date <span className="text-red-400/80">*</span></label>
                <input id="d-pickup-date" name="pickup_date" type="date" required min={today}
                  value={fields.pickup_date} onChange={handleChange}
                  aria-invalid={!!errors.pickup_date}
                  className={`${INPUT(!!errors.pickup_date)} [color-scheme:light]`} />
                {errors.pickup_date && <p className={ERR}>{errors.pickup_date}</p>}
                <p className="mt-1 font-mono text-[10px] text-slate-400">Min. 3 business days from today</p>
              </div>
              <div>
                <label htmlFor="d-pickup-window" className={LABEL}>Preferred Pick-Up Window <span className="text-red-400/80">*</span></label>
                <select id="d-pickup-window" name="pickup_window" required value={fields.pickup_window} onChange={handleChange}
                  aria-invalid={!!errors.pickup_window}
                  className={`${INPUT(!!errors.pickup_window)} appearance-none cursor-pointer`}
                  style={SEL(fields.pickup_window)}>
                  <option value="" disabled>Select…</option>
                  {PICKUP_WINDOWS.map(w => <option key={w} value={w} style={{ color: '#0f172a', background: '#ffffff' }}>{w}</option>)}
                </select>
                {errors.pickup_window && <p className={ERR}>{errors.pickup_window}</p>}
              </div>
            </div>

            {/* Primary On-Site Contact */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="d-pcontact-name" className={LABEL}>On-Site Pick-Up Contact — Name <span className="text-red-400/80">*</span></label>
                <input id="d-pcontact-name" name="pickup_contact_name" type="text" required
                  value={fields.pickup_contact_name} onChange={handleChange} placeholder="John Smith"
                  aria-invalid={!!errors.pickup_contact_name} className={INPUT(!!errors.pickup_contact_name)} />
                {errors.pickup_contact_name && <p className={ERR}>{errors.pickup_contact_name}</p>}
              </div>
              <div>
                <label htmlFor="d-pcontact-phone" className={LABEL}>On-Site Contact — Phone <span className="text-red-400/80">*</span></label>
                <input id="d-pcontact-phone" name="pickup_contact_phone" type="tel" required
                  value={fields.pickup_contact_phone} onChange={handleChange} placeholder="+1 (555) 000-0000"
                  aria-invalid={!!errors.pickup_contact_phone} className={INPUT(!!errors.pickup_contact_phone)} />
                {errors.pickup_contact_phone && <p className={ERR}>{errors.pickup_contact_phone}</p>}
              </div>
            </div>

            {/* Additional Site Contacts */}
            {additionalContacts.map((contact, idx) => (
              <div key={idx} className="relative grid sm:grid-cols-2 gap-4 pl-4 border-l-2 border-slate-200">
                <div>
                  <label className={LABEL}>Additional Contact {idx + 2} — Name <span className="text-red-400/80">*</span></label>
                  <input type="text" value={contact.name}
                    onChange={e => updateContact(idx, 'name', e.target.value)}
                    placeholder="Contact name"
                    aria-invalid={!!contactErrors[idx]?.name}
                    className={INPUT(!!contactErrors[idx]?.name)} />
                  {contactErrors[idx]?.name && <p className={ERR}>{contactErrors[idx]?.name}</p>}
                </div>
                <div>
                  <label className={LABEL}>Phone <span className="text-red-400/80">*</span></label>
                  <input type="tel" value={contact.phone}
                    onChange={e => updateContact(idx, 'phone', e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    aria-invalid={!!contactErrors[idx]?.phone}
                    className={INPUT(!!contactErrors[idx]?.phone)} />
                  {contactErrors[idx]?.phone && <p className={ERR}>{contactErrors[idx]?.phone}</p>}
                </div>
                <button type="button" onClick={() => removeContact(idx)}
                  className="absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-400 hover:border-red-300 transition-colors text-[9px] flex items-center justify-center"
                  aria-label="Remove contact">✕</button>
              </div>
            ))}
            <button type="button" onClick={addContact}
              className="flex items-center gap-2 text-[11px] font-mono text-slate-400 hover:text-slate-600 transition-colors py-1">
              <span className="w-5 h-5 rounded border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">+</span>
              Add Another On-Site Contact
            </button>

            <div>
              <label htmlFor="d-forklift" className={LABEL}>Loading Equipment Available? <span className="text-red-400/80">*</span></label>
              <select id="d-forklift" name="forklift_at_pickup" required value={fields.forklift_at_pickup} onChange={handleChange}
                aria-invalid={!!errors.forklift_at_pickup}
                className={`${INPUT(!!errors.forklift_at_pickup)} appearance-none cursor-pointer`}
                style={SEL(fields.forklift_at_pickup)}>
                <option value="" disabled>Select…</option>
                {FORKLIFT_OPTIONS.map(o => <option key={o} value={o} style={{ color: '#0f172a', background: '#ffffff' }}>{o}</option>)}
              </select>
              {errors.forklift_at_pickup && <p className={ERR}>{errors.forklift_at_pickup}</p>}
            </div>
            <div>
              <label htmlFor="d-gate" className={LABEL}>Gate Code / Access Instructions <span className="normal-case text-slate-400 font-normal tracking-normal">(optional)</span></label>
              <textarea id="d-gate" name="gate_access_instructions" rows={2}
                value={fields.gate_access_instructions} onChange={handleChange}
                placeholder="Gate code #1234, enter via North entrance, security must be notified 30 min prior…"
                className={`${INPUT(false)} resize-none`} />
            </div>
          </Section>

          {/* Deactivation Details */}
          <Section title="Deactivation Details">
            <div>
              <label htmlFor="d-reason" className={LABEL}>Reason for Return <span className="text-red-400/80">*</span></label>
              <select id="d-reason" name="return_reason" required value={fields.return_reason} onChange={handleChange}
                aria-invalid={!!errors.return_reason}
                className={`${INPUT(!!errors.return_reason)} appearance-none cursor-pointer`}
                style={SEL(fields.return_reason)}>
                <option value="" disabled>Select…</option>
                {RETURN_REASONS.map(r => <option key={r} value={r} style={{ color: '#0f172a', background: '#ffffff' }}>{r}</option>)}
              </select>
              {errors.return_reason && <p className={ERR}>{errors.return_reason}</p>}
            </div>
            <div>
              <label htmlFor="d-condition" className={LABEL}>Equipment Condition at Call-Off <span className="text-red-400/80">*</span></label>
              <select id="d-condition" name="equipment_condition" required value={fields.equipment_condition} onChange={handleChange}
                aria-invalid={!!errors.equipment_condition}
                className={`${INPUT(!!errors.equipment_condition)} appearance-none cursor-pointer`}
                style={SEL(fields.equipment_condition)}>
                <option value="" disabled>Select…</option>
                {CONDITION_OPTIONS.map(c => <option key={c} value={c} style={{ color: '#0f172a', background: '#ffffff' }}>{c}</option>)}
              </select>
              {errors.equipment_condition && <p className={ERR}>{errors.equipment_condition}</p>}
            </div>
            {(needsDamageNote || needsPoliceReport) && (
              <div className="p-4 bg-amber-950/20 border border-amber-500/25 rounded-xl space-y-3">
                <p className="text-[11px] text-amber-400/80 font-mono">
                  {needsPoliceReport
                    ? 'A police report number is required for theft or vandalism incidents. NomadXE may request a copy for insurance purposes.'
                    : 'Please describe the damage in detail. Our team will assess upon retrieval.'}
                </p>
                {needsDamageNote && (
                  <div>
                    <label htmlFor="d-condition-notes" className={LABEL}>Damage Description <span className="text-red-400/80">*</span></label>
                    <textarea id="d-condition-notes" name="condition_notes" rows={3} required
                      value={fields.condition_notes} onChange={handleChange}
                      placeholder="Describe the nature and location of the damage…"
                      aria-invalid={!!errors.condition_notes}
                      className={`${INPUT(!!errors.condition_notes)} resize-none`} />
                    {errors.condition_notes && <p className={ERR}>{errors.condition_notes}</p>}
                  </div>
                )}
                {needsPoliceReport && (
                  <div>
                    <label htmlFor="d-police" className={LABEL}>Police Report Number <span className="text-red-400/80">*</span></label>
                    <input id="d-police" name="police_report_number" type="text" required
                      value={fields.police_report_number} onChange={handleChange} placeholder="e.g. 2024-HPD-012345"
                      aria-invalid={!!errors.police_report_number} className={INPUT(!!errors.police_report_number)} />
                    {errors.police_report_number && <p className={ERR}>{errors.police_report_number}</p>}
                  </div>
                )}
              </div>
            )}
            <div className="sm:w-1/2 sm:pr-2">
              <label htmlFor="d-last-use" className={LABEL}>Last Date of Active Use <span className="text-red-400/80">*</span></label>
              <input id="d-last-use" name="last_use_date" type="date" required max={today}
                value={fields.last_use_date} onChange={handleChange}
                aria-invalid={!!errors.last_use_date}
                className={`${INPUT(!!errors.last_use_date)} [color-scheme:light]`} />
              {errors.last_use_date && <p className={ERR}>{errors.last_use_date}</p>}
              <p className="mt-1 font-mono text-[10px] text-slate-400">Used to calculate prorated billing</p>
            </div>
            <div>
              <label htmlFor="d-notes" className={LABEL}>Additional Notes</label>
              <textarea id="d-notes" name="notes" rows={3}
                value={fields.notes} onChange={handleChange}
                placeholder="Any other details our logistics team should know…"
                className={`${INPUT(false)} resize-none`} />
            </div>
          </Section>

          {formState === 'error' && serverError && (
            <div role="alert" className="rounded-2xl bg-red-950/25 border border-red-500/35 px-5 py-4 text-[12.5px] text-red-400 leading-relaxed">
              {serverError}
            </div>
          )}

          <button type="submit" disabled={isSubmitting}
            className="w-full mt-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm tracking-wide transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2.5">
            {isSubmitting ? (
              <><span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />Submitting…</>
            ) : 'Submit Pick-Up Request →'}
          </button>

          <p className="text-center text-[10px] text-slate-400 font-mono uppercase tracking-[0.15em] pb-4">
            Secure · Confidential · NomadXE
          </p>
        </form>
      </div>
    </div>
  );
}
