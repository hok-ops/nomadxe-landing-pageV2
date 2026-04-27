'use client';

import { useEffect, useState } from 'react';
import {
  getManagedDeviceSummary,
  type ManagedNetworkDevice,
} from '@/lib/networkDevices';

const STALE_AFTER_MS = 10 * 60_000;

function statusTone(status: ManagedNetworkDevice['lastStatus']) {
  if (status === 'online') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  if (status === 'offline') return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  return 'border-slate-500/20 bg-slate-500/10 text-slate-300';
}

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

function isStale(device: ManagedNetworkDevice) {
  if (!device.lastReportedAt) return true;
  const lastReportedMs = Date.parse(device.lastReportedAt);
  return !Number.isFinite(lastReportedMs) || (Date.now() - lastReportedMs) > STALE_AFTER_MS;
}

function sortForScan(a: ManagedNetworkDevice, b: ManagedNetworkDevice) {
  const aAttention = a.lastStatus === 'offline' || isStale(a) ? 0 : 1;
  const bAttention = b.lastStatus === 'offline' || isStale(b) ? 0 : 1;
  if (aAttention !== bAttention) return aAttention - bAttention;
  if (a.lastStatus !== b.lastStatus) {
    if (a.lastStatus === 'offline') return -1;
    if (b.lastStatus === 'offline') return 1;
  }
  return a.name.localeCompare(b.name);
}

function panelState(device: ManagedNetworkDevice) {
  if (device.lastStatus === 'offline') {
    return {
      label: 'Offline',
      tone: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
      detail: 'No response from target',
    };
  }

  if (isStale(device)) {
    return {
      label: 'Check overdue',
      tone: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
      detail: 'Cerbo has not reported this target recently',
    };
  }

  if (device.lastStatus === 'online') {
    return {
      label: 'Online',
      tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
      detail: 'Recent Cerbo check passed',
    };
  }

  return {
    label: 'Unknown',
    tone: 'border-slate-500/20 bg-slate-500/10 text-slate-300',
    detail: 'Waiting for first Cerbo report',
  };
}

export default function ManagedNetworkDevicesPanel({ siteId }: { siteId: string }) {
  const [devices, setDevices] = useState<ManagedNetworkDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllHealthy, setShowAllHealthy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/devices/${siteId}/managed-network`, { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled) setDevices(Array.isArray(payload.devices) ? payload.devices : []);
      } catch {
        // Keep panel quiet on network failures; the main dashboard owns session UX.
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
  }, [siteId]);

  const orderedDevices = [...devices].sort(sortForScan);
  const summary = getManagedDeviceSummary(orderedDevices, STALE_AFTER_MS);
  const attentionDevices = orderedDevices.filter(
    (device) => device.lastStatus === 'offline' || isStale(device)
  );
  const healthyDevices = orderedDevices.filter(
    (device) => device.lastStatus === 'online' && !isStale(device)
  );
  const visibleHealthyDevices = showAllHealthy ? healthyDevices : healthyDevices.slice(0, 3);
  const hasExceptions = summary.offline > 0 || summary.stale > 0;

  if (!loading && devices.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-[#1e3a5f]/65 bg-[linear-gradient(180deg,rgba(8,12,20,0.88),rgba(10,16,30,0.96))] overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-[#1e3a5f]/45">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className={`h-2 w-2 rounded-full ${hasExceptions ? 'bg-rose-400' : 'bg-emerald-400'}`} />
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Managed LAN Health</h3>
            </div>
            <p className="mt-2 max-w-xl text-[11px] text-[#93c5fd]/56">
              Curated device checks from the Cerbo. Critical targets appear here in an exception-first flow so the operator can scan quickly.
            </p>
          </div>
          <div className="grid min-w-[170px] grid-cols-3 gap-2">
            {[
              { label: 'Healthy', value: summary.online, tone: 'text-emerald-300' },
              { label: 'Offline', value: summary.offline, tone: 'text-rose-300' },
              { label: 'Stale', value: summary.stale, tone: 'text-amber-300' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[#1e3a5f]/60 bg-[#080c14]/88 px-3 py-2 text-center">
                <div className={`text-sm font-black ${item.tone}`}>{loading ? '--' : item.value}</div>
                <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/40">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3 sm:px-5">
        {loading ? (
          <div className="py-3 text-[11px] text-[#93c5fd]/48">Loading managed device status...</div>
        ) : (
          <>
            {attentionDevices.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.24em] text-rose-200">Needs Attention</h4>
                    <p className="mt-1 text-[11px] text-[#93c5fd]/52">
                      Devices that are down or overdue are surfaced first.
                    </p>
                  </div>
                  <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-rose-300">
                    {attentionDevices.length} issue{attentionDevices.length === 1 ? '' : 's'}
                  </span>
                </div>

                {attentionDevices.map((device) => {
                  const state = panelState(device);
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
                        {device.lastDetail && (
                          <div className="mt-2 truncate text-[11px] text-[#93c5fd]/58">{device.lastDetail}</div>
                        )}
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

            {healthyDevices.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200">Healthy Devices</h4>
                    <p className="mt-1 text-[11px] text-[#93c5fd]/52">
                      Stable devices stay visually quiet so the eye remains on exceptions.
                    </p>
                  </div>
                  {healthyDevices.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setShowAllHealthy((value) => !value)}
                      className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/58 transition-colors hover:text-white"
                    >
                      {showAllHealthy ? 'Show fewer' : `Show all ${healthyDevices.length}`}
                    </button>
                  )}
                </div>

                {visibleHealthyDevices.map((device) => (
                  <div key={device.id} className="flex items-start justify-between gap-4 rounded-xl border border-[#1e3a5f]/30 bg-[#0b1323]/72 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-sm font-bold text-white">{device.name}</span>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${statusTone(device.lastStatus)}`}>
                          online
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-[#93c5fd]/45">
                        <span>{device.ipAddress}</span>
                        <span>{formatAgo(device.lastReportedAt)}</span>
                        {typeof device.lastLatencyMs === 'number' && <span>{device.lastLatencyMs} ms</span>}
                      </div>
                    </div>
                    {device.alertOnOffline && (
                      <span className="inline-flex flex-shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                        Covered
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
