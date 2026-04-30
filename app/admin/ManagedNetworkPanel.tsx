'use client';

import { useMemo, useState } from 'react';
import {
  addManagedNetworkDevice,
  deleteManagedNetworkDevice,
  promoteDiscoveredNetworkDevice,
} from './actions';
import {
  getManagedDeviceSummary,
  type DiscoveredNetworkDevice,
  type ManagedNetworkDevice,
} from '@/lib/networkDevices';

const STALE_AFTER_MS = 10 * 60_000;

type DeviceItem = {
  id: number;
  name: string;
  vrm_site_id: string;
};

type ManagedDeviceWithParent = ManagedNetworkDevice & {
  parentName: string;
  parentSiteId: string;
};

type DiscoveredDeviceWithParent = DiscoveredNetworkDevice & {
  parentName: string;
  parentSiteId: string;
};

type FleetSourceFilter = 'attention' | 'unreported' | 'all';

type RouterLanDiagnosticResult = {
  ok: true;
  device: {
    id: number;
    siteId: string;
    name: string;
  };
  observedAt: string;
  modemReportSaved: boolean;
  lanDeviceCount: number;
  discovered: number;
  updated: number;
  markedOffline: number;
  endpointResults: Array<{
    path: string;
    ok: boolean;
    status: number | null;
    elapsedMs: number;
    deviceCount: number;
    bodyShape: string;
    sampleKeys: string[];
    error?: string;
  }>;
  warnings: string[];
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
      aria-hidden="true"
    >
      <path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function statusClasses(status: ManagedNetworkDevice['lastStatus']) {
  if (status === 'online') return 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25';
  if (status === 'offline') return 'bg-rose-500/12 text-rose-300 border-rose-500/25';
  return 'bg-slate-500/12 text-slate-300 border-slate-500/25';
}

function statusLabel(status: ManagedNetworkDevice['lastStatus']) {
  if (status === 'online') return 'Online';
  if (status === 'offline') return 'Offline';
  return 'Unknown';
}

function formatAgo(value: string | null) {
  if (!value) return 'Never reported';
  const ms = Date.now() - Date.parse(value);
  if (!Number.isFinite(ms) || ms < 0) return 'Unknown';
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isStale(device: ManagedNetworkDevice) {
  if (!device.lastReportedAt) return true;
  const lastReportedMs = Date.parse(device.lastReportedAt);
  return !Number.isFinite(lastReportedMs) || (Date.now() - lastReportedMs) > STALE_AFTER_MS;
}

function isDiscoveryStale(device: DiscoveredNetworkDevice) {
  const lastSeenMs = Date.parse(device.lastSeenAt);
  return !Number.isFinite(lastSeenMs) || (Date.now() - lastSeenMs) > STALE_AFTER_MS;
}

function statusPresentation(device: ManagedDeviceWithParent) {
  if (device.lastStatus === 'offline') {
    return {
      label: 'Offline',
      classes: 'bg-rose-500/12 text-rose-300 border-rose-500/25',
    };
  }

  if (isStale(device)) {
    return {
      label: 'Stale',
      classes: 'bg-amber-500/12 text-amber-300 border-amber-500/25',
    };
  }

  return {
    label: statusLabel(device.lastStatus),
    classes: statusClasses(device.lastStatus),
  };
}

export function ManagedNetworkPanel({
  devices,
  managedDevices,
  discoveredDevices,
}: {
  devices: DeviceItem[];
  managedDevices: ManagedDeviceWithParent[];
  discoveredDevices: DiscoveredDeviceWithParent[];
}) {
  const [open, setOpen] = useState(true);
  const [fleetSearch, setFleetSearch] = useState('');
  const [fleetFilter, setFleetFilter] = useState<FleetSourceFilter>('attention');
  const [diagnosticDeviceId, setDiagnosticDeviceId] = useState(devices[0] ? String(devices[0].id) : '');
  const [diagnosticBusy, setDiagnosticBusy] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<RouterLanDiagnosticResult | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const summary = getManagedDeviceSummary(managedDevices, STALE_AFTER_MS);
  const attentionCount = summary.offline + summary.stale;
  const unmanagedDiscoveries = discoveredDevices
    .filter((device) => !device.isManaged)
    .slice(0, 8);
  const fleetRows = useMemo(() => {
    const managedByDevice = new Map<number, { managedCount: number; attentionCount: number }>();
    const observedByDevice = new Map<number, { observedCount: number; staleDiscoveryCount: number; lastObservedAt: string | null }>();

    for (const target of managedDevices) {
      const current = managedByDevice.get(target.vrmDeviceId) ?? { managedCount: 0, attentionCount: 0 };
      current.managedCount += 1;
      if (target.lastStatus === 'offline' || isStale(target)) current.attentionCount += 1;
      managedByDevice.set(target.vrmDeviceId, current);
    }

    for (const host of discoveredDevices) {
      const current = observedByDevice.get(host.vrmDeviceId) ?? {
        observedCount: 0,
        staleDiscoveryCount: 0,
        lastObservedAt: null,
      };
      current.observedCount += 1;
      if (isDiscoveryStale(host)) current.staleDiscoveryCount += 1;
      if (!current.lastObservedAt || host.lastSeenAt > current.lastObservedAt) {
        current.lastObservedAt = host.lastSeenAt;
      }
      observedByDevice.set(host.vrmDeviceId, current);
    }

    return devices
      .map((device) => {
        const managed = managedByDevice.get(device.id);
        const observed = observedByDevice.get(device.id);
        return {
          ...device,
          managedCount: managed?.managedCount ?? 0,
          observedCount: observed?.observedCount ?? 0,
          attentionCount: managed?.attentionCount ?? 0,
          lastObservedAt: observed?.lastObservedAt ?? null,
          staleDiscoveryCount: observed?.staleDiscoveryCount ?? 0,
        };
      })
      .sort((a, b) => {
        if (a.attentionCount !== b.attentionCount) return b.attentionCount - a.attentionCount;
        if (Boolean(a.lastObservedAt) !== Boolean(b.lastObservedAt)) return a.lastObservedAt ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
  }, [devices, managedDevices, discoveredDevices]);
  const fleetSearchTerm = fleetSearch.trim().toLowerCase();
  const filteredFleetRows = fleetRows.filter((device) => {
    if (fleetFilter === 'attention' && device.attentionCount === 0) return false;
    if (fleetFilter === 'unreported' && device.lastObservedAt) return false;
    if (!fleetSearchTerm) return true;
    return `${device.name} ${device.vrm_site_id}`.toLowerCase().includes(fleetSearchTerm);
  });
  const visibleFleetRows = filteredFleetRows.slice(0, 40);
  const unreportedFleetCount = fleetRows.filter((device) => !device.lastObservedAt).length;
  const orderedManagedDevices = [...managedDevices].sort((a, b) => {
    const aAttention = a.lastStatus === 'offline' || isStale(a) ? 0 : 1;
    const bAttention = b.lastStatus === 'offline' || isStale(b) ? 0 : 1;
    if (aAttention !== bAttention) return aAttention - bAttention;
    return a.name.localeCompare(b.name);
  });

  async function runLanDiagnostic() {
    if (!diagnosticDeviceId || diagnosticBusy) return;
    setDiagnosticBusy(true);
    setDiagnosticError(null);
    setDiagnosticResult(null);

    try {
      const response = await fetch('/api/admin/router-lan-diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vrmDeviceId: diagnosticDeviceId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Router diagnostic failed');
      }
      setDiagnosticResult(payload as RouterLanDiagnosticResult);
    } catch (error) {
      setDiagnosticError(error instanceof Error ? error.message : 'Router diagnostic failed');
    } finally {
      setDiagnosticBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1e3a5f]/70 bg-[#0d1526]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="lan-device-operations-panel"
        className="flex w-full items-center justify-between gap-4 border-b border-[#1e3a5f]/70 px-4 py-4 text-left transition-colors hover:bg-[#111d36] sm:px-5"
      >
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#93c5fd]/70">LAN Device Operations</div>
          <p className="mt-1 text-[11px] text-[#93c5fd]/48">
            {managedDevices.length} managed, {discoveredDevices.length} observed, {attentionCount} needing attention
          </p>
        </div>
        <span className="text-[#93c5fd]/55">
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <div id="lan-device-operations-panel" className="space-y-6 p-4 sm:p-5">
      <div className="rounded-2xl border border-[#1e3a5f]/70 bg-[linear-gradient(180deg,rgba(13,21,38,0.96),rgba(8,12,20,0.98))] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="mb-1 text-sm font-bold text-white">Managed LAN Devices</h2>
            <p className="max-w-md text-[11px] leading-relaxed text-[#93c5fd]/68">
              Add only the devices that matter operationally. The Cerbo reports health for this curated list, so the UI stays calm and exception-driven.
            </p>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-[24rem]">
            {[
              { label: 'Managed', value: managedDevices.length, tone: 'text-white' },
              { label: 'Observed', value: discoveredDevices.length, tone: 'text-emerald-300' },
              {
                label: 'Attention',
                value: attentionCount,
                tone: attentionCount > 0 ? 'text-amber-300' : 'text-[#93c5fd]/55',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[#1e3a5f]/70 bg-[#080c14]/90 px-3 py-2 text-center">
                <div className={`text-sm font-black ${item.tone}`}>{item.value}</div>
                <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/45">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#1e3a5f]/70 bg-[#0b1323]">
        <div className="border-b border-[#1e3a5f]/60 px-4 py-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.28em] text-[#93c5fd]/72">Fleet Source Register</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-[#93c5fd]/45">
              Indexed from registered VRM dashboard devices. Filter first; do not browse the fleet as cards.
            </p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Trailers', value: fleetRows.length },
              { label: 'No Report', value: unreportedFleetCount },
              { label: 'Issues', value: fleetRows.reduce((total, device) => total + device.attentionCount, 0) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-[#1e3a5f]/55 bg-[#080c14]/80 px-2 py-2 text-center">
                <div className="text-xs font-black text-white">{item.value}</div>
                <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-[#93c5fd]/38">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {fleetRows.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-[#93c5fd]/55">No dashboard trailers are registered yet.</p>
            <p className="mt-2 text-[11px] text-[#93c5fd]/38">Register a Victron device first, then LAN inventory can attach to its site ID.</p>
          </div>
        ) : (
          <div className="p-4">
            <div className="grid gap-2 lg:grid-cols-[minmax(18rem,1fr)_24rem]">
              <input
                value={fleetSearch}
                onChange={(event) => setFleetSearch(event.target.value)}
                className="w-full rounded-lg border border-[#1e3a5f] bg-[#080c14] px-3 py-2 text-xs text-white outline-none transition-colors placeholder:text-[#93c5fd]/25 focus:border-[#3b82f6]"
                placeholder="Search trailer or site ID"
              />
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: 'attention' as const, label: 'Issues' },
                  { key: 'unreported' as const, label: 'No Report' },
                  { key: 'all' as const, label: 'All' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFleetFilter(item.key)}
                    className={`rounded-lg border px-2 py-2 text-[9px] font-bold uppercase tracking-[0.16em] transition-all ${
                      fleetFilter === item.key
                        ? 'border-[#3b82f6]/60 bg-[#2563eb]/20 text-white'
                        : 'border-[#1e3a5f]/65 bg-[#080c14]/65 text-[#93c5fd]/48 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 max-h-[24rem] overflow-y-auto pr-1">
              {filteredFleetRows.length === 0 ? (
                <div className="rounded-xl border border-[#1e3a5f]/45 bg-[#080c14]/70 px-3 py-5 text-center">
                  <p className="text-xs text-[#93c5fd]/55">No trailers match this filter.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#1e3a5f]/38 overflow-hidden rounded-xl border border-[#1e3a5f]/45 bg-[#080c14]/70">
                  {visibleFleetRows.map((device) => (
                    <div key={device.id} className="px-3 py-2.5 transition-colors hover:bg-[#0f1a30]/60">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-white">{device.name}</div>
                          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[#93c5fd]/42">
                            Site {device.vrm_site_id}
                          </div>
                        </div>
                        <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] ${
                          device.attentionCount > 0
                            ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                            : device.lastObservedAt
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                              : 'border-slate-500/25 bg-slate-500/10 text-slate-300'
                        }`}>
                          {device.attentionCount > 0 ? `${device.attentionCount} issue${device.attentionCount === 1 ? '' : 's'}` : device.lastObservedAt ? 'Reporting' : 'No report'}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-mono text-[#93c5fd]/42">
                        <span>{device.observedCount} observed</span>
                        <span>{device.managedCount} managed</span>
                        <span>{device.staleDiscoveryCount} stale</span>
                        <span>{device.lastObservedAt ? formatAgo(device.lastObservedAt) : 'never'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-2 text-[9px] text-[#93c5fd]/35">
              Showing {visibleFleetRows.length} of {filteredFleetRows.length} matching trailers. Use search to narrow large fleets.
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#1e3a5f]/70 bg-[#0b1323] p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-xs font-bold uppercase tracking-[0.28em] text-[#93c5fd]/72">Secure Router LAN Probe</h3>
            <p className="mt-2 text-[11px] leading-relaxed text-[#93c5fd]/52">
              Admin-only live test. The server logs into the linked Teltonika router, checks modem health, probes LAN inventory endpoints, and saves discovered hosts when a working endpoint is found.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto] xl:w-[34rem]">
            <select
              value={diagnosticDeviceId}
              onChange={(event) => setDiagnosticDeviceId(event.target.value)}
              disabled={devices.length === 0 || diagnosticBusy}
              className="w-full rounded-lg border border-[#1e3a5f] bg-[#080c14] px-3 py-2.5 text-xs text-white outline-none transition-colors focus:border-[#3b82f6] disabled:opacity-45"
            >
              {devices.length === 0 ? (
                <option value="">No trailers registered</option>
              ) : (
                devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} - Site {device.vrm_site_id}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={runLanDiagnostic}
              disabled={!diagnosticDeviceId || diagnosticBusy}
              className="rounded-lg border border-[#3b82f6]/45 bg-[#2563eb]/18 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#bfdbfe] transition-all hover:border-[#60a5fa] hover:bg-[#2563eb]/28 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {diagnosticBusy ? 'Probing' : 'Run Probe'}
            </button>
          </div>
        </div>

        {diagnosticError && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-200">
            {diagnosticError}
          </div>
        )}

        {diagnosticResult && (
          <div className="mt-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                { label: 'Modem Report', value: diagnosticResult.modemReportSaved ? 'Saved' : 'No signal row' },
                { label: 'LAN Hosts', value: String(diagnosticResult.lanDeviceCount) },
                { label: 'Inventory Writes', value: String(diagnosticResult.discovered) },
                { label: 'Managed Updates', value: String(diagnosticResult.updated + diagnosticResult.markedOffline) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-[#1e3a5f]/60 bg-[#080c14]/80 px-3 py-2">
                  <div className="text-sm font-black text-white">{item.value}</div>
                  <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-[#93c5fd]/42">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[#1e3a5f]/55 bg-[#080c14]/70 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/62">
                  Endpoint Proof - {diagnosticResult.device.name}
                </div>
                <div className="font-mono text-[9px] text-[#93c5fd]/38">{formatAgo(diagnosticResult.observedAt)}</div>
              </div>
              <div className="grid gap-2 lg:grid-cols-2">
                {diagnosticResult.endpointResults.map((endpoint) => (
                  <div
                    key={endpoint.path}
                    className={`rounded-lg border px-3 py-2 ${
                      endpoint.deviceCount > 0
                        ? 'border-emerald-500/30 bg-emerald-500/10'
                        : endpoint.ok
                          ? 'border-amber-500/20 bg-amber-500/10'
                          : 'border-rose-500/20 bg-rose-500/10'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-white">{endpoint.path}</span>
                      <span className="rounded-full border border-[#1e3a5f]/70 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-[#93c5fd]/60">
                        {endpoint.deviceCount > 0 ? `${endpoint.deviceCount} host${endpoint.deviceCount === 1 ? '' : 's'}` : endpoint.ok ? 'No hosts' : 'Failed'}
                      </span>
                    </div>
                    <div className="mt-1 text-[9px] leading-relaxed text-[#93c5fd]/42">
                      {endpoint.ok
                        ? `${endpoint.status ?? 'OK'} in ${endpoint.elapsedMs}ms - ${endpoint.bodyShape}`
                        : `${endpoint.error ?? 'Unavailable'} - ${endpoint.elapsedMs}ms`}
                    </div>
                    {endpoint.sampleKeys.length > 0 && (
                      <div className="mt-2 line-clamp-2 text-[8px] uppercase tracking-[0.12em] text-[#93c5fd]/30">
                        Keys: {endpoint.sampleKeys.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {diagnosticResult.lanDeviceCount === 0 && (
                <p className="mt-3 text-[10px] leading-relaxed text-amber-200/72">
                  The router login and modem path may still be valid, but LAN attached-device discovery needs the exact RutOS client endpoint in TELTONIKA_LAN_CLIENTS_PATHS.
                </p>
              )}
              {diagnosticResult.warnings.length > 0 && (
                <p className="mt-2 text-[10px] leading-relaxed text-[#93c5fd]/42">
                  Warnings: {diagnosticResult.warnings.join(' | ')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <form action={addManagedNetworkDevice} className="space-y-4 rounded-2xl border border-[#1e3a5f]/70 bg-[#0b1323] p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#93c5fd]/75">Trailer</label>
            <select
              name="vrm_device_id"
              required
              className="w-full rounded-lg border border-[#1e3a5f] bg-[#080c14] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#3b82f6]"
              defaultValue={devices.length === 1 ? String(devices[0].id) : ''}
              disabled={devices.length === 0}
            >
              <option value="" disabled>Select trailer</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} - Site {device.vrm_site_id}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#93c5fd]/75">Device Label</label>
            <input
              name="name"
              required
              disabled={devices.length === 0}
              className="w-full rounded-lg border border-[#1e3a5f] bg-[#080c14] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-[#93c5fd]/20 focus:border-[#3b82f6]"
              placeholder="Camera switch, LTE radio, NVR, gateway"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#93c5fd]/75">IP Address</label>
            <input
              name="ip_address"
              required
              disabled={devices.length === 0}
              className="w-full rounded-lg border border-[#1e3a5f] bg-[#080c14] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-[#93c5fd]/20 focus:border-[#3b82f6]"
              placeholder="192.168.1.50"
              inputMode="decimal"
            />
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-[#1e3a5f]/70 bg-[#080c14]/90 px-4 py-3 text-[11px] text-[#93c5fd]/78">
            <input type="checkbox" name="alert_on_offline" defaultChecked className="accent-[#2563eb]" />
            Alert on offline
          </label>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-[10px] leading-relaxed text-[#93c5fd]/45">
            Keep the target list small and intentional. Operators scan faster when only mission-critical endpoints appear here.
          </p>
          <button
            type="submit"
            disabled={devices.length === 0}
            className="flex-shrink-0 rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-bold text-white transition-all hover:bg-[#3b82f6] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[#2563eb] disabled:hover:shadow-none"
          >
            Add Managed Device
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-[#1e3a5f]/70 bg-[#0b1323]">
        <div className="flex items-center justify-between border-b border-[#1e3a5f]/60 px-4 py-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.28em] text-[#93c5fd]/72">Current Targets</h3>
            <p className="mt-1 text-[10px] text-[#93c5fd]/45">Exceptions should surface quickly without requiring the operator to parse a dense table.</p>
          </div>
        </div>

        {managedDevices.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-[#93c5fd]/55">No managed LAN targets configured yet.</p>
            <p className="mt-2 text-[11px] text-[#93c5fd]/38">Start with the most failure-sensitive devices on each trailer rather than every host on the subnet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1e3a5f]/45">
            {orderedManagedDevices.map((device) => {
              const state = statusPresentation(device);
              return (
                <div key={device.id} className="flex items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-[#0f1a30]/55">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-sm font-bold text-white">{device.name}</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${state.classes}`}>
                        {state.label}
                      </span>
                      {device.alertOnOffline && (
                        <span className="inline-flex items-center rounded-full border border-[#f59e0b]/20 bg-[#f59e0b]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                          Alerted
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-[#93c5fd]/58">
                      {device.parentName} - Site {device.parentSiteId}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono text-[#93c5fd]/45">
                      <span>{device.ipAddress}</span>
                      <span>{formatAgo(device.lastReportedAt)}</span>
                      {typeof device.lastLatencyMs === 'number' && <span>{device.lastLatencyMs} ms</span>}
                      {device.lastDetail && <span className="max-w-[24rem] truncate">{device.lastDetail}</span>}
                    </div>
                  </div>

                  <form action={deleteManagedNetworkDevice}>
                    <input type="hidden" name="id" value={device.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-[#1e3a5f]/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#93c5fd]/58 transition-all hover:border-[#ef4444]/50 hover:bg-[#ef4444]/10 hover:text-white"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#1e3a5f]/70 bg-[#0b1323]">
        <div className="flex items-center justify-between border-b border-[#1e3a5f]/60 px-4 py-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.28em] text-[#93c5fd]/72">Observed LAN Inventory</h3>
            <p className="mt-1 text-[10px] text-[#93c5fd]/45">Hosts reported by the Cerbo from the trailer LAN. Promote only the ones that should alert.</p>
          </div>
        </div>

        {discoveredDevices.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-[#93c5fd]/55">No LAN hosts reported yet.</p>
            <p className="mt-2 text-[11px] text-[#93c5fd]/38">Inventory appears after the Cerbo reporter posts its first scan.</p>
          </div>
        ) : unmanagedDiscoveries.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-[#93c5fd]/55">All observed hosts are already managed.</p>
            <p className="mt-2 text-[11px] text-[#93c5fd]/38">New hosts will appear here when the Cerbo sees them on the LAN.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1e3a5f]/45">
            {unmanagedDiscoveries.map((device) => (
              <div key={device.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-sm font-bold text-white">{device.hostname || device.ipAddress}</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${statusClasses(device.lastStatus)}`}>
                    {statusLabel(device.lastStatus)}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-[#93c5fd]/58">
                  {device.parentName} - Site {device.parentSiteId}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono text-[#93c5fd]/45">
                  <span>{device.ipAddress}</span>
                  {device.macAddress && <span>{device.macAddress}</span>}
                  <span>{formatAgo(device.lastSeenAt)}</span>
                  {typeof device.lastLatencyMs === 'number' && <span>{device.lastLatencyMs} ms</span>}
                </div>
                <form action={promoteDiscoveredNetworkDevice} className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                  <input type="hidden" name="id" value={device.id} />
                  <input
                    name="name"
                    className="min-w-0 rounded-lg border border-[#1e3a5f] bg-[#080c14] px-3 py-2 text-xs text-white outline-none transition-colors placeholder:text-[#93c5fd]/20 focus:border-[#3b82f6]"
                    defaultValue={device.hostname || ''}
                    placeholder="Label before promoting"
                  />
                  <label className="flex items-center gap-2 rounded-lg border border-[#1e3a5f]/70 px-3 py-2 text-[10px] text-[#93c5fd]/62">
                    <input type="checkbox" name="alert_on_offline" defaultChecked className="accent-[#2563eb]" />
                    Alert
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300 transition-all hover:border-emerald-400/60 hover:bg-emerald-500/15 hover:text-white md:col-span-2"
                  >
                    Promote to Managed Target
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
        </div>
      )}
    </div>
  );
}
