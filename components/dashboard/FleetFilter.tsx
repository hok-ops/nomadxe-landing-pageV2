'use client';

import type { VRMData } from './NomadXECoreView';

/* ── Filter option definitions ── */

const MPPT_OPTIONS = [
  { label: 'Off',        value: 'Off',        color: '#9ca3af' },
  { label: 'Bulk',       value: 'Bulk',       color: '#f59e0b' },
  { label: 'Absorption', value: 'Absorption', color: '#f59e0b' },
  { label: 'Float',      value: 'Float',      color: '#22c55e' },
  { label: 'Storage',    value: 'Storage',    color: '#22c55e' },
  { label: 'Equalize',   value: 'Equalize',   color: '#3b82f6' },
  { label: 'Fault',      value: 'Fault',      color: '#ef4444' },
] as const;

const STATUS_OPTIONS = [
  { label: 'Online',  value: 'online',  color: '#4ade80' },
  { label: 'Offline', value: 'offline', color: '#ef4444' },
] as const;

/* ── Types ── */

export type MpptFilter = (typeof MPPT_OPTIONS)[number]['value'];
export type StatusFilter = (typeof STATUS_OPTIONS)[number]['value'];

export interface FleetFilters {
  mppt: Set<MpptFilter>;
  status: Set<StatusFilter>;
}

export const EMPTY_FILTERS: FleetFilters = { mppt: new Set(), status: new Set() };

/* ── Helpers ── */

/** Returns true if the device passes all active filter groups */
export function deviceMatchesFilters(
  data: VRMData | null,
  filters: FleetFilters,
): boolean {
  const mpptActive   = filters.mppt.size > 0;
  const statusActive = filters.status.size > 0;

  // No filters → everything matches
  if (!mpptActive && !statusActive) return true;

  // MPPT group (OR within group)
  if (mpptActive) {
    const label = data?.solar.mpptStateLabel ?? 'Off';
    if (!filters.mppt.has(label as MpptFilter)) return false;
  }

  // Status group (OR within group, AND across groups)
  if (statusActive) {
    const nowS      = Date.now() / 1000;
    const lastSeenS = data?.lastSeen ?? 0;
    const isOnline  = lastSeenS > 0 && (nowS - lastSeenS) < 15 * 60;

    const matchesStatus =
      (filters.status.has('online') && isOnline) ||
      (filters.status.has('offline') && !isOnline);

    if (!matchesStatus) return false;
  }

  return true;
}

export function hasActiveFilters(filters: FleetFilters): boolean {
  return filters.mppt.size > 0 || filters.status.size > 0;
}

/* ── Component ── */

interface Props {
  filters: FleetFilters;
  onChange: (next: FleetFilters) => void;
}

export default function FleetFilter({ filters, onChange }: Props) {

  const toggleMppt = (value: MpptFilter) => {
    const next = new Set(filters.mppt);
    next.has(value) ? next.delete(value) : next.add(value);
    onChange({ ...filters, mppt: next });
  };

  const toggleStatus = (value: StatusFilter) => {
    const next = new Set(filters.status);
    next.has(value) ? next.delete(value) : next.add(value);
    onChange({ ...filters, status: next });
  };

  const clearAll = () => onChange({ mppt: new Set(), status: new Set() });
  const active = hasActiveFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
      {/* Connectivity group */}
      <FilterGroup label="Status">
        {STATUS_OPTIONS.map(opt => (
          <Chip
            key={opt.value}
            label={opt.label}
            color={opt.color}
            active={filters.status.has(opt.value)}
            onClick={() => toggleStatus(opt.value)}
          />
        ))}
      </FilterGroup>

      <span className="w-px h-5 bg-[#1e3a5f]/60 hidden sm:block" />

      {/* MPPT group */}
      <FilterGroup label="Charge State">
        {MPPT_OPTIONS.map(opt => (
          <Chip
            key={opt.value}
            label={opt.label}
            color={opt.color}
            active={filters.mppt.has(opt.value)}
            onClick={() => toggleMppt(opt.value)}
          />
        ))}
      </FilterGroup>

      {/* Clear button */}
      {active && (
        <button
          onClick={clearAll}
          className="text-[9px] font-mono font-bold text-[#93c5fd]/50 hover:text-white uppercase tracking-widest transition-colors ml-1"
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono font-bold text-[#93c5fd]/40 uppercase tracking-widest mr-1">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] font-mono font-bold rounded-md px-2 py-[3px] transition-all duration-150 border"
      style={{
        color: active ? '#fff' : color,
        backgroundColor: active ? color + '30' : 'transparent',
        borderColor: active ? color + '60' : color + '20',
        boxShadow: active ? `0 0 6px ${color}25` : 'none',
      }}
    >
      {label}
    </button>
  );
}
