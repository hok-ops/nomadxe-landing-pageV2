type AdminCorrelationDevice = {
  id: number;
  name: string;
  siteId: string;
  assignmentCount: number;
  managedAttention: number;
  latestCellularAt: string | null;
  openTickets: number;
  openRecommendations: number;
  openFirmware: number;
  latestReportDate: string | null;
};

type AdminCorrelationCounts = {
  openFormSubmissions: number;
  routerAttention: number;
  openTickets: number;
  openRecommendations: number;
  openFirmware: number;
  reportsNeedingReview: number;
  devicesWithRecentCellular: number;
  totalDevices: number;
};

const CELLULAR_FRESH_MS = 30 * 60_000;

function formatAgo(value: string | null) {
  if (!value) return 'No signal report';
  const ms = Date.now() - Date.parse(value);
  if (!Number.isFinite(ms) || ms < 0) return 'Unknown age';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function reportFreshness(value: string | null) {
  if (!value) {
    return {
      label: 'No router signal',
      className: 'border-slate-500/25 bg-slate-500/10 text-slate-300',
      score: 1,
    };
  }

  const lastMs = Date.parse(value);
  if (!Number.isFinite(lastMs) || Date.now() - lastMs > CELLULAR_FRESH_MS) {
    return {
      label: 'Signal stale',
      className: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
      score: 2,
    };
  }

  return {
    label: 'Signal current',
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    score: 0,
  };
}

function devicePriority(device: AdminCorrelationDevice) {
  const freshness = reportFreshness(device.latestCellularAt).score;
  return (
    device.managedAttention * 4 +
    device.openTickets * 3 +
    (device.openRecommendations + device.openFirmware) * 2 +
    freshness
  );
}

function toneClass(tone: 'normal' | 'watch' | 'action') {
  if (tone === 'action') return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  if (tone === 'watch') return 'border-sky-500/30 bg-sky-500/10 text-sky-200';
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';
}

function valueTone(value: number) {
  if (value > 0) return 'text-amber-300';
  return 'text-emerald-300';
}

export function AdminCorrelationPanel({
  devices,
  counts,
}: {
  devices: AdminCorrelationDevice[];
  counts: AdminCorrelationCounts;
}) {
  const devicesNeedingFollowUp = devices.filter((device) => devicePriority(device) > 0);
  const topDevices = devicesNeedingFollowUp
    .sort((a, b) => {
      const priorityDelta = devicePriority(b) - devicePriority(a);
      if (priorityDelta !== 0) return priorityDelta;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 8);
  const cellularCoveragePercent =
    counts.totalDevices > 0 ? Math.round((counts.devicesWithRecentCellular / counts.totalDevices) * 100) : 0;
  const intelligenceOpen = counts.openRecommendations + counts.openFirmware + counts.reportsNeedingReview;
  const workstreams = [
    {
      label: 'Router visibility',
      customerSurface: 'Cellular signal, LAN inventory, and device health context',
      adminSurface: 'LAN Device Operations',
      signal:
        counts.routerAttention > 0
          ? `${counts.routerAttention} managed LAN target${counts.routerAttention === 1 ? '' : 's'} need review`
          : `${cellularCoveragePercent}% of registered trailers have a recent cellular signal report`,
      action: 'Run a targeted network scan, then promote only mission-critical hosts into managed alerts.',
      href: '#lan-device-operations',
      tone: counts.routerAttention > 0 ? 'action' : 'normal',
    },
    {
      label: 'Customer requests',
      customerSurface: 'Contact, order, relocation, and deactivation forms',
      adminSurface: 'Form Intake',
      signal:
        counts.openFormSubmissions > 0
          ? `${counts.openFormSubmissions} first-party request${counts.openFormSubmissions === 1 ? '' : 's'} in the ledger`
          : 'No captured form requests need admin handling right now',
      action: 'Triage submissions from the internal ledger before relying on any optional forwarding tool.',
      href: '#form-intake',
      tone: counts.openFormSubmissions > 0 ? 'watch' : 'normal',
    },
    {
      label: 'Intelligence follow-up',
      customerSurface: 'Historical reports, service tickets, firmware notices, and recommendations',
      adminSurface: 'Operations Queue',
      signal:
        counts.openTickets + intelligenceOpen > 0
          ? `${counts.openTickets + intelligenceOpen} operator item${counts.openTickets + intelligenceOpen === 1 ? '' : 's'} open`
          : 'Reports and recommendations are clear',
      action: 'Review tickets and advisories together so customer-visible reports do not outpace admin action.',
      href: '#operations-queue',
      tone: counts.openTickets + intelligenceOpen > 0 ? 'action' : 'normal',
    },
    {
      label: 'Free-plan capacity',
      customerSurface: 'Reliable portal experience and report history',
      adminSurface: 'Database Growth Watch',
      signal: 'Operational records are measured against Supabase free-plan storage pressure',
      action: 'Keep Postgres for searchable telemetry and forms; avoid binary evidence until object storage is ready.',
      href: '#storage-guardrails',
      tone: 'watch',
    },
  ] as const;

  return (
    <section className="mb-10 overflow-hidden rounded-2xl border border-[#1e3a5f] bg-[#0d1526]">
      <div className="border-b border-[#1e3a5f]/60 px-5 py-4">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.34em] text-[#93c5fd]/70">
              Admin-Customer Correlation
            </div>
            <h2 className="mt-2 text-xl font-black text-white">One Signal, One Owner, One Next Step</h2>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-[#93c5fd]/65">
              This layer ties customer-facing dashboard signals to the exact admin surface that owns the response. It keeps
              intelligence useful by turning reports, requests, router scans, and storage limits into visible operator work.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-4 xl:w-[34rem]">
            {[
              ['Follow-up', devicesNeedingFollowUp.length, valueTone(devicesNeedingFollowUp.length)],
              ['Forms', counts.openFormSubmissions, valueTone(counts.openFormSubmissions)],
              ['Router', counts.routerAttention, valueTone(counts.routerAttention)],
              ['Intel', intelligenceOpen, valueTone(intelligenceOpen)],
            ].map(([label, value, className]) => (
              <div key={String(label)} className="rounded-xl border border-[#1e3a5f]/60 bg-[#080c14]/82 px-3 py-2 text-center">
                <div className={`text-lg font-black tabular-nums ${className}`}>{value}</div>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#93c5fd]/45">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
        <div className="grid gap-3 md:grid-cols-2">
          {workstreams.map((stream) => (
            <a
              key={stream.label}
              href={stream.href}
              className={`group rounded-xl border p-4 transition-colors hover:border-[#60a5fa]/60 hover:bg-[#10203c] ${toneClass(stream.tone)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white">{stream.label}</div>
                  <div className="mt-2 text-xs font-bold leading-relaxed text-[#bfdbfe]/88">{stream.signal}</div>
                </div>
                <span className="rounded-lg border border-[#93c5fd]/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#93c5fd]/70 group-hover:text-white">
                  Open
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-[10px] leading-relaxed text-[#93c5fd]/58 sm:grid-cols-2">
                <div>
                  <div className="font-black uppercase tracking-[0.18em] text-[#93c5fd]/38">Customer sees</div>
                  <p className="mt-1">{stream.customerSurface}</p>
                </div>
                <div>
                  <div className="font-black uppercase tracking-[0.18em] text-[#93c5fd]/38">Admin owns</div>
                  <p className="mt-1">{stream.adminSurface}</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[#bfdbfe]/72">{stream.action}</p>
            </a>
          ))}
        </div>

        <div className="rounded-xl border border-[#1e3a5f]/55 bg-[#080c14]/72 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.24em] text-white">Correlated Follow-Up Queue</h3>
              <p className="mt-1 text-[11px] text-[#93c5fd]/52">
                Devices appear here only when admin evidence suggests a real next action.
              </p>
            </div>
            <span className="rounded-lg border border-[#1e3a5f]/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#93c5fd]/50">
              Top {topDevices.length}
            </span>
          </div>

          <div className="mt-4 space-y-2.5">
            {topDevices.map((device) => {
              const freshness = reportFreshness(device.latestCellularAt);
              return (
                <div key={device.id} className="rounded-xl border border-[#1e3a5f]/42 bg-[#0b1323]/85 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-white">{device.name}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#93c5fd]/45">
                        Site {device.siteId} - {device.assignmentCount} assignment{device.assignmentCount === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${freshness.className}`}>
                      {freshness.label}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[
                      ['LAN', device.managedAttention],
                      ['Tickets', device.openTickets],
                      ['Actions', device.openRecommendations],
                      ['Firmware', device.openFirmware],
                    ].map(([label, value]) => (
                      <span
                        key={String(label)}
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${
                          Number(value) > 0
                            ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                            : 'border-[#1e3a5f]/70 bg-[#080c14]/60 text-[#93c5fd]/38'
                        }`}
                      >
                        {label} {value}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-[#93c5fd]/48">
                    Router signal {formatAgo(device.latestCellularAt)}
                    {device.latestReportDate ? ` - last report ${device.latestReportDate}` : ' - no generated report yet'}
                  </div>
                </div>
              );
            })}

            {topDevices.length === 0 && (
              <div className="rounded-xl border border-[#1e3a5f]/42 bg-[#080c14]/70 px-3 py-6 text-center">
                <div className="text-sm font-bold text-white">No correlated follow-up right now</div>
                <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-[#93c5fd]/52">
                  Customer requests, router attention, recommendations, and firmware advisories will appear here when they need admin handling.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
