'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';

// ── Helpers ──────────────────────────────────────────────────────────────────

function n(v: string, fallback = 0): number {
  const p = parseFloat(v);
  return isNaN(p) ? fallback : p;
}
function ni(v: string, fallback = 1): number {
  const p = parseInt(v);
  return isNaN(p) ? fallback : Math.max(1, p);
}
function fmt(v: number): string {
  return v.toLocaleString();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Computed {
  rpu: number; u: number; t: number;
  lm: number; ot: number; cv: number;
  sc: number; dc: number;
  effSo: number; effSr: number;
  so: number; sr: number;
  soTbd: boolean; srTbd: boolean;
  anyTbd: boolean;
  mg: number; ar: number; am: number; mp: number; pb: number;
  configLabel: string;
  setupPu: number; demobPu: number; sub: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuoteEngineClient() {
  // Toggle state
  const [tier, setTierState] = useState<'base' | 'equipped'>('equipped');
  const [mon, setMon] = useState(false);
  const [plat, setPlat] = useState(true);
  const [setup, setSetup] = useState(true);
  const [demob, setDemob] = useState(true);
  const [margin, setMargin] = useState(false);
  const [waiveShip, setWaiveShip] = useState(false);
  const [waiveRet, setWaiveRet] = useState(false);

  // Input state
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [units, setUnits] = useState('1');
  const [term, setTerm] = useState('12');
  const [monCamPerUnit, setMonCamPerUnit] = useState('6');
  const [monCost, setMonCost] = useState('90');
  const [platCamPerUnit, setPlatCamPerUnit] = useState('6');
  const [platCost, setPlatCost] = useState('34');
  const [overrideRate, setOverrideRate] = useState('');
  const [overrideDetail, setOverrideDetail] = useState('');
  const [setupCost, setSetupCost] = useState('600');
  const [demobCost, setDemobCost] = useState('600');
  const [shipOut, setShipOut] = useState('');
  const [shipReturn, setShipReturn] = useState('');
  const [subleaseRate, setSubleaseRate] = useState('3000');
  const [endUserType, setEndUserType] = useState('Construction');
  const [notes, setNotes] = useState('');

  // Auto-waive return shipping for 12+ month terms
  useEffect(() => {
    const t = Math.max(1, parseInt(term) || 1);
    setWaiveRet(t >= 12);
  }, [term]);

  function setTier(t: 'base' | 'equipped') {
    setTierState(t);
    if (t === 'base') { setMon(false); setPlat(false); setSetup(false); setDemob(false); }
  }

  function doReset() {
    setTierState('equipped'); setMon(false); setPlat(true); setSetup(true); setDemob(true);
    setMargin(false); setWaiveShip(false); setWaiveRet(false);
    setClientName(''); setClientEmail(''); setUnits('1'); setTerm('12');
    setMonCamPerUnit('6'); setMonCost('90'); setPlatCamPerUnit('6'); setPlatCost('34');
    setOverrideRate(''); setOverrideDetail('');
    setSetupCost('600'); setDemobCost('600');
    setShipOut(''); setShipReturn(''); setSubleaseRate('3000');
    setEndUserType('Construction'); setNotes('');
  }

  // ── Computed values ──────────────────────────────────────────────────────────

  const C: Computed = useMemo(() => {
    const BASE = tier === 'base' ? 1200 : 1500;
    const u = Math.max(1, ni(units));
    const t = Math.max(1, ni(term));
    const mCam = Math.max(1, ni(monCamPerUnit));
    const mPc = Math.max(0, n(monCost));
    const pCam = Math.max(1, ni(platCamPerUnit));
    const pPc = Math.max(0, n(platCost));
    const sub = Math.max(0, n(subleaseRate));
    const setupPu = Math.max(0, n(setupCost));
    const demobPu = Math.max(0, n(demobCost));
    const soRaw = shipOut.trim();
    const soTbd = soRaw === '';
    const so = soTbd ? 0 : Math.max(0, n(soRaw));
    const srRaw = shipReturn.trim();
    const srTbd = srRaw === '';
    const sr = srTbd ? 0 : Math.max(0, n(srRaw));
    const hasOverride = overrideRate.trim() !== '';
    const overrideVal = hasOverride ? Math.max(0, n(overrideRate)) : 0;

    let rpu = BASE;
    if (tier === 'equipped' && mon) rpu += mCam * mPc;
    if (tier === 'equipped' && plat) rpu += pCam * pPc;
    if (hasOverride) rpu = overrideVal;

    const lm = rpu * u;
    const sc = setup ? setupPu * u : 0;
    const dc = demob ? demobPu * u : 0;
    const effSo = waiveShip ? 0 : so;
    const effDc = waiveRet ? 0 : dc;
    const effSr = waiveRet ? 0 : sr;
    const ot = sc + effSo + effDc + effSr;
    const cv = lm * t + ot;
    const anyTbd = (!waiveShip && soTbd) || (!waiveRet && srTbd);

    const mg = margin ? (sub - rpu) * u : 0;
    const ar = margin ? sub * u * 12 : 0;
    const am = mg * 12;
    const mp = margin && sub > 0 ? ((sub - rpu) / sub * 100) : 0;
    const pb = mg > 0 ? ot / mg : 0;

    let configLabel = tier === 'base' ? 'Power Base' : 'Fully Equipped';
    if (tier === 'equipped' && mon && plat) configLabel = 'Fully Equipped with Monitoring & Platform';
    else if (tier === 'equipped' && mon) configLabel = 'Fully Equipped with Active Monitoring';
    else if (tier === 'equipped' && plat) configLabel = 'Fully Equipped with Cloud Platform';

    return { rpu, u, t, lm, ot, cv, sc, dc, effSo, effSr, so, sr, soTbd, srTbd, anyTbd, mg, ar, am, mp, pb, configLabel, setupPu, demobPu, sub };
  }, [tier, mon, plat, setup, demob, margin, waiveShip, waiveRet, units, term, monCamPerUnit, monCost, platCamPerUnit, platCost, overrideRate, setupCost, demobCost, shipOut, shipReturn, subleaseRate]);

  // ── PDF generation ──────────────────────────────────────────────────────────

  function generatePDF() {
    const v = C;
    let lbl = tier === 'base' ? 'Power Base' : 'Fully Equipped';
    let det = tier === 'base'
      ? 'Mobile trailer with integrated battery &amp; solar power management'
      : '3 multi-sensor cameras (PTZ + fixed wide-angle), NVR &amp; cellular modem';
    if (tier === 'equipped') {
      const extras: string[] = [];
      if (plat) extras.push('cloud platform');
      if (mon) extras.push('active response live monitoring');
      if (extras.length > 0) det += ', ' + extras.join(' &amp; ');
      if (mon && plat) lbl = 'Fully Equipped with Monitoring &amp; Platform';
      else if (mon) lbl = 'Fully Equipped with Active Monitoring';
      else if (plat) lbl = 'Fully Equipped with Cloud Platform';
    }
    const customDet = overrideDetail.trim();
    if (customDet) det = customDet.replace(/</g, '&lt;');
    const cn = clientName || 'Valued Client';
    const ce = clientEmail;
    const nt = notes;
    const eu = endUserType;
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const qn = 'NXQ-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);

    let rows = '';
    rows += `<tr><td><strong>${lbl}</strong></td><td>${det}</td><td class="ra">$${fmt(v.rpu)}/mo per unit</td><td class="ra">--</td></tr>`;
    rows += `<tr><td><strong>Quantity &amp; Term</strong></td><td>${v.u} unit${v.u > 1 ? 's' : ''} &times; ${v.t} months</td><td class="ra">--</td><td class="ra">--</td></tr>`;

    if (setup) {
      rows += `<tr><td><strong>Setup &amp; Deployment</strong></td><td>Physical unit setup, on-site placement &amp; system activation</td><td class="ra">--</td><td class="ra">$${fmt(v.setupPu)} &times; ${v.u} = $${fmt(v.sc)}</td></tr>`;
    }
    if (demob) {
      const dcStr = waiveRet
        ? `<span style="text-decoration:line-through;color:#999;">$${fmt(v.demobPu)} &times; ${v.u} = $${fmt(v.dc)}</span> <span style="color:#059669;">Waived</span>`
        : `$${fmt(v.demobPu)} &times; ${v.u} = $${fmt(v.dc)}`;
      rows += `<tr><td><strong>Demobilization</strong></td><td>Breakdown &amp; decommissioning</td><td class="ra">--</td><td class="ra">${dcStr}</td></tr>`;
    }
    if (waiveShip) {
      rows += `<tr><td><strong>Outbound Shipping</strong></td><td></td><td class="ra">--</td><td class="ra">${v.so > 0 ? `<span style="text-decoration:line-through;color:#999;">$${fmt(v.so)}</span> ` : ''}<span style="color:#059669;">Waived</span></td></tr>`;
    } else if (v.soTbd) {
      rows += `<tr><td><strong>Outbound Shipping</strong></td><td>Dependent on deployment location</td><td class="ra">--</td><td class="ra" style="color:#1a7bae;font-style:italic;">TBD</td></tr>`;
    } else if (v.so > 0) {
      rows += `<tr><td><strong>Outbound Shipping</strong></td><td></td><td class="ra">--</td><td class="ra">$${fmt(v.so)}</td></tr>`;
    }
    if (waiveRet) {
      rows += `<tr><td><strong>Return Shipping</strong></td><td></td><td class="ra">--</td><td class="ra">${v.sr > 0 ? `<span style="text-decoration:line-through;color:#999;">$${fmt(v.sr)}</span> ` : ''}<span style="color:#059669;">Waived</span></td></tr>`;
    } else if (v.srTbd) {
      rows += `<tr><td><strong>Return Shipping</strong></td><td></td><td class="ra">--</td><td class="ra" style="color:#1a7bae;font-style:italic;">TBD</td></tr>`;
    } else if (v.sr > 0) {
      rows += `<tr><td><strong>Return Shipping</strong></td><td></td><td class="ra">--</td><td class="ra">$${fmt(v.sr)}</td></tr>`;
    }
    if (tier === 'base') {
      rows += `<tr><td colspan="4" style="font-size:11px;color:#8899aa;font-weight:500;padding:8px 14px;font-style:italic;">Note: Power Base configuration includes servicing for base trailer components only.</td></tr>`;
    }

    let th = '';
    th += `<div class="bx hl"><div class="bl">Monthly Recurring</div><div class="bv" style="color:#1a7bae;">$${fmt(v.lm)}</div></div>`;
    th += `<div class="bx"><div class="bl">One-Time Fees</div><div class="bv">${v.anyTbd ? `$${fmt(v.ot)}<span style="font-size:11px;color:#8899aa;"> + TBD</span>` : `$${fmt(v.ot)}`}</div></div>`;
    th += `<div class="bx"><div class="bl">Contract Value (${v.t} mo)</div><div class="bv">$${fmt(v.cv)}${v.anyTbd ? '<span style="font-size:11px;color:#8899aa;">+</span>' : ''}</div></div>`;

    let ph = '';
    if (margin) {
      ph += `<div class="ps"><div class="pt">Partner Economics</div><div class="pg">`;
      ph += `<div class="bx ac"><div class="bl">Net Margin</div><div class="bv gv">+$${fmt(v.mg)}/mo</div><div class="bs">At $${fmt(v.sub)} sublease to ${eu}</div></div>`;
      ph += `<div class="bx"><div class="bl">Annual Revenue</div><div class="bv">$${fmt(v.ar)}</div></div>`;
      ph += `<div class="bx"><div class="bl">Annual Margin</div><div class="bv gv">$${fmt(v.am)}</div></div>`;
      ph += `<div class="bx"><div class="bl">Margin %</div><div class="bv">${v.mp.toFixed(0)}%</div></div>`;
      ph += `</div></div>`;
    }

    const css = `@page{size:letter;margin:0;}*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Helvetica,Arial,sans-serif;color:#1a1a2e;max-width:8.5in;margin:0 auto;font-size:12px;}.hd{background:#080b12;padding:36px 48px 28px;text-align:center;}.bn{font-size:48px;font-weight:900;letter-spacing:5px;}.bn .w{color:#fff;}.bn .b{color:#1a7bae;}.hd .st{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#4a5a70;margin-top:6px;}.hd .qn{font-size:12px;font-weight:700;color:#8899aa;margin-top:4px;}.bd{padding:28px 48px;}.mg{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px;padding-bottom:16px;border-bottom:1px solid #e4e8f0;}.mi .ml{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#8899aa;margin-bottom:2px;}.mi .mv{font-size:13px;font-weight:600;}table{width:100%;border-collapse:collapse;margin-bottom:22px;}thead th{background:#f0f3f8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#5a6a80;padding:9px 14px;text-align:left;border-bottom:2px solid #d0d8e4;}thead th.ra{text-align:right;}tbody td{padding:11px 14px;border-bottom:1px solid #eceff4;}.ra{text-align:right;font-weight:700;font-family:"Courier New",monospace;}.bg{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;}.bx{background:#f7f9fc;border-radius:6px;padding:13px 15px;}.bx.ac{background:#ecfdf5;border:1.5px solid #a7f3d0;}.bx.hl{border:1.5px solid #1a7bae;}.bl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6b7a99;margin-bottom:3px;}.bv{font-size:17px;font-weight:800;font-family:"Courier New",monospace;}.bv.gv{color:#059669;}.bs{font-size:10px;color:#8899aa;margin-top:2px;}.ps{margin-bottom:18px;padding:18px;background:#fafbfd;border:1px solid #e4e8f0;border-radius:8px;}.pt{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2.5px;color:#059669;margin-bottom:12px;}.pg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}.nb{background:#fafbfd;border:1px solid #e4e8f0;border-radius:6px;padding:13px 16px;margin-bottom:18px;}.nb .nt{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#8899aa;margin-bottom:5px;}.nb p{font-size:11px;color:#4a5568;line-height:1.5;}.tm{font-size:9px;color:#8899aa;line-height:1.5;margin-bottom:18px;padding:13px 16px;background:#fafbfd;border-radius:6px;}.tm strong{color:#5a6a80;}.ft{border-top:1px solid #e4e8f0;padding-top:12px;font-size:9px;color:#aab;display:flex;justify-content:space-between;}`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Nomadxe Quote ${qn}</title><style>${css}</style></head><body>
<div class="hd"><div class="bn"><span class="w">NOMAD</span><span class="b">XE</span></div><div class="st">Surveillance Trailer Lease Quote</div><div class="qn">${qn}</div></div>
<div class="bd">
<div class="mg">
<div class="mi"><div class="ml">Prepared For</div><div class="mv">${cn}</div></div>
<div class="mi"><div class="ml">Date</div><div class="mv">${today}</div></div>
${ce ? `<div class="mi"><div class="ml">Contact</div><div class="mv">${ce}</div></div>` : ''}
<div class="mi"><div class="ml">Term</div><div class="mv">${v.t} Months</div></div>
<div class="mi"><div class="ml">Valid Through</div><div class="mv">30 Days from Issue</div></div>
</div>
<table><thead><tr><th>Description</th><th>Detail</th><th class="ra">Recurring</th><th class="ra">One-Time</th></tr></thead><tbody>${rows}</tbody></table>
<div class="bg">${th}</div>
${ph}
${nt ? `<div class="nb"><div class="nt">Special Terms &amp; Instructions</div><p>${nt.replace(/</g, '&lt;')}</p></div>` : ''}
<div class="tm"><strong>Terms:</strong> Monthly rates commence upon confirmed delivery or unit activation. Setup fee encompasses physical deployment, on-site placement, and full system activation. All equipment remains the exclusive property of Nomadxe for the duration of the lease. Leases of 12 months or more qualify for waived demobilization and return shipping fees.${mon ? ' Active response monitoring includes real-time live surveillance with immediate alert dispatch per agreed protocol.' : ''}</div>
<div class="ft"><div>Nomadxe &mdash; Confidential</div><div>${qn} &bull; Generated ${today}</div></div>
</div></body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Pop-up blocked — please allow pop-ups and retry.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  // ── Toggle helper ─────────────────────────────────────────────────────────

  function Toggle({ on, onToggle, sm }: { on: boolean; onToggle: () => void; sm?: boolean }) {
    return (
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: sm ? 36 : 44, height: sm ? 20 : 24,
          borderRadius: sm ? 10 : 12,
          background: on ? '#1f8ac0' : '#131820',
          border: `2px solid ${on ? '#1f8ac0' : '#1c2333'}`,
          cursor: 'pointer', position: 'relative',
          transition: 'all .25s', flexShrink: 0, display: 'inline-block',
        }}
        aria-pressed={on}
      >
        <span style={{
          position: 'absolute',
          top: 2, left: on ? (sm ? 16 : 20) : 2,
          width: sm ? 12 : 16, height: sm ? 12 : 16,
          borderRadius: '50%', background: '#e4e9f2',
          transition: 'left .25s',
        }} />
      </button>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const s = {
    bg: '#06080d', surface: '#0c1017', raised: '#131820', border: '#1c2333',
    accent: '#1f8ac0', alight: '#2ba3e0', aglow: 'rgba(31,138,192,.14)',
    text: '#e4e9f2', muted: '#6a7994', dim: '#3a4760',
    green: '#2dd4a0', gglow: 'rgba(45,212,160,.10)', amber: '#f59e0b',
  };

  const inputCls: React.CSSProperties = {
    width: '100%', background: s.raised, border: '2px solid transparent',
    borderRadius: 12, padding: '10px 14px', fontFamily: "'JetBrains Mono', monospace",
    fontSize: 14, fontWeight: 600, color: s.text, outline: 'none',
    WebkitAppearance: 'none', appearance: 'none' as any,
  };

  const labelCls: React.CSSProperties = {
    display: 'block', marginBottom: 6, fontSize: 10, fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '2.5px', color: s.dim,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '3px', color: s.accent, paddingBottom: 8,
    borderBottom: `1px solid ${s.border}`, marginBottom: 16,
  };

  const trStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 0',
  };

  const cardStyle: React.CSSProperties = {
    background: s.surface, border: `1px solid ${s.border}`,
    borderRadius: 22, padding: 28,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .qe-root { font-family: 'DM Sans', sans-serif; background: #06080d; color: #e4e9f2; min-height: 100dvh; padding: 16px; -webkit-font-smoothing: antialiased; }
        .qe-root input[type=number]::-webkit-inner-spin-button, .qe-root input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        .qe-root input:focus, .qe-root select:focus, .qe-root textarea:focus { border-color: #1f8ac0 !important; outline: none; }
        .qe-root select option { background: #131820; color: #e4e9f2; }
        .qe-root textarea { width: 100%; background: #131820; border: 2px solid transparent; border-radius: 12px; padding: 12px 14px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: #e4e9f2; resize: vertical; }
        .tb-card { background: #131820; border: 2px solid #1c2333; border-radius: 14px; padding: 18px 16px; text-align: left; cursor: pointer; transition: all .2s; font-family: inherit; color: inherit; width: 100%; }
        .tb-card:hover { border-color: #3a4760; }
        .tb-card.active { border-color: #1f8ac0; background: rgba(31,138,192,.14); }
        .ti-input { width: 100%; background: transparent; border: none; border-bottom: 2px solid #1c2333; font-family: inherit; font-size: 20px; font-weight: 700; color: #e4e9f2; padding: 6px 0; outline: none; transition: border-color .25s; }
        .ti-input.sm { font-size: 15px; }
        .ti-input::placeholder { color: #3a4760; }
        .ti-input:focus { border-bottom-color: #1f8ac0; }
        @keyframes fu { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .an { animation: fu .45s ease-out both; }
        .d1 { animation-delay: .06s; } .d2 { animation-delay: .12s; } .d3 { animation-delay: .18s; }
        @media (min-width: 900px) { .qe-grid { grid-template-columns: 58fr 42fr !important; } }
      `}</style>

      <div className="qe-root">
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>

          {/* ── Admin nav ── */}
          <div style={{ marginBottom: 12, display: 'flex', gap: 10 }}>
            <Link href="/admin" style={{ fontSize: 11, color: s.muted, fontWeight: 700, letterSpacing: 1, textDecoration: 'none', padding: '6px 14px', border: `1px solid ${s.border}`, borderRadius: 40 }}>
              ← Admin
            </Link>
          </div>

          {/* ── Header ── */}
          <div className="an" style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 22, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ background: '#080b12', padding: '40px 36px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: 6, lineHeight: 1 }}>
                <span style={{ color: '#fff' }}>NOMAD</span><span style={{ color: '#1a7bae' }}>XE</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', flexWrap: 'wrap' as any, gap: 10, borderTop: `1px solid ${s.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 3, color: s.dim }}>Surveillance Trailer Quote Engine</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={doReset} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'inherit', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.8px', padding: '12px 22px', border: `1px solid ${s.border}`, borderRadius: 40, cursor: 'pointer', background: s.raised, color: s.muted, transition: 'all .2s' }}>
                  RESET
                </button>
                <button onClick={generatePDF} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'inherit', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.8px', padding: '12px 22px', border: 'none', borderRadius: 40, cursor: 'pointer', background: s.accent, color: '#fff', boxShadow: `0 3px 18px ${s.aglow}`, transition: 'all .2s' }}>
                  GENERATE QUOTE
                </button>
              </div>
            </div>
          </div>

          {/* ── Main grid ── */}
          <div className="qe-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18 }}>

            {/* ── LEFT PANEL ── */}
            <div className="an d1" style={cardStyle}>

              {/* Client */}
              <div style={sectionTitle}>Client Information</div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelCls}>Client / Partner Name</label>
                <input className="ti-input" type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Enter client name..." />
              </div>
              <div style={{ marginBottom: 32 }}>
                <label style={labelCls}>Contact Email</label>
                <input className="ti-input sm" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@company.com" />
              </div>

              {/* Configuration */}
              <div style={sectionTitle}>Configuration &amp; Term</div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelCls}>Select Package</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button className={`tb-card${tier === 'base' ? ' active' : ''}`} onClick={() => setTier('base')}>
                    <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 3 }}>Power Base</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.accent }}>$1,200 / mo</div>
                    <div style={{ fontSize: 10, color: s.muted, marginTop: 5, lineHeight: 1.4 }}>Mobile trailer with integrated battery &amp; solar power management</div>
                  </button>
                  <button className={`tb-card${tier === 'equipped' ? ' active' : ''}`} onClick={() => setTier('equipped')}>
                    <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 3 }}>Fully Equipped</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.accent }}>${fmt(C.rpu)} / mo</div>
                    <div style={{ fontSize: 10, color: s.muted, marginTop: 5, lineHeight: 1.4 }}>3 multi-sensor cameras (PTZ + fixed wide-angle), NVR, cellular modem &amp; cloud platform</div>
                  </button>
                </div>
              </div>

              {/* Monitoring toggle */}
              <div style={{ marginBottom: 16 }}>
                <div style={trStyle}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: s.muted }}>Active Response Monitoring</div>
                    <div style={{ fontSize: 11, color: s.dim, fontFamily: "'JetBrains Mono', monospace" }}>Adds per-camera monitoring to Equipped rate</div>
                  </div>
                  <Toggle on={mon} onToggle={() => setMon(p => !p)} />
                </div>
                {mon && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                    <div><label style={labelCls}>Cameras / Unit</label><input style={inputCls} type="number" value={monCamPerUnit} min={1} onChange={e => setMonCamPerUnit(e.target.value)} /></div>
                    <div><label style={labelCls}>Monitoring $/Cam/Mo</label><input style={inputCls} type="number" value={monCost} min={0} onChange={e => setMonCost(e.target.value)} /></div>
                  </div>
                )}
              </div>

              {/* Platform toggle */}
              <div style={{ marginBottom: 16 }}>
                <div style={trStyle}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: s.muted }}>Cloud Platform Access</div>
                    <div style={{ fontSize: 11, color: s.dim, fontFamily: "'JetBrains Mono', monospace" }}>Adds per-camera platform fee to Equipped rate</div>
                  </div>
                  <Toggle on={plat} onToggle={() => setPlat(p => !p)} />
                </div>
                {plat && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                    <div><label style={labelCls}>Cameras / Unit</label><input style={inputCls} type="number" value={platCamPerUnit} min={1} onChange={e => setPlatCamPerUnit(e.target.value)} /></div>
                    <div><label style={labelCls}>Platform $/Cam/Mo</label><input style={inputCls} type="number" value={platCost} min={0} onChange={e => setPlatCost(e.target.value)} /></div>
                  </div>
                )}
              </div>

              {/* Override */}
              <div style={{ marginBottom: 20, padding: 14, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 12 }}>
                <label style={{ ...labelCls, color: s.amber }}>Monthly Rate Override ($/unit)</label>
                <input style={inputCls} type="number" value={overrideRate} min={0} placeholder="Leave blank to use calculated rate" onChange={e => setOverrideRate(e.target.value)} />
                <div style={{ fontSize: 10, color: s.dim, marginTop: 6 }}>Overrides the per-unit monthly rate.</div>
                <label style={{ ...labelCls, color: s.amber, marginTop: 14 }}>Quote Description Override</label>
                <input className="ti-input sm" type="text" value={overrideDetail} placeholder="Leave blank to use default description" onChange={e => setOverrideDetail(e.target.value)} style={{ borderBottomColor: s.border, fontSize: 13 }} />
                <div style={{ fontSize: 10, color: s.dim, marginTop: 6 }}>Replaces the Fully Equipped detail line on the generated quote.</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 32 }}>
                <div><label style={labelCls}>Units</label><input style={inputCls} type="number" value={units} min={1} onChange={e => setUnits(e.target.value)} /></div>
                <div><label style={labelCls}>Term (Months)</label><input style={inputCls} type="number" value={term} min={1} onChange={e => setTerm(e.target.value)} /></div>
              </div>

              {/* Setup & Demob */}
              <div style={sectionTitle}>Mobilization &amp; Demobilization</div>
              <div style={{ marginBottom: 16 }}>
                <div style={trStyle}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: s.muted }}>Setup &amp; Deployment</div>
                    <div style={{ fontSize: 11, color: s.dim, fontFamily: "'JetBrains Mono', monospace" }}>Physical unit setup, placement &amp; system activation</div>
                  </div>
                  <Toggle on={setup} onToggle={() => setSetup(p => !p)} />
                </div>
                {setup && (
                  <div style={{ marginTop: 8 }}>
                    <label style={labelCls}>Setup Cost / Unit</label>
                    <input style={{ ...inputCls, width: 160 }} type="number" value={setupCost} min={0} onChange={e => setSetupCost(e.target.value)} />
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 32 }}>
                <div style={trStyle}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: s.muted }}>Demobilization</div>
                    <div style={{ fontSize: 11, color: s.dim, fontFamily: "'JetBrains Mono', monospace" }}>Breakdown &amp; decommissioning</div>
                  </div>
                  <Toggle on={demob} onToggle={() => setDemob(p => !p)} />
                </div>
                {demob && (
                  <div style={{ marginTop: 8 }}>
                    <label style={labelCls}>Demob Cost / Unit</label>
                    <input style={{ ...inputCls, width: 160 }} type="number" value={demobCost} min={0} onChange={e => setDemobCost(e.target.value)} />
                  </div>
                )}
              </div>

              {/* Shipping */}
              <div style={sectionTitle}>Shipping &amp; Logistics</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={labelCls}>Outbound Shipping ($)</label>
                  <input style={inputCls} type="number" value={shipOut} min={0} placeholder="TBD" onChange={e => setShipOut(e.target.value)} />
                  {C.soTbd && !waiveShip && (
                    <div style={{ marginTop: 6, padding: '8px 12px', background: 'rgba(31,138,192,.08)', border: '1px solid rgba(31,138,192,.15)', borderRadius: 10, fontSize: 10, color: s.accent, fontWeight: 600 }}>
                      Leave blank if pending — depends on site location.
                    </div>
                  )}
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: s.dim, fontFamily: "'JetBrains Mono', monospace" }}>Waive</span>
                    <Toggle on={waiveShip} onToggle={() => setWaiveShip(p => !p)} sm />
                  </div>
                </div>
                <div>
                  <label style={labelCls}>Return Shipping ($)</label>
                  <input style={inputCls} type="number" value={shipReturn} min={0} placeholder="TBD" onChange={e => setShipReturn(e.target.value)} />
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: s.dim, fontFamily: "'JetBrains Mono', monospace" }}>Waive</span>
                    <Toggle on={waiveRet} onToggle={() => setWaiveRet(p => !p)} sm />
                  </div>
                </div>
              </div>
              {(waiveRet || waiveShip) && (
                <div style={{ marginBottom: 20, padding: '10px 14px', background: 'rgba(31,138,192,.08)', border: '1px solid rgba(31,138,192,.15)', borderRadius: 10, fontSize: 11, color: s.accent, fontWeight: 600 }}>
                  ℹ Leases of 12 months or more qualify for waived demobilization and return shipping fees.
                </div>
              )}

              {/* Partner */}
              <div style={sectionTitle}>Partner Economics</div>
              <div style={{ marginBottom: 32 }}>
                <div style={trStyle}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: s.muted }}>Partner Margin Analysis</div>
                    <div style={{ fontSize: 11, color: s.dim, fontFamily: "'JetBrains Mono', monospace" }}>For reseller &amp; channel partner deals</div>
                  </div>
                  <Toggle on={margin} onToggle={() => setMargin(p => !p)} />
                </div>
                {margin && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                    <div><label style={labelCls}>Sublease Rate ($/mo)</label><input style={inputCls} type="number" value={subleaseRate} min={0} onChange={e => setSubleaseRate(e.target.value)} /></div>
                    <div>
                      <label style={labelCls}>End-User Vertical</label>
                      <select style={inputCls} value={endUserType} onChange={e => setEndUserType(e.target.value)}>
                        {['Construction', 'Retail', 'Industrial', 'Events & Venues', 'Government', 'Other'].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div style={sectionTitle}>Additional Notes</div>
              <div>
                <label style={labelCls}>Special Terms or Instructions</label>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Enter any additional terms, conditions, or project-specific notes..." />
              </div>
            </div>

            {/* ── RIGHT PANEL ── */}
            <div>
              <div className="an d2" style={{ background: 'linear-gradient(168deg,#0e1320,#090c14)', border: `1px solid ${s.border}`, borderRadius: 22, padding: '28px 24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle,rgba(31,138,192,.10),transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2.5px', color: s.accent, marginBottom: 8 }}>Monthly Rate Per Unit</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 44, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>${fmt(C.rpu)}</div>
                  <div style={{ marginTop: 6, fontSize: 11, color: s.dim }}>{C.configLabel}</div>

                  <div style={{ marginTop: 20 }}>
                    {[
                      { label: 'Total Monthly (all units)', value: `$${fmt(C.lm)}` },
                      { label: 'One-Time Fees', value: C.anyTbd ? `$${fmt(C.ot)} + TBD` : `$${fmt(C.ot)}` },
                      { label: 'Contract Value', value: C.anyTbd ? `$${fmt(C.cv)}+` : `$${fmt(C.cv)}` },
                      { label: 'Term', value: `${C.t} months` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderTop: `1px solid ${s.border}` }}>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: s.dim }}>{label}</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700 }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {margin && (
                    <div style={{ background: s.gglow, border: '1px solid rgba(45,212,160,.14)', borderRadius: 14, padding: 18, marginTop: 22 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: s.green }}>▲ Partner Net Margin</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: s.green }}>
                          {C.mg >= 0 ? '+' : '-'}${fmt(Math.abs(C.mg))}/mo
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                        <span style={{ color: s.dim, fontSize: 11, fontWeight: 600 }}>at</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700 }}>${fmt(C.sub)}</span>
                        <span style={{ fontSize: 9, color: s.dim, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, fontStyle: 'italic' }}>sublease rate</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {margin && (
                <div className="an d3" style={{ marginTop: 18, padding: '18px 24px', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 16 }}>
                  {[
                    { label: 'Annual Revenue', value: `$${fmt(C.ar)}`, green: true },
                    { label: 'Annual Margin', value: `$${fmt(C.am)}`, green: true },
                    { label: 'Margin %', value: `${C.mp.toFixed(0)}%`, green: false },
                    { label: 'Payback', value: C.pb > 0 ? `${C.pb.toFixed(1)} mo` : '--', green: false },
                  ].map(({ label, value, green }) => (
                    <div key={label}>
                      <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: s.dim, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: green ? s.green : s.accent }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
