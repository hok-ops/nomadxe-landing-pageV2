'use client';

import { useMemo, useState } from 'react';
import { Gauge, Info, ShieldCheck, X } from 'lucide-react';

const FLEET_SIZE_EXAMPLE = 38;
const VRM_SNAPSHOT_CALLS_PER_TRAILER = 3;
const VRM_DETAIL_CALLS_PER_TRAILER = 11;
const VRM_REFILL_PER_SECOND = 3;
const VRM_BURST_CAPACITY = 90;
const VRM_MAX_CONCURRENT = 8;
const SNAPSHOT_CACHE_SECONDS = 45;
const DETAIL_CACHE_SECONDS = 120;

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

export function ApiStructureGuide() {
  const [open, setOpen] = useState(false);
  const calculations = useMemo(() => {
    const snapshotBurst = FLEET_SIZE_EXAMPLE * VRM_SNAPSHOT_CALLS_PER_TRAILER;
    const normalPerMinute = snapshotBurst / 5;
    const watchPerMinute = snapshotBurst / 2;
    const incidentPerMinute = snapshotBurst;
    const conservativeMinuteBudget = VRM_REFILL_PER_SECOND * 60;
    const excessAfterBurst = Math.max(0, snapshotBurst - VRM_BURST_CAPACITY);
    const addedWaitSeconds = excessAfterBurst / VRM_REFILL_PER_SECOND;

    return {
      snapshotBurst,
      normalPerMinute,
      watchPerMinute,
      incidentPerMinute,
      conservativeMinuteBudget,
      addedWaitSeconds,
      detailBurst: VRM_DETAIL_CALLS_PER_TRAILER,
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-[#1e3a5f] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#93c5fd]/75 transition-colors hover:border-[#3b82f6]/60 hover:text-white"
      >
        <Info className="h-3.5 w-3.5" />
        API Design
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-[#1e3a5f] bg-[#080c14] text-[#bfdbfe] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#1e3a5f] px-5 py-4">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#60a5fa]">
                  <ShieldCheck className="h-4 w-4" />
                  API Structure, Quotas, And Safety Design
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">How NomadXE protects live telemetry APIs</h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#bfdbfe]/72">
                  The portal does not ask Victron, Supabase, weather, or automation services for everything all the time.
                  It prioritizes live operational clarity while avoiding wasteful polling and provider lockouts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-[#1e3a5f] p-2 text-[#93c5fd]/70 transition-colors hover:border-[#3b82f6]/70 hover:text-white"
                aria-label="Close API design guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(88vh-7rem)] overflow-auto px-5 py-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-[#1e3a5f]/50 bg-[#0d1526] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/55">Victron snapshot</div>
                  <div className="mt-2 text-2xl font-black text-white">{VRM_SNAPSHOT_CALLS_PER_TRAILER} calls</div>
                  <p className="mt-2 text-xs leading-relaxed text-[#bfdbfe]/65">
                    One dashboard reading uses diagnostics, short history, and GPS. That gives the tile enough context without loading every VRM widget.
                  </p>
                </div>
                <div className="rounded-xl border border-[#1e3a5f]/50 bg-[#0d1526] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/55">Detail view</div>
                  <div className="mt-2 text-2xl font-black text-white">about {VRM_DETAIL_CALLS_PER_TRAILER} calls</div>
                  <p className="mt-2 text-xs leading-relaxed text-[#bfdbfe]/65">
                    Rich data only loads when a trailer is opened. This is progressive disclosure for both users and APIs.
                  </p>
                </div>
                <div className="rounded-xl border border-[#1e3a5f]/50 bg-[#0d1526] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/55">Governor</div>
                  <div className="mt-2 text-2xl font-black text-white">{VRM_MAX_CONCURRENT} max</div>
                  <p className="mt-2 text-xs leading-relaxed text-[#bfdbfe]/65">
                    The server caps simultaneous VRM requests and uses a token budget that refills at {VRM_REFILL_PER_SECOND} requests per second.
                  </p>
                </div>
              </div>

              <section className="mt-5 rounded-2xl border border-[#1e3a5f]/55 bg-[#0b1323]/70 p-5">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#60a5fa]">
                  <Gauge className="h-4 w-4" />
                  Current VRM Math
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-[#1e3a5f]/35 bg-[#080c14]/80 p-4">
                    <div className="text-sm font-bold text-white">Example: {FLEET_SIZE_EXAMPLE} trailers</div>
                    <p className="mt-2 text-xs leading-relaxed text-[#bfdbfe]/68">
                      A full fleet snapshot is {FLEET_SIZE_EXAMPLE} trailers x {VRM_SNAPSHOT_CALLS_PER_TRAILER} calls ={' '}
                      <span className="font-bold text-white">{calculations.snapshotBurst} VRM calls</span>.
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-[#bfdbfe]/68">
                      The burst bucket holds {VRM_BURST_CAPACITY} calls. The remaining {calculations.snapshotBurst - VRM_BURST_CAPACITY} calls wait about{' '}
                      {formatNumber(calculations.addedWaitSeconds)} seconds at {VRM_REFILL_PER_SECOND}/sec instead of stampeding VRM.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#1e3a5f]/35 bg-[#080c14]/80 p-4">
                    <div className="text-sm font-bold text-white">Refresh pressure</div>
                    <ul className="mt-2 space-y-2 text-xs leading-relaxed text-[#bfdbfe]/68">
                      <li>Normal 5-minute refresh: about {formatNumber(calculations.normalPerMinute)} calls/min.</li>
                      <li>Watch 2-minute refresh: about {formatNumber(calculations.watchPerMinute)} calls/min.</li>
                      <li>Incident 1-minute refresh: about {formatNumber(calculations.incidentPerMinute)} calls/min.</li>
                      <li>Conservative budget: about {calculations.conservativeMinuteBudget} calls/min.</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[#1e3a5f]/55 bg-[#0b1323]/70 p-5">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.24em] text-white">Plain-English Flow</h3>
                  <ol className="mt-3 space-y-3 text-sm leading-relaxed text-[#bfdbfe]/72">
                    <li>1. The dashboard loads a small snapshot for each assigned trailer.</li>
                    <li>2. The server reuses fresh answers for {SNAPSHOT_CACHE_SECONDS} seconds so multiple users or tabs do not duplicate the same VRM calls.</li>
                    <li>3. Opening a trailer loads deeper VRM widgets, cached for {DETAIL_CACHE_SECONDS} seconds.</li>
                    <li>4. If the fleet is healthy, polling stays slow. If there is a watch or incident state, polling gets faster but still goes through the governor.</li>
                  </ol>
                </div>
                <div className="rounded-2xl border border-[#1e3a5f]/55 bg-[#0b1323]/70 p-5">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.24em] text-white">Provider Limits To Respect</h3>
                  <ul className="mt-3 space-y-3 text-sm leading-relaxed text-[#bfdbfe]/72">
                    <li>Victron VRM: design around roughly 3 requests/sec average and avoid large repeated bursts.</li>
                    <li>Open-Meteo: free tier is generous, but production commercial use should use a customer API key.</li>
                    <li>Nominatim: absolute maximum is 1 request/sec per application; cache all geocoding.</li>
                    <li>Supabase Auth: email/reset limits are strict unless custom SMTP is configured.</li>
                    <li>Forms: requests are stored first-party; optional external forwarding is not part of the critical path.</li>
                  </ul>
                </div>
              </section>

              <section className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-5">
                <h3 className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-300">Operational Rule</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#d1fae5]/85">
                  If the portal ever shows stale telemetry, it should fail calm: keep the last trusted reading visible, tell the user when it was last updated,
                  and avoid repeatedly hammering upstream APIs. Trust is built by being honest about freshness, not by forcing refreshes.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
