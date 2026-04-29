type TicketRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  description: string;
  created_at: string;
  vrm_devices?: { name?: string | null; vrm_site_id?: string | null } | null;
};

type RecommendationRow = {
  id: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  action?: string | null;
  created_at: string;
  vrm_devices?: { name?: string | null; vrm_site_id?: string | null } | null;
};

type ReportRow = {
  id: string;
  report_date: string;
  status: string;
  summary: any;
  updated_at?: string | null;
  created_at: string;
  vrm_devices?: { name?: string | null; vrm_site_id?: string | null } | null;
};

type FirmwareRow = {
  id: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  product_name: string;
  firmware_version?: string | null;
  created_at: string;
  vrm_devices?: { name?: string | null; vrm_site_id?: string | null } | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function deviceLabel(row: { vrm_devices?: { name?: string | null; vrm_site_id?: string | null } | null }) {
  const device = row.vrm_devices;
  if (!device) return 'Unlinked trailer';
  return `${device.name ?? 'Trailer'}${device.vrm_site_id ? ` - ${device.vrm_site_id}` : ''}`;
}

function severityClass(value: string) {
  if (value === 'critical' || value === 'urgent') return 'border-rose-500/25 bg-rose-500/10 text-rose-300';
  if (value === 'action') return 'border-amber-500/25 bg-amber-500/10 text-amber-300';
  if (value === 'watch' || value === 'open') return 'border-sky-500/25 bg-sky-500/10 text-sky-300';
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300';
}

function statusLabel(value: string) {
  return {
    received: 'Received',
    triage: 'In review',
    scheduled: 'Scheduled',
    en_route: 'On the way',
    blocked: 'Blocked',
    completed: 'Completed',
    cancelled: 'Cancelled',
    generated: 'Generated',
    partial: 'Partial',
    needs_review: 'Needs review',
    open: 'Open',
    accepted: 'Accepted',
    dismissed: 'Dismissed',
  }[value] ?? value.replaceAll('_', ' ');
}

export function OperationsIntelligencePanel({
  tickets,
  recommendations,
  reports,
  firmwareAdvisories,
}: {
  tickets: TicketRow[];
  recommendations: RecommendationRow[];
  reports: ReportRow[];
  firmwareAdvisories: FirmwareRow[];
}) {
  const openTickets = tickets.filter((ticket) => !['completed', 'cancelled'].includes(ticket.status));
  const openRecommendations = recommendations.filter((item) => item.status === 'open');
  const openFirmware = firmwareAdvisories.filter((item) => item.status === 'open');

  return (
    <section className="mb-10 overflow-hidden rounded-2xl border border-[#1e3a5f] bg-[#0d1526]">
      <div className="border-b border-[#1e3a5f]/60 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.34em] text-[#93c5fd]/70">Operations Queue</div>
            <h2 className="mt-2 text-xl font-black text-white">Tickets, Reports, And Advisories</h2>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-[#93c5fd]/65">
              Customer tickets, historical intelligence reports, firmware inventory warnings, and open recommendations land here for admin review.
            </p>
          </div>
          <div className="grid min-w-[340px] grid-cols-4 gap-2">
            {[
              ['Tickets', openTickets.length, openTickets.length > 0 ? 'action' : 'normal'],
              ['Reports', reports.length, 'normal'],
              ['Actions', openRecommendations.length, openRecommendations.length > 0 ? 'watch' : 'normal'],
              ['Firmware', openFirmware.length, openFirmware.length > 0 ? 'watch' : 'normal'],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="rounded-xl border border-[#1e3a5f]/55 bg-[#080c14]/80 px-3 py-2 text-center">
                <div className={`text-lg font-black tabular-nums ${tone === 'action' ? 'text-amber-300' : tone === 'watch' ? 'text-sky-300' : 'text-emerald-300'}`}>{value}</div>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#93c5fd]/45">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-5 xl:grid-cols-2">
        <div className="rounded-xl border border-[#1e3a5f]/45 bg-[#080c14]/60 p-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.24em] text-white">Open Customer Tickets</h3>
          <div className="mt-3 space-y-2.5">
            {openTickets.slice(0, 6).map((ticket) => (
              <div key={ticket.id} className="rounded-xl border border-[#1e3a5f]/40 bg-[#0b1323]/80 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">{ticket.title}</div>
                    <div className="mt-1 text-[10px] text-[#93c5fd]/55">{deviceLabel(ticket)} - {formatDate(ticket.created_at)}</div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${severityClass(ticket.priority)}`}>
                    {statusLabel(ticket.status)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[#bfdbfe]/68">{ticket.description}</p>
              </div>
            ))}
            {openTickets.length === 0 && <p className="text-[11px] text-[#93c5fd]/55">No open customer tickets.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-[#1e3a5f]/45 bg-[#080c14]/60 p-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.24em] text-white">Latest Historical Reports</h3>
          <div className="mt-3 space-y-2.5">
            {reports.slice(0, 6).map((report) => (
              <div key={report.id} className="rounded-xl border border-[#1e3a5f]/40 bg-[#0b1323]/80 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">{deviceLabel(report)}</div>
                    <div className="mt-1 text-[10px] text-[#93c5fd]/55">Report date {report.report_date} - {formatDate(report.updated_at ?? report.created_at)}</div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${severityClass(report.summary?.overallSeverity ?? report.status)}`}>
                    {statusLabel(report.status)}
                  </span>
                </div>
                <div className="mt-2 text-[11px] leading-relaxed text-[#bfdbfe]/68">
                  Readiness {report.summary?.readinessScore ?? '--'}%. {report.summary?.visibilityRisk?.summary ?? 'Report summary unavailable.'}
                </div>
              </div>
            ))}
            {reports.length === 0 && <p className="text-[11px] text-[#93c5fd]/55">No historical reports generated yet.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-[#1e3a5f]/45 bg-[#080c14]/60 p-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.24em] text-white">Open Recommendations</h3>
          <div className="mt-3 space-y-2.5">
            {openRecommendations.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-xl border border-[#1e3a5f]/40 bg-[#0b1323]/80 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-sm font-black text-white">{item.title}</div>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${severityClass(item.severity)}`}>
                    {item.category.replaceAll('_', ' ')}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#93c5fd]/62">{deviceLabel(item)} - {item.summary}</p>
              </div>
            ))}
            {openRecommendations.length === 0 && <p className="text-[11px] text-[#93c5fd]/55">No open recommendations.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-[#1e3a5f]/45 bg-[#080c14]/60 p-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.24em] text-white">Firmware Notifications</h3>
          <div className="mt-3 space-y-2.5">
            {openFirmware.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-xl border border-[#1e3a5f]/40 bg-[#0b1323]/80 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-sm font-black text-white">{item.title}</div>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${severityClass(item.severity)}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#93c5fd]/62">
                  {deviceLabel(item)} - {item.product_name}{item.firmware_version ? ` ${item.firmware_version}` : ''}. {item.summary}
                </p>
              </div>
            ))}
            {openFirmware.length === 0 && <p className="text-[11px] text-[#93c5fd]/55">No open firmware notifications.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
