'use client';

import type { VRMData } from './NomadXECoreView';

/* ── Filter option definitions ── */

const MPPT_OPTIONS = [
  { label: 'Off',         value: 'Off',          color: '#9ca3af' },
  { label: 'Bulk',        value: 'Bulk',          color: '#f59e0b' },
  { label: 'Absorption',  value: 'Absorption',    color: '#f59e0b' },
  { label: 'Float',       value: 'Float',         color: '#22c55e' },
  { label: 'Storage',     value: 'Storage',       color: '#22c55e' },
  { label: 'Fault',       value: 'Fault',         color: '#ef4444' },
] as const;

// All known MPPT label values — used to normalise unexpected API responses
const KNOWN_MPPT_VALUES = new Set(MPPT_OPTIONS.map(o => o.value));

const CONNECTION_OPTIONS = [
  { label: 'Live',     value: 'live',    color: '#4ade80' },
  { label: 'Offline',  value: 'offline', color: '#ef4444' },
  { label: 'No data',  value: 'nodata',  color: '#6b7280' },
] as const;

/* ── Types ── */

export type MpptFilter       = (typeof MPPT_OPTIONS)[number]['value'];
export type ConnectionFilter = (typeof CONNECTION_OPTIONS)[number]['value'];

export interface FleetFilters {
  mppt:       Set<MpptFilter>;
  connection: Set<ConnectionFilter>;
}

export const EMPTY_FILTERS: FleetFilters = { mppt: new Set(), connection: new Set() };

/* ── Helpers ── */

/** Returns true if the device passes all active filter groups */
export function deviceMatchesFilters(
  data: VRMData | null,
  filters: FleetFilters,
): boolean {
  const mpptActive       = filters.mppt.size > 0;
  const connectionActive = filters.connection.size > 0;

  // No filters → everything matches
  if (!mpptActive && !connectionActive) return true;

  // MPPT group (OR within group)
  if (mpptActive) {
    const raw   = data?.solar.mpptStateLabel ?? 'Off';
    // Normalise any label the API might return that we don't have a chip for → 'Off'
    const label = (KNOWN_MPPT_VALUES.has(raw as MpptFilter) ? raw : 'Off') as MpptFilter;
    if (!filters.mppt.has(label)) return false;
  }

  // Connection group (OR within group, AND across groups)
  if (connectionActive) {
    const nowS      = Date.now() / 1000;
    const lastSeenS = data?.lastSeen ?? 0;
    const noData    = lastSeenS === 0;
    const isOffline = lastSeenS > 0 && (nowS - lastSeenS) > 15 * 60;
    const isLive    = lastSeenS > 0 && !isOffline;

    const matches =
      (filters.connection.has('live')    && isLive)    ||
      (filters.connection.has('offline') && isOffline) ||
      (filters.connection.has('nodata')  && noData);

    if (!matches) return false;
  }

  return true;
}

export function hasActiveFilters(filters: FleetFilters): boolean {
  return filters.mppt.size > 0 || filters.connection.size > 0;
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

  const toggleConnection = (value: ConnectionFilter) => {
    const next = new Set(filters.connection);
    next.has(value) ? next.delete(value) : next.add(value);
    onChange({ ...filters, connection: next });
  };

  const clearAll = () => onChange({ mppt: new Set(), connection: new Set() });
  const active = hasActiveFilters(filters);

  return (
    <div className="mb-4 bg-[#080c14]/60 border border-[#1e3a5f]/50 rounded-xl px-4 py-3 space-y-2.5">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono font-bold text-[#3b82f6]/70 uppercase tracking-[0.4em]">
          Filters
        </span>
        {active && (
          <button
            onClick={clearAll}
            className="text-[9px] font-mono font-bold text-[#93c5fd]/40 hover:text-white uppercase tracking-widest transition-colors"
          >
            ✕ Clear all
          </button>
        )}
      </div>

      {/* Connection Status row */}
      <FilterRow label="Connection Status">
        {CONNECTION_OPTIONS.map(opt => (
          <Chip
            key={opt.value}
            label={opt.label}
            color={opt.color}
            active={filters.connection.has(opt.value)}
            onClick={() => toggleConnection(opt.value)}
          />
        ))}
      </FilterRow>

      {/* Divider */}
      <div className="border-t border-[#1e3a5f]/40" />

      {/* Charge State row */}
      <FilterRow label="Charge State">
        {MPPT_OPTIONS.map(opt => (
          <Chip
            key={opt.value}
            label={opt.label}
            color={opt.color}
            active={filters.mppt.has(opt.value)}
            onClick={() => toggleMppt(opt.value)}
          />
        ))}
      </FilterRow>

    </div>
  );
}

/* ── Sub-components ── */

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-[9px] font-mono font-bold text-[#93c5fd]/40 uppercase tracking-widest w-28 flex-shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {children}
      </div>
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
        color:           active ? '#fff'          : color,
        backgroundColor: active ? color + '30'    : 'transparent',
        borderColor:     active ? color + '60'    : color + '22',
        boxShadow:       active ? `0 0 6px ${color}25` : 'none',
      }}
    >
      {label}
    </button>
  );
}
