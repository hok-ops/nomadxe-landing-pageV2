'use client';

import type { VRMData } from './NomadXECoreView';

const MPPT_OPTIONS = [
  { label: 'Off',         value: 'Off',          color: '#9ca3af' },
  { label: 'Bulk',        value: 'Bulk',          color: '#f59e0b' },
  { label: 'Absorption',  value: 'Absorption',    color: '#f59e0b' },
  { label: 'Float',       value: 'Float',         color: '#22c55e' },
  { label: 'Storage',     value: 'Storage',       color: '#22c55e' },
  { label: 'Fault',       value: 'Fault',         color: '#ef4444' },
] as const;

const KNOWN_MPPT_VALUES = new Set(MPPT_OPTIONS.map(o => o.value));

const CONNECTION_OPTIONS = [
  { label: 'Live',     value: 'live',    color: '#4ade80' },
  { label: 'Offline',  value: 'offline', color: '#ef4444' },
  { label: 'No data',  value: 'nodata',  color: '#6b7280' },
] as const;

export type MpptFilter       = (typeof MPPT_OPTIONS)[number]['value'];
export type ConnectionFilter = (typeof CONNECTION_OPTIONS)[number]['value'];
export type SortKey          = 'name-asc' | 'name-desc' | 'battery' | 'solar' | 'status';

export interface FleetFilters {
  mppt:       Set<MpptFilter>;
  connection: Set<ConnectionFilter>;
  search:     string;
  sort:       SortKey;
}

export interface SearchableDevice {
  siteId: string;
  name: string;
  displayName: string | null;
}

export const EMPTY_FILTERS: FleetFilters = {
  mppt:       new Set(),
  connection: new Set(),
  search:     '',
  sort:       'name-asc',
};

export function deviceMatchesFilters(
  device: SearchableDevice,
  data: VRMData | null,
  filters: FleetFilters,
): boolean {
  const mpptActive       = filters.mppt.size > 0;
  const connectionActive = filters.connection.size > 0;
  const searchQuery      = filters.search.trim().toLowerCase();
  const searchActive     = searchQuery.length > 0;

  if (!mpptActive && !connectionActive && !searchActive) return true;

  const nowS      = Date.now() / 1000;
  const lastSeenS = data?.lastSeen ?? 0;
  const noData    = lastSeenS === 0;
  const isOffline = lastSeenS > 0 && (nowS - lastSeenS) > 15 * 60;
  const isLive    = lastSeenS > 0 && !isOffline;

  if (mpptActive) {
    const raw   = data?.solar.mpptStateLabel ?? 'Off';
    const label = (KNOWN_MPPT_VALUES.has(raw as MpptFilter) ? raw : 'Off') as MpptFilter;
    if (!filters.mppt.has(label)) return false;
  }

  if (connectionActive) {
    const matches =
      (filters.connection.has('live')    && isLive)    ||
      (filters.connection.has('offline') && isOffline) ||
      (filters.connection.has('nodata')  && noData);
    if (!matches) return false;
  }

  if (searchActive) {
    const haystack = [
      device.name,
      device.displayName ?? '',
      device.siteId,
      isLive    ? 'online live' : '',
      isOffline ? 'offline'     : '',
      noData    ? 'no data offline' : '',
    ].join(' ').toLowerCase();
    if (!haystack.includes(searchQuery)) return false;
  }

  return true;
}

export function hasActiveFilters(filters: FleetFilters): boolean {
  return filters.mppt.size > 0 || filters.connection.size > 0 || filters.search.trim().length > 0;
}

const SORT_OPTIONS: { label: string; key: SortKey }[] = [
  { label: 'Name',    key: 'name-asc' },
  { label: 'Battery', key: 'battery'  },
  { label: 'Solar',   key: 'solar'    },
  { label: 'Status',  key: 'status'   },
];

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

  const setSort = (key: SortKey) => {
    if (key === 'name-asc') {
      onChange({ ...filters, sort: filters.sort === 'name-asc' ? 'name-desc' : 'name-asc' });
    } else {
      onChange({ ...filters, sort: key });
    }
  };

  const clearAll = () => onChange({ mppt: new Set(), connection: new Set(), search: '', sort: 'name-asc' });
  const active = hasActiveFilters(filters);

  return (
    <div className="mb-4 bg-[#080c14]/60 border border-[#1e3a5f]/50 rounded-xl px-4 py-3 space-y-2.5">

      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono font-bold text-[#3b82f6]/70 uppercase tracking-[0.4em]">
          Filters
        </span>
        {active && (
          <button onClick={clearAll} className="text-[9px] font-mono font-bold text-[#93c5fd]/40 hover:text-white uppercase tracking-widest transition-colors">
            &#x2715; Clear all
          </button>
        )}
      </div>

      <div className="relative">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#93c5fd]/40 pointer-events-none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search by name, site ID, or status..."
          aria-label="Search fleet"
          className="w-full bg-[#0b1220]/70 border border-[#1e3a5f]/60 focus:border-[#3b82f6]/60 focus:outline-none focus:ring-1 focus:ring-[#3b82f6]/30 rounded-md pl-8 pr-8 py-1.5 text-[11px] font-mono text-white placeholder:text-[#93c5fd]/30 transition-colors"
        />
        {filters.search.length > 0 && (
          <button type="button" onClick={() => onChange({ ...filters, search: '' })} aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#93c5fd]/40 hover:text-white text-xs transition-colors">
            &#x2715;
          </button>
        )}
      </div>

      <div className="border-t border-[#1e3a5f]/40" />

      <FilterRow label="Connection">
        {CONNECTION_OPTIONS.map(opt => (
          <Chip key={opt.value} label={opt.label} color={opt.color}
            active={filters.connection.has(opt.value)} onClick={() => toggleConnection(opt.value)} />
        ))}
      </FilterRow>

      <div className="border-t border-[#1e3a5f]/40" />

      <FilterRow label="Charge State">
        {MPPT_OPTIONS.map(opt => (
          <Chip key={opt.value} label={opt.label} color={opt.color}
            active={filters.mppt.has(opt.value)} onClick={() => toggleMppt(opt.value)} />
        ))}
      </FilterRow>

      <div className="border-t border-[#1e3a5f]/40" />

      <FilterRow label="Sort By">
        {SORT_OPTIONS.map(opt => {
          const isNameOpt = opt.key === 'name-asc';
          const isActive  = isNameOpt
            ? (filters.sort === 'name-asc' || filters.sort === 'name-desc')
            : filters.sort === opt.key;
          const lbl = isNameOpt
            ? (filters.sort === 'name-desc' ? 'Name Z-A' : 'Name A-Z')
            : opt.label;
          return (
            <Chip key={opt.key} label={lbl} color="#3b82f6"
              active={isActive} onClick={() => setSort(opt.key)} />
          );
        })}
      </FilterRow>

    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-[9px] font-mono font-bold text-[#93c5fd]/40 uppercase tracking-widest w-28 flex-shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] font-mono font-bold rounded-md px-2 py-[3px] transition-all duration-150 border"
      style={{
        color:           active ? '#fff'       : color,
        backgroundColor: active ? color + '30' : 'transparent',
        borderColor:     active ? color + '60' : color + '22',
        boxShadow:       active ? `0 0 6px ${color}25` : 'none',
      }}
    >
      {label}
    </button>
  );
}
