'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const MPPT_STATES = [
  { color: '#22c55e', label: 'Float', desc: 'Battery full - trickle maintaining charge' },
  { color: '#22c55e', label: 'Storage', desc: 'Long-term maintenance mode, system healthy' },
  { color: '#f59e0b', label: 'Bulk', desc: 'Fast charging - battery below about 80% capacity' },
  { color: '#f59e0b', label: 'Absorption', desc: 'Topping off - constant voltage, nearly full' },
  { color: '#ef4444', label: 'Fault', desc: 'Error detected - inspect solar charger' },
  { color: '#6b7280', label: 'Off', desc: 'No solar input - low light or night' },
];

const BATTERY_STATES = [
  { symbol: 'CHG', color: '#22c55e', desc: 'Solar is actively charging the battery' },
  { symbol: 'BAT', color: '#f59e0b', desc: 'Battery is discharging - powering the load' },
  { symbol: 'STBY', color: '#93c5fd', desc: 'Load met by solar; battery at rest' },
];

const UNITS = [
  { unit: 'W', name: 'Watts', desc: 'Instantaneous power (higher = more energy moving)' },
  { unit: 'V', name: 'Volts', desc: 'Electrical pressure in the system' },
  { unit: 'A', name: 'Amps', desc: 'Current flow - positive means charging' },
  { unit: 'kWh', name: 'Kilowatt-hours', desc: 'Energy harvested today (resets at midnight)' },
  { unit: 'SOC', name: 'State of Charge', desc: 'Battery level as a percentage (0-100%)' },
];

export default function ReadingKey() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-[#1e3a5f] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#93c5fd]/50 transition-all hover:border-[#3b82f6]/50 hover:text-white"
        title="Reading Key"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="hidden sm:inline">Key</span>
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center p-0 sm:items-center sm:p-4"
          style={{ background: 'rgba(4,7,14,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
        >
          <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-[#1e3a5f] bg-[#0d1526] shadow-[0_32px_80px_rgba(0,0,0,0.7)] sm:w-auto sm:max-w-lg sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1e3a5f] bg-[#0d1526] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6] shadow-[0_0_6px_#3b82f6]" />
                <span className="text-sm font-black tracking-tight text-white">Reading Key</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#1e3a5f] text-xs text-[#93c5fd]/40 transition-all hover:border-[#3b82f6]/50 hover:text-white"
                aria-label="Close reading key"
              >
                X
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              <section>
                <h3 className="mb-3 font-mono text-[9px] font-bold uppercase tracking-[0.4em] text-[#3b82f6]">Power Flow</h3>
                <div className="rounded-xl border border-[#1e3a5f]/60 bg-[#080c14] p-4">
                  <div className="flex items-center justify-between gap-2 text-center">
                    {[
                      { icon: 'PV', label: 'Solar', color: '#22c55e', desc: 'PV input' },
                      { icon: '>', label: '', color: '#1e3a5f', desc: '' },
                      { icon: 'BAT', label: 'Battery', color: '#3b82f6', desc: 'Storage' },
                      { icon: '>', label: '', color: '#1e3a5f', desc: '' },
                      { icon: 'DC', label: 'DC Loads', color: '#f59e0b', desc: 'Consumers' },
                    ].map((item, index) => (
                      item.label === '' ? (
                        <span key={index} className="flex-shrink-0 text-lg font-bold text-[#1e3a5f]">&gt;</span>
                      ) : (
                        <div key={index} className="flex min-w-0 flex-col items-center gap-1">
                          <span className="text-sm font-black" style={{ color: item.color }}>{item.icon}</span>
                          <span className="font-mono text-[10px] font-bold text-white">{item.label}</span>
                          <span className="font-mono text-[9px] text-[#93c5fd]/50">{item.desc}</span>
                        </div>
                      )
                    ))}
                  </div>
                  <p className="mt-3 text-center font-mono text-[10px] text-[#93c5fd]/55">
                    Dashboard indicators pulse when power is actively flowing.
                  </p>
                </div>
              </section>

              <section>
                <h3 className="mb-3 font-mono text-[9px] font-bold uppercase tracking-[0.4em] text-[#3b82f6]">MPPT Charge States</h3>
                <p className="mb-3 font-mono text-[10px] text-[#93c5fd]/55">
                  Shown as the badge on each unit.
                </p>
                <div className="space-y-2">
                  {MPPT_STATES.map((state) => (
                    <div key={state.label} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 flex-shrink-0 rounded-md px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider"
                        style={{ color: state.color, background: state.color + '18', border: `1px solid ${state.color}30` }}
                      >
                        {state.label}
                      </span>
                      <span className="text-[11px] leading-relaxed text-[#93c5fd]/75">{state.desc}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 font-mono text-[9px] font-bold uppercase tracking-[0.4em] text-[#3b82f6]">Battery Status</h3>
                <div className="space-y-2">
                  {BATTERY_STATES.map((state) => (
                    <div key={state.symbol} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 w-14 flex-shrink-0 text-right font-mono text-[9px] font-black uppercase tracking-widest"
                        style={{ color: state.color + 'cc' }}
                      >
                        {state.symbol}
                      </span>
                      <span className="text-[11px] leading-relaxed text-[#93c5fd]/75">{state.desc}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 font-mono text-[9px] font-bold uppercase tracking-[0.4em] text-[#3b82f6]">Units & Metrics</h3>
                <div className="overflow-hidden rounded-xl border border-[#1e3a5f]/60 bg-[#080c14]">
                  {UNITS.map((unit, index) => (
                    <div key={unit.unit} className={`flex items-start gap-4 px-4 py-3 ${index < UNITS.length - 1 ? 'border-b border-[#1e3a5f]/40' : ''}`}>
                      <span className="w-8 flex-shrink-0 font-mono text-[12px] font-black text-white">{unit.unit}</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-white">{unit.name}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-[#93c5fd]/60">{unit.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 font-mono text-[9px] font-bold uppercase tracking-[0.4em] text-[#3b82f6]">Connection Status</h3>
                <div className="space-y-2">
                  {[
                    { dot: 'bg-emerald-400 animate-pulse', glow: '0 0 5px #4ade80', label: 'Live', desc: 'Data received within last 15 minutes' },
                    { dot: 'bg-red-500', glow: '', label: 'Offline', desc: 'No data for 15+ minutes - check trailer' },
                    { dot: 'bg-[#4b5563]', glow: '', label: 'No data', desc: 'Unit has never reported - verify setup' },
                  ].map((status) => (
                    <div key={status.label} className="flex items-center gap-3">
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${status.dot}`} style={status.glow ? { boxShadow: status.glow } : {}} />
                      <span className="w-12 font-mono text-[10px] font-bold text-white">{status.label}</span>
                      <span className="text-[10px] text-[#93c5fd]/60">{status.desc}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
