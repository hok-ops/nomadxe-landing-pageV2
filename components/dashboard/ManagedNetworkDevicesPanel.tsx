'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  cellularSignalTone,
  getManagedDeviceSummary,
  type CellularSignalReport,
  type DiscoveredNetworkDevice,
  type ManagedNetworkDevice,
} from '@/lib/networkDevices';
import { usePageActivity } from './usePageActivity';

const STALE_AFTER_MS = 10 * 60_000;

function formatAgo(value: string | null) {
  if (!value) return 'No check-in yet';
  const ms = Date.now() - Date.parse(value);
  if (!Number.isFinite(ms) || ms < 0) return 'Unknown';
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isManagedStale(device: ManagedNetworkDevice) {
  if (!device.lastReportedAt) return true;
  const lastReportedMs = Date.parse(device.lastReportedAt);
  return !Number.isFinite(lastReportedMs) || (Date.now() - lastReportedMs) > STALE_AFTER_MS;
}

function isDiscoveryStale(device: DiscoveredNetworkDevice) {
  const lastSeenMs = Date.parse(device.lastSeenAt);
  return !Number.isFinite(lastSeenMs) || (Date.now() - lastSeenMs) > STALE_AFTER_MS;
}

function deviceKey(device: Pick<ManagedNetworkDevice | DiscoveredNetworkDevice, 'vrmDeviceId' | 'ipAddress'>) {
  return `${device.vrmDeviceId}:${device.ipAddress}`;
}

function ipSortValue(ipAddress: string) {
  const parts = ipAddress.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return Number.MAX_SAFE_INTEGER;
  return parts.reduce((acc, part) => (acc * 256) + part, 0);
}

function observedState(device: DiscoveredNetworkDevice) {
  if (device.lastStatus === 'offline') {
    return {
      label: 'Offline',
      tone: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
      detail: 'Router scan reported no response',
      rank: 0,
    };
  }

  if (isDiscoveryStale(device)) {
    return {
      label: 'Stale',
      tone: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
      detail: 'No recent router observation',
      rank: 1,
    };
  }

  if (device.lastStatus === 'online') {
    return {
      label: 'Online',
      tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
      detail: 'Observed on the trailer LAN',
      rank: 2,
    };
  }

  return {
    label: 'Unknown',
    tone: 'border-slate-500/20 bg-slate-500/10 text-slate-300',
    detail: 'Waiting for a definitive scan result',
    rank: 3,
  };
}

function managedState(device: ManagedNetworkDevice) {
  if (device.lastStatus === 'offline') {
    return {
      label: 'Offline',
      tone: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
      detail: 'Alert target did not respond',
    };
  }

  if (isManagedStale(device)) {
    return {
      label: 'Check overdue',
      tone: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
      detail: 'Router inventory has not reported this alert target recently',
    };
  }

  return {
    label: 'Covered',
    tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    detail: 'Alert target is healthy',
  };
}

function formatSignal(value: number | null, unit: string) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}${unit}` : 'Not reported';
}

function signalBadge(tone: ReturnType<typeof cellularSignalTone>) {
  if (tone === 'good') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  if (tone === 'fair') return 'border-sky-500/20 bg-sky-500/10 text-sky-300';
  if (tone === 'watch') return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  if (tone === 'poor') return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  return 'border-slate-500/20 bg-slate-500/10 text-slate-300';
}

function sortObservedDevices(a: DiscoveredNetworkDevice, b: DiscoveredNetworkDevice) {
  const stateDelta = observedState(a).rank - observedState(b).rank;
  if (stateDelta !== 0) return stateDelta;
  if (a.isManaged !== b.isManaged) return a.isManaged ? -1 : 1;
  return ipSortValue(a.ipAddress) - ipSortValue(b.ipAddress);
}

export default function ManagedNetworkDevicesPanel({
  siteId,
  onInventoryChange,
}: {
  siteId: string;
  onInventoryChange?: (inventory: {
    managedDevices: ManagedNetworkDevice[];
    discoveredDevices: DiscoveredNetworkDevice[];
  }) => void;
}) {
  const [managedDevices, setManagedDevices] = useState<ManagedNetworkDevice[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredNetworkDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAllObserved, setShowAllObserved] = useState(false);
  const [cellularReport, setCellularReport] = useState<CellularSignalReport | null>(null);
  const [cellularMessage, setCellularMessage] = useState<string | null>(null);
  const [requestingCellular, setRequestingCellular] = useState(false);
  const [cellularRequestWatchUntil, setCellularRequestWatchUntil] = useState<number | null>(null);
  const pageActive = usePageActivity();

  const loadCellularReport = useCallback(async () => {
    const cellularResponse = await fetch(`/api/devices/${siteId}/cellular-report`, { cache: 'no-store' });
    if (!cellularResponse.ok) return false;
    const cellularPayload = await cellularResponse.json();
    setCellularReport(cellularPayload.report ?? null);
    return Boolean(cellularPayload.report);
  }, [siteId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!pageActive) return;
      try {
        const response = await fetch(`/api/devices/${siteId}/managed-network`, { cache: 'no-store' });
        if (!response.ok) {
          if (!cancelled) setLoadError('LAN inventory could not be loaded for this site.');
          return;
        }
        const payload = await response.json();
        if (cancelled) return;
        const nextManagedDevices = Array.isArray(payload.devices) ? payload.devices : [];
        const nextDiscoveredDevices = Array.isArray(payload.discoveredDevices) ? payload.discoveredDevices : [];
        setLoadError(null);
        setManagedDevices(nextManagedDevices);
        setDiscoveredDevices(nextDiscoveredDevices);
        onInventoryChange?.({
          managedDevices: nextManagedDevices,
          discoveredDevices: nextDiscoveredDevices,
        });
        if (!cancelled) await loadCellularReport();
      } catch {
        if (!cancelled) setLoadError('Network error while loading LAN inventory.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [siteId, onInventoryChange, pageActive, loadCellularReport]);

  useEffect(() => {
    if (!cellularRequestWatchUntil || !pageActive) return;
    let cancelled = false;

    const id = setInterval(async () => {
      if (Date.now() > cellularRequestWatchUntil) {
        setCellularRequestWatchUntil(null);
        return;
      }

      const found = await loadCellularReport().catch(() => false);
      if (!cancelled && found) {
        setCellularMessage('Router signal metrics received and updated.');
        setCellularRequestWatchUntil(null);
      }
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [cellularRequestWatchUntil, loadCellularReport, pageActive]);

  const managedByKey = new Map(managedDevices.map((device) => [deviceKey(device), device]));
  const orderedObserved = [...discoveredDevices].sort(sortObservedDevices);
  const visibleObserved = showAllObserved ? orderedObserved : orderedObserved.slice(0, 8);
  const managedSummary = getManagedDeviceSummary(managedDevices, STALE_AFTER_MS);
  const alertingAttention = managedDevices.filter(
    (device) => device.lastStatus === 'offline' || isManagedStale(device)
  );
  const observedAttention = orderedObserved.filter(
    (device) => device.lastStatus === 'offline' || isDiscoveryStale(device)
  );
  const attentionKeys = new Set<string>([
    ...alertingAttention.map(deviceKey),
    ...observedAttention.map(deviceKey),
  ]);
  const hasExceptions = attentionKeys.size > 0;
  const hasAnyInventory = orderedObserved.length > 0 || managedDevices.length > 0;
  const signalTone = cellularSignalTone(cellularReport);

  async function requestCellularReading() {
    setRequestingCellular(true);
    setCellularMessage(null);
    try {
      const response = await fetch(`/api/devices/${siteId}/cellular-report`, { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCellularMessage(payload?.error ?? 'Could not request the cellular signal reading.');
        return;
      }
      setCellularRequestWatchUntil(Date.now() + 90_000);
      setCellularMessage(
        payload?.warning ??
        (payload?.automationQueued
          ? 'Router network scan requested. Waiting for cellular metrics and LAN clients to post back.'
          : 'Router network scan was logged. Automation is not configured yet, so metrics will appear after a collector posts them.')
      );
      void loadCellularReport();
    } catch {
      setCellularMessage('Network error while requesting the cellular signal reading.');
    } finally {
      setRequestingCellular(false);
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#1e3a5f]/65 bg-[linear-gradient(180deg,rgba(8,12,20,0.88),rgba(10,16,30,0.96))]">
      <div className="border-b border-[#1e3a5f]/45 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className={`h-2 w-2 rounded-full ${hasExceptions ? 'bg-rose-400' : hasAnyInventory ? 'bg-emerald-400' : 'bg-sky-400'}`} />
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">LAN Device Inventory</h3>
            </div>
            <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-[#93c5fd]/56">
              Teltonika router LAN clients appear automatically after a network scan. Promote only mission-critical hosts into managed targets when they should trigger alerts.
            </p>
          </div>
          <div className="grid min-w-[250px] grid-cols-3 gap-2">
            {[
              { label: 'Observed', value: orderedObserved.length, tone: 'text-sky-200' },
              { label: 'Managed', value: managedSummary.total, tone: 'text-emerald-300' },
              { label: 'Attention', value: attentionKeys.size, tone: hasExceptions ? 'text-rose-300' : 'text-[#93c5fd]/45' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[#1e3a5f]/60 bg-[#080c14]/88 px-3 py-2 text-center">
                <div className={`text-sm font-black ${item.tone}`}>{loading ? '--' : item.value}</div>
                <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/40">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-3 sm:px-5">
        <div className="rounded-xl border border-[#1e3a5f]/45 bg-[#0b1323]/62 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className={`h-2 w-2 rounded-full ${signalTone === 'poor' ? 'bg-rose-400' : signalTone === 'watch' ? 'bg-amber-400' : signalTone === 'unknown' ? 'bg-slate-400' : 'bg-emerald-400'}`} />
                <h4 className="text-[10px] font-black uppercase tracking-[0.24em] text-white">Cellular Signal Health</h4>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] ${signalBadge(signalTone)}`}>
                  {signalTone === 'unknown' ? 'No report' : signalTone}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#93c5fd]/56">
                Shows the latest cellular quality from the Teltonika router. SINR is signal quality, RSRP is signal strength, and RSRQ is connection quality.
              </p>
            </div>
            <button
              type="button"
              onClick={requestCellularReading}
              disabled={requestingCellular}
              className="rounded-lg border border-[#2563eb]/45 bg-[#1e40af]/24 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#bfdbfe] transition-colors hover:border-[#60a5fa]/65 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {requestingCellular ? 'Requesting' : 'Request Network Scan'}
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {[
              ['SINR', formatSignal(cellularReport?.sinrDb ?? null, ' dB')],
              ['RSRP', formatSignal(cellularReport?.rsrpDbm ?? null, ' dBm')],
              ['RSRQ', formatSignal(cellularReport?.rsrqDb ?? null, ' dB')],
              ['RSSI', formatSignal(cellularReport?.rssiDbm ?? null, ' dBm')],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-[#1e3a5f]/42 bg-[#080c14]/62 px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/42">{label}</div>
                <div className="mt-1 text-sm font-black text-white">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#93c5fd]/52">
            <span>Last report: {cellularReport ? formatAgo(cellularReport.observedAt) : 'not available'}</span>
            {cellularReport?.operator && <span>Carrier: {cellularReport.operator}</span>}
            {cellularReport?.networkType && <span>Network: {cellularReport.networkType}</span>}
            {cellularReport?.band && <span>Band: {cellularReport.band}</span>}
          </div>
          {cellularMessage && (
            <div className="mt-2 rounded-lg border border-[#1e3a5f]/42 bg-[#080c14]/62 px-3 py-2 text-[11px] text-[#bfdbfe]/70">
              {cellularMessage}
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-3 text-[11px] text-[#93c5fd]/48">Loading router LAN inventory...</div>
        ) : loadError ? (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-5 text-center">
            <div className="text-sm font-bold text-rose-200">LAN inventory unavailable</div>
            <p className="mx-auto mt-2 max-w-xl text-[11px] leading-relaxed text-rose-100/70">
              {loadError} The dashboard will retry automatically while this tile stays open.
            </p>
          </div>
        ) : !hasAnyInventory ? (
          <div className="rounded-xl border border-[#1e3a5f]/35 bg-[#0b1323]/62 px-4 py-5 text-center">
            <div className="text-sm font-bold text-white">Waiting for the first router LAN scan</div>
            <p className="mx-auto mt-2 max-w-xl text-[11px] leading-relaxed text-[#93c5fd]/52">
              No LAN inventory has been received for this site yet. Devices appear here after the Teltonika reporter posts a successful scan with the matching VRM site ID and ingest token.
            </p>
          </div>
        ) : (
          <>
            {alertingAttention.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.24em] text-rose-200">Alerting Targets</h4>
                    <p className="mt-1 text-[11px] text-[#93c5fd]/52">
                      Managed devices that are offline or overdue are surfaced first.
                    </p>
                  </div>
                  <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-rose-300">
                    {alertingAttention.length} issue{alertingAttention.length === 1 ? '' : 's'}
                  </span>
                </div>

                {alertingAttention.map((device) => {
                  const state = managedState(device);
                  return (
                    <div key={device.id} className="flex items-start justify-between gap-4 rounded-xl border border-[#1e3a5f]/40 bg-[#0b1323]/85 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-sm font-bold text-white">{device.name}</span>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${state.tone}`}>
                            {state.label}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-[#93c5fd]/60">{state.detail}</div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-[#93c5fd]/45">
                          <span>{device.ipAddress}</span>
                          <span>{formatAgo(device.lastReportedAt)}</span>
                          {typeof device.lastLatencyMs === 'number' && <span>{device.lastLatencyMs} ms</span>}
                        </div>
                      </div>
                      {device.alertOnOffline && (
                        <span className="inline-flex flex-shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300">
                          Alerts
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-200">Observed Devices</h4>
                  <p className="mt-1 text-[11px] text-[#93c5fd]/52">
                    Full router-discovered inventory. Observed-only devices are visible but do not alert.
                  </p>
                </div>
                {orderedObserved.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setShowAllObserved((value) => !value)}
                    className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/58 transition-colors hover:text-white"
                  >
                    {showAllObserved ? 'Show fewer' : `Show all ${orderedObserved.length}`}
                  </button>
                )}
              </div>

              <div className="grid gap-2.5 xl:grid-cols-2">
                {visibleObserved.map((device) => {
                  const state = observedState(device);
                  const managedDevice = managedByKey.get(deviceKey(device));
                  const displayName = managedDevice?.name ?? device.hostname ?? 'LAN host';

                  return (
                    <div key={device.id} className="rounded-xl border border-[#1e3a5f]/34 bg-[#0b1323]/72 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-bold text-white">{displayName}</span>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${state.tone}`}>
                              {state.label}
                            </span>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] ${
                              device.isManaged
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                : 'border-sky-500/20 bg-sky-500/10 text-sky-300'
                            }`}>
                              {device.isManaged ? 'Managed' : 'Observed'}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-[#93c5fd]/58">{state.detail}</div>
                        </div>
                        {typeof device.lastLatencyMs === 'number' && (
                          <div className="flex-shrink-0 rounded-lg border border-[#1e3a5f]/40 bg-[#080c14]/70 px-2.5 py-1 text-[10px] font-bold text-[#93c5fd]/70">
                            {device.lastLatencyMs} ms
                          </div>
                        )}
                      </div>

                      <div className="mt-3 grid gap-1 text-[10px] font-mono text-[#93c5fd]/45 sm:grid-cols-2">
                        <span>IP {device.ipAddress}</span>
                        <span>Seen {formatAgo(device.lastSeenAt)}</span>
                        {device.macAddress && <span>MAC {device.macAddress}</span>}
                        {device.hostname && <span>Host {device.hostname}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
