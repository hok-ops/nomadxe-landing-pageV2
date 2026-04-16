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
  search:     string;
}

/** Minimal device shape needed for search matching */
export interface SearchableDevice {
  siteId: string;
  name: string;
  displayName: string | null;
}

export const EMPTY_FILTERS: FleetFilters = { mppt: new Set(), connection: new Set(), search: '' };

/* ── Helpers ── */

/** Returns true if the device passes all active filter groups */
export function deviceMatchesFilters(
  device: SearchableDevice,
  data: VRMData | null,
  filters: FleetFilters,
): boolean {
  const mpptActive       = filters.mppt.size > 0;
  const connectionActive = filters.connection.size > 0;
  const searchQuery      = filters.search.trim().toLowerCase();
  const searchActive     = searchQuery.length > 0;

  // No filters → everything matches
  if (!mpptActive && !connectionActive && !searchActive) return true;

  // Compute connection status once — reused by connection filter + search
  const nowS      = Date.now() / 1000;
  const lastSeenS = data?.lastSeen ?? 0;
  const noData    = lastSeenS === 0;
  const isOffline = lastSeenS > 0 && (nowS - lastSeenS) > 15 * 60;
  const isLive    = lastSeenS > 0 && !isOffline;

  // MPPT group (OR within group)
  if (mpptActive) {
    const raw   = data?.solar.mpptStateLabel ?? 'Off';
    // Normalise any label the API might return that we don't have a chip for → 'Off'
    const label = (KNOWN_MPPT_VALUES.has(raw as MpptFilter) ? raw : 'Off') as MpptFilter;
    if (!filters.mppt.has(label)) return false;
  }

  // Connection group (OR within group, AND across groups)
  if (connectionActive) {
    const matches =
      (filters.connection.has('live')    && isLive)    ||
      (filters.connection.has('offline') && isOffline) ||
      (filters.connection.has('nodata')  && noData);

    if (!matches) return false;
  }

  // Search — matches device name, display name, VRM site ID, or status keywords
  if (searchActive) {
    const haystack = [
      device.name,
      device.displayName ?? '',
      device.siteId,
      isLive    ? 'online live' : '',
      isOffline ? 'offline'     : '',
      noData    ? 'no data offline' : '',
    ]
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(searchQuery)) return false;
  }

  return true;
}

export function hasActiveFilters(filters: FleetFilters): boolean {
  return filters.mppt.size > 0 || filters.connection.size > 0 || filters.search.trim().length > 0;
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

  const clearAll = () => onChange({ mppt: new Set(), connection: new Set(), search: '' });
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

      {/* Search row */}
      <div className="relative">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#93c5fd]/40 pointer-events-none"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search by name, site ID, or status…"
          aria-label="Search fleet"
          className="w-full bg-[#0b1220]/70 border border-[#1e3a5f]/60 focus:border-[#3b82f6]/60 focus:outline-none focus:ring-1 focus:ring-[#3b82f6]/30 rounded-md pl-8 pr-8 py-1.5 text-[11px] font-mono text-white placeholder:text-[#93c5fd]/30 transition-colors"
        />
        {filters.search.length > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, search: '' })}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#93c5fd]/40 hover:text-white text-xs transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-[#1e3a5f]/40" />

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
