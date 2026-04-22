'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

const SITE_TYPES = ['Construction Site','Events & Temporary Venue','Asset Yard / Logistics','Industrial Facility','Remote / Off-Grid Site','Other'];
const RELOCATION_REASONS = ['Project Phase Change','Site Consolidation','Contract Transfer / New Customer','Temporary Repositioning','Client Request','Other'];
const MOVE_WINDOWS = ['Morning (7am – 12pm)','Afternoon (12pm – 5pm)','Flexible — Any Time'];
const FORKLIFT_OPTIONS = ['Yes — Forklift On-Site','No — NomadXE Will Need to Arrange Equipment'];
const QUANTITIES = ['1','2','3','4+'];
const YES_NO = ['Yes','No'];

const LABEL = 'block text-[10.5px] font-semibold text-[#93c5fd]/55 uppercase tracking-[0.12em] mb-1.5';
const INPUT = (err: boolean) =>
  `w-full bg-[#080c14] border rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#93c5fd]/18 outline-none transition-all duration-200 focus:ring-2 ${
    err
      ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/15'
      : 'border-[#1e3a5f] focus:border-[#3b82f6] focus:ring-[#3b82f6]/20'
  }`;
const ERR = 'mt-1 text-[11px] text-red-400 font-mono';
const SEL = (val: string) => ({ color: val ? 'white' : 'rgba(147,197,253,0.18)' });

type FormState = 'idle' | 'submitting' | 'success' | 'error';
interface SiteContact { name: string; phone: string; }
type ContactErr = { name?: string; phone?: string };

interface Fields {
  full_name: string; email: string; company: string; phone: string;
  cc_emails: string;
  unit_identifier: string; quantity: string;
  origin_site_name: string; origin_street: string; origin_city: string; origin_state: string; origin_zip: string;
  origin_contact_name: string; origin_contact_phone: string;
  forklift_at_origin: string; origin_gate_instructions: string;
  dest_site_name: string; dest_site_type: string;
  dest_street: string; dest_city: string; dest_state: string; dest_zip: string;
  dest_gps_lat: string; dest_gps_lng: string;
  dest_contact_name: string; dest_contact_phone: string;
  forklift_at_dest: string; dest_gate_instructions: string;
  move_date: string; move_window: string;
  recommission_at_dest: string; relocation_reason: string;
  notes: string;
}

type FE = Partial<Record<keyof Fields, string>>;

const INIT: Fields = {
  full_name:'', email:'', company:'', phone:'',
  cc_emails:'',
  unit_identifier:'', quantity:'',
  origin_site_name:'', origin_street:'', origin_city:'', origin_state:'', origin_zip:'',
  origin_contact_name:'', origin_contact_phone:'',
  forklift_at_origin:'', origin_gate_instructions:'',
  dest_site_name:'', dest_site_type:'',
  dest_street:'', dest_city:'', dest_state:'', dest_zip:'',
  dest_gps_lat:'', dest_gps_lng:'',
  dest_contact_name:'', dest_contact_phone:'',
  forklift_at_dest:'', dest_gate_instructions:'',
  move_date:'', move_window:'',
  recommission_at_dest:'', relocation_reason:'',
  notes:'',
};

function validateLat(v: string) { const n = parseFloat(v); return !isNaN(n) && n >= -90 && n <= 90; }
function validateLng(v: string) { const n = parseFloat(v); return !isNaN(n) && n >= -180 && n <= 180; }

function validate(f: Fields): FE {
  const e: FE = {};
  if (!f.full_name.trim()) e.full_name = 'Required';
  if (!f.email.trim()) { e.email = 'Required'; }
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = 'Invalid email';
  if (!f.company.trim()) e.company = 'Required';
  if (!f.phone.trim()) e.phone = 'Required';
  if (!f.unit_identifier.trim()) e.unit_identifier = 'Required';
  if (!f.quantity) e.quantity = 'Required';
  if (!f.origin_site_name.trim()) e.origin_site_name = 'Required';
  if (!f.origin_street.trim()) e.origin_street = 'Required';
  if (!f.origin_city.trim()) e.origin_city = 'Required';
  if (!f.origin_state.trim()) e.origin_state = 'Required';
  if (!f.origin_zip.trim()) e.origin_zip = 'Required';
  if (!f.origin_contact_name.trim()) e.origin_contact_name = 'Required';
  if (!f.origin_contact_phone.trim()) e.origin_contact_phone = 'Required';
  if (!f.forklift_at_origin) e.forklift_at_origin = 'Required';
  if (!f.dest_site_name.trim()) e.dest_site_name = 'Required';
  if (!f.dest_site_type) e.dest_site_type = 'Required';
  if (!f.dest_street.trim()) e.dest_street = 'Required';
  if (!f.dest_city.trim()) e.dest_city = 'Required';
  if (!f.dest_state.trim()) e.dest_state = 'Required';
  if (!f.dest_zip.trim()) e.dest_zip = 'Required';
  if (!f.dest_contact_name.trim()) e.dest_contact_name = 'Required';
  if (!f.dest_contact_phone.trim()) e.dest_contact_phone = 'Required';
  if (!f.forklift_at_dest) e.forklift_at_dest = 'Required';
  if (f.dest_gps_lat.trim() && !validateLat(f.dest_gps_lat)) e.dest_gps_lat = 'Decimal degrees, -90 to 90';
  if (f.dest_gps_lng.trim() && !validateLng(f.dest_gps_lng)) e.dest_gps_lng = 'Decimal degrees, -180 to 180';
  if (!f.move_date) e.move_date = 'Required';
  if (!f.move_window) e.move_window = 'Required';
  if (!f.recommission_at_dest) e.recommission_at_dest = 'Required';
  if (!f.relocation_reason) e.relocation_reason = 'Required';
  return e;
}

function SectionGold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0d1526] border border-[#1e3a5f]/80 rounded-2xl overflow-hidden">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#f59e0b]/20 to-transparent" />
      <div className="px-6 py-5 border-b border-[#1e3a5f]/50">
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#f59e0b]/60">{title}</span>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

function SectionBlue({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0d1526] border border-[#1e3a5f]/80 rounded-2xl overflow-hidden">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#3b82f6]/25 to-transparent" />
      <div className="px-6 py-5 border-b border-[#1e3a5f]/50">
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#3b82f6]/60">{title}</span>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

function AdditionalContacts({
  contacts, contactErrors, onAdd, onRemove, onUpdate, accentColor,
}: {
  contacts: SiteContact[];
  contactErrors: ContactErr[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, field: 'name' | 'phone', value: string) => void;
  accentColor: string;
}) {
  return (
    <>
      {contacts.map((contact, idx) => (
        <div key={idx} className="relative grid sm:grid-cols-2 gap-4 pl-4 border-l-2 border-[#1e3a5f]/50">
          <div>
            <label className={`${LABEL}`}>Additional Contact {idx + 2} — Name <span className="text-red-400/80">*</span></label>
            <input type="text" value={contact.name}
              onChange={e => onUpdate(idx, 'name', e.target.value)}
              placeholder="Contact name"
              aria-invalid={!!contactErrors[idx]?.name}
              className={INPUT(!!contactErrors[idx]?.name)} />
            {contactErrors[idx]?.name && <p className={ERR}>{contactErrors[idx]?.name}</p>}
          </div>
          <div>
            <label className={`${LABEL}`}>Phone <span className="text-red-400/80">*</span></label>
            <input type="tel" value={contact.phone}
              onChange={e => onUpdate(idx, 'phone', e.target.value)}
              placeholder="+1 (555) 000-0000"
              aria-invalid={!!contactErrors[idx]?.phone}
              className={INPUT(!!contactErrors[idx]?.phone)} />
            {contactErrors[idx]?.phone && <p className={ERR}>{contactErrors[idx]?.phone}</p>}
          </div>
          <button type="button" onClick={() => onRemove(idx)}
            className="absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#0d1526] border border-[#1e3a5f] text-[#93c5fd]/30 hover:text-red-400 hover:border-red-500/30 transition-colors text-[9px] flex items-center justify-center"
            aria-label="Remove contact">✕</button>
        </div>
      ))}
      <button type="button" onClick={onAdd}
        className="flex items-center gap-2 text-[11px] font-mono text-[#93c5fd]/35 hover:text-[#93c5fd]/70 transition-colors py-1">
        <span className="w-5 h-5 rounded border border-[#1e3a5f] flex items-center justify-center text-[10px] text-[#93c5fd]/40">+</span>
        Add Another On-Site Contact
      </button>
    </>
  );
}

export default function RelocateFormClient() {
  const [formState, setFormState] = useState<FormState>('idle');
  const [fields, setFields] = useState<Fields>(INIT);
  const [errors, setErrors] = useState<FE>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [originContacts, setOriginContacts] = useState<SiteContact[]>([]);
  const [originContactErrors, setOriginContactErrors] = useState<ContactErr[]>([]);
  const [destContacts, setDestContacts] = useState<SiteContact[]>([]);
  const [destContactErrors, setDestContactErrors] = useState<ContactErr[]>([]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFields(p => ({ ...p, [name]: value }));
      if (errors[name as keyof FE]) setErrors(p => ({ ...p, [name]: undefined }));
    }, [errors]
  );

  // Origin contact helpers
  const addOriginContact = () => setOriginContacts(p => [...p, { name: '', phone: '' }]);
  const removeOriginContact = (idx: number) => {
    setOriginContacts(p => p.filter((_, i) => i !== idx));
    setOriginContactErrors(p => p.filter((_, i) => i !== idx));
  };
  const updateOriginContact = (idx: number, field: 'name' | 'phone', value: string) => {
    setOriginContacts(p => p.map((c, i) => i === idx ? { ...c, [field]: value } : c));
    if (originContactErrors[idx]?.[field]) setOriginContactErrors(p => p.map((ce, i) => i === idx ? { ...ce, [field]: undefined } : ce));
  };

  // Destination contact helpers
  const addDestContact = () => setDestContacts(p => [...p, { name: '', phone: '' }]);
  const removeDestContact = (idx: number) => {
    setDestContacts(p => p.filter((_, i) => i !== idx));
    setDestContactErrors(p => p.filter((_, i) => i !== idx));
  };
  const updateDestContact = (idx: number, field: 'name' | 'phone', value: string) => {
    setDestContacts(p => p.map((c, i) => i === idx ? { ...c, [field]: value } : c));
    if (destContactErrors[idx]?.[field]) setDestContactErrors(p => p.map((ce, i) => i === idx ? { ...ce, [field]: undefined } : ce));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const oCErrs: ContactErr[] = originContacts.map(c => ({
      name: !c.name.trim() ? 'Required' : undefined,
      phone: !c.phone.trim() ? 'Required' : undefined,
    }));
    const dCErrs: ContactErr[] = destContacts.map(c => ({
      name: !c.name.trim() ? 'Required' : undefined,
      phone: !c.phone.trim() ? 'Required' : undefined,
    }));
    setOriginContactErrors(oCErrs);
    setDestContactErrors(dCErrs);
    const hasContactErrors = oCErrs.some(c => c.name || c.phone) || dCErrs.some(c => c.name || c.phone);

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
      const res = await fetch('/api/relocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          full_name: fields.full_name.trim(),
          email: fields.email.trim().toLowerCase(),
          company: fields.company.trim(),
          additional_origin_contacts: originContacts.filter(c => c.name.trim() || c.phone.trim()),
          additional_dest_contacts: destContacts.filter(c => c.name.trim() || c.phone.trim()),
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

  function handleReset() {
    setFormState('idle'); setFields(INIT); setErrors({}); setServerError(null);
    setOriginContacts([]); setOriginContactErrors([]);
    setDestContacts([]); setDestContactErrors([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (formState === 'success') {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
          style={{ backgroundImage: 'radial-gradient(circle, #f59e0b 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#78350f] via-[#f59e0b] to-[#78350f] z-[100]" />
        <div className="relative z-10 w-full max-w-lg text-center space-y-8">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-[#78350f]/20 border border-[#f59e0b]/30 flex items-center justify-center">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="absolute inset-0 rounded-full border border-[#f59e0b]/20 animate-ping" style={{ animationDuration: '2.5s' }} />
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-[#78350f]/15 border border-[#f59e0b]/25 rounded-full px-5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#f59e0b]/80">Relocation Request Received</span>
          </div>
          <div><span className="font-mono text-2xl font-black tracking-[0.18em] uppercase text-white">NOMAD<span className="text-[#3b82f6]">XE</span></span></div>
          <div className="bg-[#0d1526] border border-[#1e3a5f]/80 rounded-2xl overflow-hidden">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#f59e0b]/25 to-transparent" />
            <div className="px-8 py-8 space-y-4">
              <h1 className="text-xl font-bold text-white">Move Request in Queue</h1>
              <p className="text-[13.5px] text-[#93c5fd]/60 leading-relaxed">
                Your relocation request has been received. Our logistics team will coordinate with both site contacts to confirm the transfer schedule within 1–2 business days.
              </p>
            </div>
          </div>
          <div className="bg-[#0d1526] border border-[#1e3a5f]/80 rounded-2xl overflow-hidden text-left">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#f59e0b]/25 to-transparent" />
            <div className="px-6 py-4 border-b border-[#1e3a5f]/50">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#f59e0b]/60">Summary</span>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                { label: 'Unit', value: fields.unit_identifier },
                { label: 'Quantity', value: fields.quantity },
                { label: 'From', value: fields.origin_site_name },
                { label: 'To', value: fields.dest_site_name },
                { label: 'Move Date', value: fields.move_date ? new Date(fields.move_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '' },
                { label: 'Re-Commission', value: fields.recommission_at_dest },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-[#93c5fd]/30 mb-0.5">{label}</p>
                  <p className="text-[13px] text-white/80">{value || '—'}</p>
                </div>
              ))}
            </div>
          </div>
          <button onClick={handleReset} className="w-full bg-[#d97706] hover:bg-[#f59e0b] text-white font-bold py-3.5 rounded-xl text-sm tracking-wide transition-all duration-200 active:scale-[0.98]">
            Submit Another Request
          </button>
          <Link href="/" className="block text-[11px] text-[#93c5fd]/35 hover:text-[#93c5fd]/70 transition-colors font-mono uppercase tracking-[0.15em]">
            Back to NomadXE.com
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] relative overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{ backgroundImage: 'radial-gradient(circle, #f59e0b 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#78350f] via-[#f59e0b] to-[#78350f] z-[100]" />

      <div className="relative z-10 max-w-2xl mx-auto px-5 py-16 sm:py-20">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex flex-col items-center gap-3 group mb-8">
            <div className="w-11 h-11 rounded-xl bg-[#78350f]/20 border border-[#f59e0b]/20 flex items-center justify-center group-hover:border-[#f59e0b]/50 transition-all duration-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <span className="font-mono text-[21px] font-black tracking-[0.18em] uppercase text-white leading-none">
              NOMAD<span className="text-[#3b82f6]">XE</span>
            </span>
          </Link>
          <h1 className="text-[22px] font-bold text-white tracking-tight mb-2">Trailer Relocation Request</h1>
          <p className="text-[12.5px] text-[#93c5fd]/40 leading-relaxed max-w-sm mx-auto">
            Request a site-to-site transfer of your NomadXE unit. Our logistics team will coordinate pickup and delivery with both site contacts.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* Requestor */}
          <SectionBlue title="Requestor Information">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="r-full-name" className={LABEL}>Full Name <span className="text-red-400/80">*</span></label>
                <input id="r-full-name" name="full_name" type="text" required autoComplete="name"
                  value={fields.full_name} onChange={handleChange} placeholder="Jane Smith"
                  aria-invalid={!!errors.full_name} className={INPUT(!!errors.full_name)} />
                {errors.full_name && <p className={ERR}>{errors.full_name}</p>}
              </div>
              <div>
                <label htmlFor="r-email" className={LABEL}>Business Email <span className="text-red-400/80">*</span></label>
                <input id="r-email" name="email" type="email" required autoComplete="email"
                  value={fields.email} onChange={handleChange} placeholder="jane@company.com"
                  aria-invalid={!!errors.email} className={INPUT(!!errors.email)} />
                {errors.email && <p className={ERR}>{errors.email}</p>}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="r-company" className={LABEL}>Company <span className="text-red-400/80">*</span></label>
                <input id="r-company" name="company" type="text" required
                  value={fields.company} onChange={handleChange} placeholder="Acme Construction LLC"
                  aria-invalid={!!errors.company} className={INPUT(!!errors.company)} />
                {errors.company && <p className={ERR}>{errors.company}</p>}
              </div>
              <div>
                <label htmlFor="r-phone" className={LABEL}>Phone Number <span className="text-red-400/80">*</span></label>
                <input id="r-phone" name="phone" type="tel" required
                  value={fields.phone} onChange={handleChange} placeholder="+1 (555) 000-0000"
                  aria-invalid={!!errors.phone} className={INPUT(!!errors.phone)} />
                {errors.phone && <p className={ERR}>{errors.phone}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="r-cc" className={LABEL}>CC Recipients <span className="normal-case text-[#93c5fd]/40 font-normal tracking-normal">(optional)</span></label>
              <textarea id="r-cc" name="cc_emails" rows={2}
                value={fields.cc_emails} onChange={handleChange}
                placeholder="ops@company.com, manager@company.com"
                className={`${INPUT(false)} resize-none`} />
              <p className="mt-1 font-mono text-[10px] text-[#93c5fd]/22">Comma-separated — additional addresses to receive a copy of this request</p>
            </div>
          </SectionBlue>

          {/* Unit ID */}
          <SectionBlue title="Unit Identification">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="r-unit" className={LABEL}>Unit Name / Identifier <span className="text-red-400/80">*</span></label>
                <input id="r-unit" name="unit_identifier" type="text" required
                  value={fields.unit_identifier} onChange={handleChange} placeholder="Unit Alpha"
                  aria-invalid={!!errors.unit_identifier} className={INPUT(!!errors.unit_identifier)} />
                {errors.unit_identifier && <p className={ERR}>{errors.unit_identifier}</p>}
              </div>
              <div>
                <label htmlFor="r-qty" className={LABEL}>Quantity Being Relocated <span className="text-red-400/80">*</span></label>
                <select id="r-qty" name="quantity" required value={fields.quantity} onChange={handleChange}
                  aria-invalid={!!errors.quantity}
                  className={`${INPUT(!!errors.quantity)} appearance-none cursor-pointer`}
                  style={SEL(fields.quantity)}>
                  <option value="" disabled>Select…</option>
                  {QUANTITIES.map(q => <option key={q} value={q} style={{ color: 'white', background: '#080c14' }}>{q}</option>)}
                </select>
                {errors.quantity && <p className={ERR}>{errors.quantity}</p>}
              </div>
            </div>
          </SectionBlue>

          {/* Origin Site */}
          <SectionGold title="Origin Site — Current Location">
            <div>
              <label htmlFor="r-o-site" className={LABEL}>Site Name <span className="text-red-400/80">*</span></label>
              <input id="r-o-site" name="origin_site_name" type="text" required
                value={fields.origin_site_name} onChange={handleChange} placeholder="Eastside Yard — Phase 2"
                aria-invalid={!!errors.origin_site_name} className={INPUT(!!errors.origin_site_name)} />
              {errors.origin_site_name && <p className={ERR}>{errors.origin_site_name}</p>}
            </div>
            <div>
              <label htmlFor="r-o-addr" className={LABEL}>Street Address <span className="text-red-400/80">*</span></label>
              <input id="r-o-addr" name="origin_street" type="text" required
                value={fields.origin_street} onChange={handleChange} placeholder="123 Site Road"
                aria-invalid={!!errors.origin_street} className={INPUT(!!errors.origin_street)} />
              {errors.origin_street && <p className={ERR}>{errors.origin_street}</p>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label htmlFor="r-o-city" className={LABEL}>City <span className="text-red-400/80">*</span></label>
                <input id="r-o-city" name="origin_city" type="text" required
                  value={fields.origin_city} onChange={handleChange} placeholder="Houston"
                  aria-invalid={!!errors.origin_city} className={INPUT(!!errors.origin_city)} />
                {errors.origin_city && <p className={ERR}>{errors.origin_city}</p>}
              </div>
              <div>
                <label htmlFor="r-o-state" className={LABEL}>State <span className="text-red-400/80">*</span></label>
                <input id="r-o-state" name="origin_state" type="text" required maxLength={2}
                  value={fields.origin_state} onChange={handleChange} placeholder="TX"
                  aria-invalid={!!errors.origin_state} className={INPUT(!!errors.origin_state)} />
                {errors.origin_state && <p className={ERR}>{errors.origin_state}</p>}
              </div>
              <div>
                <label htmlFor="r-o-zip" className={LABEL}>Zip <span className="text-red-400/80">*</span></label>
                <input id="r-o-zip" name="origin_zip" type="text" required inputMode="numeric"
                  value={fields.origin_zip} onChange={handleChange} placeholder="77001"
                  aria-invalid={!!errors.origin_zip} className={INPUT(!!errors.origin_zip)} />
                {errors.origin_zip && <p className={ERR}>{errors.origin_zip}</p>}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="r-o-contact-name" className={LABEL}>On-Site Contact — Name <span className="text-red-400/80">*</span></label>
                <input id="r-o-contact-name" name="origin_contact_name" type="text" required
                  value={fields.origin_contact_name} onChange={handleChange} placeholder="John Smith"
                  aria-invalid={!!errors.origin_contact_name} className={INPUT(!!errors.origin_contact_name)} />
                {errors.origin_contact_name && <p className={ERR}>{errors.origin_contact_name}</p>}
              </div>
              <div>
                <label htmlFor="r-o-contact-phone" className={LABEL}>On-Site Contact — Phone <span className="text-red-400/80">*</span></label>
                <input id="r-o-contact-phone" name="origin_contact_phone" type="tel" required
                  value={fields.origin_contact_phone} onChange={handleChange} placeholder="+1 (555) 000-0000"
                  aria-invalid={!!errors.origin_contact_phone} className={INPUT(!!errors.origin_contact_phone)} />
                {errors.origin_contact_phone && <p className={ERR}>{errors.origin_contact_phone}</p>}
              </div>
            </div>
            <AdditionalContacts
              contacts={originContacts} contactErrors={originContactErrors}
              onAdd={addOriginContact} onRemove={removeOriginContact} onUpdate={updateOriginContact}
              accentColor="#f59e0b" />
            <div>
              <label htmlFor="r-o-forklift" className={LABEL}>Forklift Available at Origin? <span className="text-red-400/80">*</span></label>
              <select id="r-o-forklift" name="forklift_at_origin" required value={fields.forklift_at_origin} onChange={handleChange}
                aria-invalid={!!errors.forklift_at_origin}
                className={`${INPUT(!!errors.forklift_at_origin)} appearance-none cursor-pointer`}
                style={SEL(fields.forklift_at_origin)}>
                <option value="" disabled>Select…</option>
                {FORKLIFT_OPTIONS.map(o => <option key={o} value={o} style={{ color: 'white', background: '#080c14' }}>{o}</option>)}
              </select>
              {errors.forklift_at_origin && <p className={ERR}>{errors.forklift_at_origin}</p>}
            </div>
            <div>
              <label htmlFor="r-o-gate" className={LABEL}>Gate / Access Instructions <span className="normal-case text-[#93c5fd]/40 font-normal tracking-normal">(optional)</span></label>
              <textarea id="r-o-gate" name="origin_gate_instructions" rows={2}
                value={fields.origin_gate_instructions} onChange={handleChange}
                placeholder="Gate code, entry restrictions, security contact…"
                className={`${INPUT(false)} resize-none`} />
            </div>
          </SectionGold>

          {/* Destination Site */}
          <SectionBlue title="Destination Site — New Location">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="r-d-site" className={LABEL}>Site Name <span className="text-red-400/80">*</span></label>
                <input id="r-d-site" name="dest_site_name" type="text" required
                  value={fields.dest_site_name} onChange={handleChange} placeholder="Westside Compound — Phase 1"
                  aria-invalid={!!errors.dest_site_name} className={INPUT(!!errors.dest_site_name)} />
                {errors.dest_site_name && <p className={ERR}>{errors.dest_site_name}</p>}
              </div>
              <div>
                <label htmlFor="r-d-type" className={LABEL}>Site Type <span className="text-red-400/80">*</span></label>
                <select id="r-d-type" name="dest_site_type" required value={fields.dest_site_type} onChange={handleChange}
                  aria-invalid={!!errors.dest_site_type}
                  className={`${INPUT(!!errors.dest_site_type)} appearance-none cursor-pointer`}
                  style={SEL(fields.dest_site_type)}>
                  <option value="" disabled>Select type…</option>
                  {SITE_TYPES.map(t => <option key={t} value={t} style={{ color: 'white', background: '#080c14' }}>{t}</option>)}
                </select>
                {errors.dest_site_type && <p className={ERR}>{errors.dest_site_type}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="r-d-addr" className={LABEL}>Street Address <span className="text-red-400/80">*</span></label>
              <input id="r-d-addr" name="dest_street" type="text" required
                value={fields.dest_street} onChange={handleChange} placeholder="456 New Site Ave"
                aria-invalid={!!errors.dest_street} className={INPUT(!!errors.dest_street)} />
              {errors.dest_street && <p className={ERR}>{errors.dest_street}</p>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label htmlFor="r-d-city" className={LABEL}>City <span className="text-red-400/80">*</span></label>
                <input id="r-d-city" name="dest_city" type="text" required
                  value={fields.dest_city} onChange={handleChange} placeholder="Dallas"
                  aria-invalid={!!errors.dest_city} className={INPUT(!!errors.dest_city)} />
                {errors.dest_city && <p className={ERR}>{errors.dest_city}</p>}
              </div>
              <div>
                <label htmlFor="r-d-state" className={LABEL}>State <span className="text-red-400/80">*</span></label>
                <input id="r-d-state" name="dest_state" type="text" required maxLength={2}
                  value={fields.dest_state} onChange={handleChange} placeholder="TX"
                  aria-invalid={!!errors.dest_state} className={INPUT(!!errors.dest_state)} />
                {errors.dest_state && <p className={ERR}>{errors.dest_state}</p>}
              </div>
              <div>
                <label htmlFor="r-d-zip" className={LABEL}>Zip <span className="text-red-400/80">*</span></label>
                <input id="r-d-zip" name="dest_zip" type="text" required inputMode="numeric"
                  value={fields.dest_zip} onChange={handleChange} placeholder="75201"
                  aria-invalid={!!errors.dest_zip} className={INPUT(!!errors.dest_zip)} />
                {errors.dest_zip && <p className={ERR}>{errors.dest_zip}</p>}
              </div>
            </div>
            <div>
              <p className={`${LABEL} mb-0.5`}>GPS Coordinates <span className="normal-case text-[#93c5fd]/40 font-normal tracking-normal">(optional)</span></p>
              <p className="font-mono text-[10.5px] text-[#93c5fd]/25 mb-3">Helps logistics pre-plot the delivery route</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="r-d-lat" className={LABEL}>Latitude</label>
                  <input id="r-d-lat" name="dest_gps_lat" type="text" inputMode="decimal"
                    value={fields.dest_gps_lat} onChange={handleChange} placeholder="32.7767"
                    aria-invalid={!!errors.dest_gps_lat} className={INPUT(!!errors.dest_gps_lat)} />
                  {errors.dest_gps_lat && <p className={ERR}>{errors.dest_gps_lat}</p>}
                </div>
                <div>
                  <label htmlFor="r-d-lng" className={LABEL}>Longitude</label>
                  <input id="r-d-lng" name="dest_gps_lng" type="text" inputMode="decimal"
                    value={fields.dest_gps_lng} onChange={handleChange} placeholder="-96.7970"
                    aria-invalid={!!errors.dest_gps_lng} className={INPUT(!!errors.dest_gps_lng)} />
                  {errors.dest_gps_lng && <p className={ERR}>{errors.dest_gps_lng}</p>}
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="r-d-contact-name" className={LABEL}>On-Site Contact — Name <span className="text-red-400/80">*</span></label>
                <input id="r-d-contact-name" name="dest_contact_name" type="text" required
                  value={fields.dest_contact_name} onChange={handleChange} placeholder="Maria Garcia"
                  aria-invalid={!!errors.dest_contact_name} className={INPUT(!!errors.dest_contact_name)} />
                {errors.dest_contact_name && <p className={ERR}>{errors.dest_contact_name}</p>}
              </div>
              <div>
                <label htmlFor="r-d-contact-phone" className={LABEL}>On-Site Contact — Phone <span className="text-red-400/80">*</span></label>
                <input id="r-d-contact-phone" name="dest_contact_phone" type="tel" required
                  value={fields.dest_contact_phone} onChange={handleChange} placeholder="+1 (555) 000-0000"
                  aria-invalid={!!errors.dest_contact_phone} className={INPUT(!!errors.dest_contact_phone)} />
                {errors.dest_contact_phone && <p className={ERR}>{errors.dest_contact_phone}</p>}
              </div>
            </div>
            <AdditionalContacts
              contacts={destContacts} contactErrors={destContactErrors}
              onAdd={addDestContact} onRemove={removeDestContact} onUpdate={updateDestContact}
              accentColor="#3b82f6" />
            <div>
              <label htmlFor="r-d-forklift" className={LABEL}>Forklift Available at Destination? <span className="text-red-400/80">*</span></label>
              <select id="r-d-forklift" name="forklift_at_dest" required value={fields.forklift_at_dest} onChange={handleChange}
                aria-invalid={!!errors.forklift_at_dest}
                className={`${INPUT(!!errors.forklift_at_dest)} appearance-none cursor-pointer`}
                style={SEL(fields.forklift_at_dest)}>
                <option value="" disabled>Select…</option>
                {FORKLIFT_OPTIONS.map(o => <option key={o} value={o} style={{ color: 'white', background: '#080c14' }}>{o}</option>)}
              </select>
              {errors.forklift_at_dest && <p className={ERR}>{errors.forklift_at_dest}</p>}
            </div>
            <div>
              <label htmlFor="r-d-gate" className={LABEL}>Gate / Access Instructions <span className="normal-case text-[#93c5fd]/40 font-normal tracking-normal">(optional)</span></label>
              <textarea id="r-d-gate" name="dest_gate_instructions" rows={2}
                value={fields.dest_gate_instructions} onChange={handleChange}
                placeholder="Gate code, dock number, delivery hours, security contact…"
                className={`${INPUT(false)} resize-none`} />
            </div>
          </SectionBlue>

          {/* Move Details */}
          <SectionGold title="Move Details">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="r-move-date" className={LABEL}>Requested Move Date <span className="text-red-400/80">*</span></label>
                <input id="r-move-date" name="move_date" type="date" required min={today}
                  value={fields.move_date} onChange={handleChange}
                  aria-invalid={!!errors.move_date}
                  className={`${INPUT(!!errors.move_date)} [color-scheme:dark]`} />
                {errors.move_date && <p className={ERR}>{errors.move_date}</p>}
                <p className="mt-1 font-mono text-[10px] text-[#93c5fd]/22">Min. 3 business days for logistics coordination</p>
              </div>
              <div>
                <label htmlFor="r-move-window" className={LABEL}>Preferred Move Window <span className="text-red-400/80">*</span></label>
                <select id="r-move-window" name="move_window" required value={fields.move_window} onChange={handleChange}
                  aria-invalid={!!errors.move_window}
                  className={`${INPUT(!!errors.move_window)} appearance-none cursor-pointer`}
                  style={SEL(fields.move_window)}>
                  <option value="" disabled>Select…</option>
                  {MOVE_WINDOWS.map(w => <option key={w} value={w} style={{ color: 'white', background: '#080c14' }}>{w}</option>)}
                </select>
                {errors.move_window && <p className={ERR}>{errors.move_window}</p>}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="r-recommission" className={LABEL}>Technician Re-Commissioning at Destination? <span className="text-red-400/80">*</span></label>
                <select id="r-recommission" name="recommission_at_dest" required value={fields.recommission_at_dest} onChange={handleChange}
                  aria-invalid={!!errors.recommission_at_dest}
                  className={`${INPUT(!!errors.recommission_at_dest)} appearance-none cursor-pointer`}
                  style={SEL(fields.recommission_at_dest)}>
                  <option value="" disabled>Select…</option>
                  {YES_NO.map(v => <option key={v} value={v} style={{ color: 'white', background: '#080c14' }}>{v}</option>)}
                </select>
                {errors.recommission_at_dest && <p className={ERR}>{errors.recommission_at_dest}</p>}
              </div>
              <div>
                <label htmlFor="r-reason" className={LABEL}>Reason for Relocation <span className="text-red-400/80">*</span></label>
                <select id="r-reason" name="relocation_reason" required value={fields.relocation_reason} onChange={handleChange}
                  aria-invalid={!!errors.relocation_reason}
                  className={`${INPUT(!!errors.relocation_reason)} appearance-none cursor-pointer`}
                  style={SEL(fields.relocation_reason)}>
                  <option value="" disabled>Select…</option>
                  {RELOCATION_REASONS.map(r => <option key={r} value={r} style={{ color: 'white', background: '#080c14' }}>{r}</option>)}
                </select>
                {errors.relocation_reason && <p className={ERR}>{errors.relocation_reason}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="r-notes" className={LABEL}>Additional Notes</label>
              <textarea id="r-notes" name="notes" rows={3}
                value={fields.notes} onChange={handleChange}
                placeholder="Any special transport requirements, timing constraints, or operational notes…"
                className={`${INPUT(false)} resize-none`} />
            </div>
          </SectionGold>

          {formState === 'error' && serverError && (
            <div role="alert" className="rounded-2xl bg-red-950/25 border border-red-500/35 px-5 py-4 text-[12.5px] text-red-400 leading-relaxed">
              {serverError}
            </div>
          )}

          <button type="submit" disabled={isSubmitting}
            className="w-full mt-2 bg-[#d97706] hover:bg-[#f59e0b] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm tracking-wide transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2.5">
            {isSubmitting ? (
              <><span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />Submitting…</>
            ) : 'Submit Relocation Request →'}
          </button>

          <p className="text-center text-[10px] text-[#93c5fd]/20 font-mono uppercase tracking-[0.15em] pb-4">
            Secure · Confidential · NomadXE
          </p>
        </form>
      </div>
    </div>
  );
}
