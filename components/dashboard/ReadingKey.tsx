'use client';

import { useState, useEffect } from 'react';

const MPPT_STATES = [
  { color: '#22c55e', label: 'Float',       desc: 'Battery full — trickle maintaining charge' },
  { color: '#22c55e', label: 'Storage',     desc: 'Long-term maintenance mode, system healthy' },
  { color: '#f59e0b', label: 'Bulk',        desc: 'Fast charging — battery below ~80% capacity' },
  { color: '#f59e0b', label: 'Absorption',  desc: 'Topping off — constant voltage, nearly full' },
  { color: '#ef4444', label: 'Fault',       desc: 'Error detected — inspect solar charger' },
  { color: '#6b7280', label: 'Off',         desc: 'No solar input — low light or night' },
];

const BATTERY_STATES = [
  { symbol: '↑ CHG',  color: '#22c55e', desc: 'Solar is actively charging the battery' },
  { symbol: '↓ BAT',  color: '#f59e0b', desc: 'Battery is discharging — powering the load' },
  { symbol: 'STBY',   color: '#93c5fd', desc: 'Load met by solar; battery at rest' },
];

const UNITS = [
  { unit: 'W',    name: 'Watts',       desc: 'Instantaneous power (higher = more energy moving)' },
  { unit: 'V',    name: 'Volts',       desc: 'Electrical pressure in the system' },
  { unit: 'A',    name: 'Amps',        desc: 'Current flow — positive means charging' },
  { unit: 'kWh',  name: 'Kilowatt-hours', desc: "Energy harvested today (resets at midnight)" },
  { unit: 'SOC',  name: 'State of Charge', desc: 'Battery level as a percentage (0–100%)' },
];

export default function ReadingKey() {
  const [open, setOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[10px] font-bold font-mono border border-[#1e3a5f] text-[#93c5fd]/50 hover:text-white hover:border-[#3b82f6]/50 px-3 py-2 rounded-lg transition-all uppercase tracking-widest"
        title="Reading Key"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="hidden sm:inline">Key</span>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(4,7,14,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full sm:w-auto sm:max-w-lg max-h-[90dvh] overflow-y-auto bg-[#0d1526] border border-[#1e3a5f] sm:rounded-2xl rounded-t-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)]">

            {/* Header */}
            <div className="sticky top-0 bg-[#0d1526] flex items-center justify-between px-6 py-4 border-b border-[#1e3a5f] z-10">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] shadow-[0_0_6px_#3b82f6]" />
                <span className="text-sm font-black text-white tracking-tight">Reading Key</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg border border-[#1e3a5f] text-[#93c5fd]/40 hover:text-white hover:border-[#3b82f6]/50 text-xs flex items-center justify-center transition-all"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">

              {/* Power Flow */}
              <section>
                <h3 className="text-[9px] font-bold text-[#3b82f6] uppercase tracking-[0.4em] font-mono mb-3">Power Flow</h3>
                <div className="bg-[#080c14] border border-[#1e3a5f]/60 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-2 text-center">
                    {[
                      { icon: '☀', label: 'Solar', color: '#22c55e', desc: 'PV input' },
                      { icon: '→', label: '',       color: '#1e3a5f', desc: '' },
                      { icon: '▪', label: 'Battery', color: '#3b82f6', desc: 'Storage' },
                      { icon: '→', label: '',       color: '#1e3a5f', desc: '' },
                      { icon: '⚡', label: 'DC Loads', color: '#f59e0b', desc: 'Consumers' },
                    ].map((item, i) => (
                      item.label === '' ? (
                        <span key={i} className="text-[#1e3a5f] text-lg font-bold flex-shrink-0">→</span>
                      ) : (
                        <div key={i} className="flex flex-col items-center gap-1 min-w-0">
                          <span className="text-xl" style={{ color: item.color }}>{item.icon}</span>
                          <span className="text-[10px] font-bold text-white font-mono">{item.label}</span>
                          <span className="text-[9px] text-[#93c5fd]/50 font-mono">{item.desc}</span>
                        </div>
                      )
                    ))}
                  </div>
                  <p className="text-[10px] text-[#93c5fd]/55 font-mono mt-3 text-center">
                    Dashed arrows animate when power is actively flowing
                  </p>
                </div>
              </section>

              {/* MPPT Charge States */}
              <section>
                <h3 className="text-[9px] font-bold text-[#3b82f6] uppercase tracking-[0.4em] font-mono mb-3">MPPT Charge States</h3>
                <p className="text-[10px] text-[#93c5fd]/55 font-mono mb-3">
                  Shown as the badge on each unit (top-right of battery panel)
                </p>
                <div className="space-y-2">
                  {MPPT_STATES.map(s => (
                    <div key={s.label} className="flex items-start gap-3">
                      <span
                        className="flex-shrink-0 text-[9px] font-black font-mono uppercase tracking-wider px-2 py-0.5 rounded-md mt-0.5"
                        style={{ color: s.color, background: s.color + '18', border: `1px solid ${s.color}30` }}
                      >
                        {s.label}
                      </span>
                      <span className="text-[11px] text-[#93c5fd]/75 leading-relaxed">{s.desc}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Battery Status */}
              <section>
                <h3 className="text-[9px] font-bold text-[#3b82f6] uppercase tracking-[0.4em] font-mono mb-3">Battery Status</h3>
                <div className="space-y-2">
                  {BATTERY_STATES.map(s => (
                    <div key={s.symbol} className="flex items-start gap-3">
                      <span
                        className="flex-shrink-0 text-[9px] font-black font-mono uppercase tracking-widest w-14 text-right mt-0.5"
                        style={{ color: s.color + 'cc' }}
                      >
                        {s.symbol}
                      </span>
                      <span className="text-[11px] text-[#93c5fd]/75 leading-relaxed">{s.desc}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Units */}
              <section>
                <h3 className="text-[9px] font-bold text-[#3b82f6] uppercase tracking-[0.4em] font-mono mb-3">Units & Metrics</h3>
                <div className="bg-[#080c14] border border-[#1e3a5f]/60 rounded-xl overflow-hidden">
                  {UNITS.map((u, i) => (
                    <div key={u.unit} className={`flex items-start gap-4 px-4 py-3 ${i < UNITS.length - 1 ? 'border-b border-[#1e3a5f]/40' : ''}`}>
                      <span className="flex-shrink-0 w-8 text-[12px] font-black text-white font-mono">{u.unit}</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-white">{u.name}</div>
                        <div className="text-[10px] text-[#93c5fd]/60 font-mono mt-0.5">{u.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Online status */}
              <section>
                <h3 className="text-[9px] font-bold text-[#3b82f6] uppercase tracking-[0.4em] font-mono mb-3">Connection Status</h3>
                <div className="space-y-2">
                  {[
                    { dot: 'bg-emerald-400 animate-pulse', glow: '0 0 5px #4ade80', label: 'Live', desc: 'Data received within last 15 minutes' },
                    { dot: 'bg-red-500',   glow: '',                  label: 'Offline', desc: 'No data for 15+ minutes — check trailer' },
                    { dot: 'bg-[#4b5563]', glow: '',                  label: 'No data', desc: 'Unit has never reported — verify setup' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-3">
                      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${s.dot}`}
                        style={s.glow ? { boxShadow: s.glow } : {}} />
                      <span className="text-[10px] font-bold text-white w-12 font-mono">{s.label}</span>
                      <span className="text-[10px] text-[#93c5fd]/60">{s.desc}</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="pt-2 pb-1 text-center text-[9px] text-[#93c5fd]/30 font-mono uppercase tracking-widest">
                Data refreshes every 5 minutes · refresh manually anytime
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
