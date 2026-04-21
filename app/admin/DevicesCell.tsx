'use client';

import { useState } from 'react';
import { RemoveDeviceButton } from './RemoveDeviceButton';

interface Assignment {
  id: number | string;
  // Supabase types foreign-key joins as arrays even for many-to-one relations
  vrm_devices?: { name?: string; vrm_site_id?: string } | { name?: string; vrm_site_id?: string }[] | null;
}

function deviceInfo(vrm: Assignment['vrm_devices']): { name?: string; vrm_site_id?: string } {
  if (!vrm) return {};
  return Array.isArray(vrm) ? (vrm[0] ?? {}) : vrm;
}

export function DevicesCell({ assignments }: { assignments: Assignment[] }) {
  const [open, setOpen] = useState(false);

  if (assignments.length === 0) {
    return <span className="text-[11px] text-[#93c5fd]/20 italic">None assigned</span>;
  }

  return (
    <div>
      {/* Always-visible count badge — click to toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
          open
            ? 'border-[#3b82f6]/40 bg-[#1e40af]/15 text-[#3b82f6]'
            : 'border-[#1e3a5f] text-[#93c5fd]/50 hover:border-[#1e3a5f]/80 hover:text-white'
        }`}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2" />
        </svg>
        {assignments.length} device{assignments.length !== 1 ? 's' : ''}
        <svg
          width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expandable list */}
      {open && (
        <div className="mt-2 space-y-1.5">
          {assignments.map((inst) => {
            const dev = deviceInfo(inst.vrm_devices);
            return (
              <div key={inst.id} className="flex items-center gap-1.5 pl-1">
                <div>
                  <div className="text-sm font-semibold text-white leading-tight">{dev.name}</div>
                  <div className="text-[10px] text-[#93c5fd]/30 font-mono">{dev.vrm_site_id}</div>
                </div>
                <RemoveDeviceButton assignmentId={inst.id as number} deviceName={dev.name ?? ''} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
