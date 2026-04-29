'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ClipboardCheck, FileClock, Info, LockKeyhole, RadioTower, Send, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import HistoricalIntelligencePanel from '@/components/dashboard/HistoricalIntelligencePanel';
import { useTheme } from '@/components/ThemeProvider';
import type { VRMData } from '@/lib/vrm';
import type {
  DashboardDeviceRef,
  LeaseOperationsData,
  ProofEventSeverity,
  ServiceTicketPriority,
  ServiceTicketType,
} from '@/lib/leaseOperations';
import type { FleetIntelligence, IntelligenceSeverity } from '@/lib/assetIntelligence';

const SEVERITY_STYLE: Record<IntelligenceSeverity | ProofEventSeverity, { label: string; text: string; border: string; bg: string }> = {
  normal: { label: 'Normal', text: 'text-emerald-300', border: 'border-emerald-500/20', bg: 'bg-emerald-500/10' },
  info: { label: 'Info', text: 'text-sky-300', border: 'border-sky-500/20', bg: 'bg-sky-500/10' },
  watch: { label: 'Watch', text: 'text-sky-300', border: 'border-sky-500/20', bg: 'bg-sky-500/10' },
  action: { label: 'Action', text: 'text-amber-300', border: 'border-amber-500/24', bg: 'bg-amber-500/10' },
  critical: { label: 'Critical', text: 'text-rose-300', border: 'border-rose-500/24', bg: 'bg-rose-500/10' },
};

const TICKET_TYPES: { value: ServiceTicketType; label: string }[] = [
  { value: 'service', label: 'Service' },
  { value: 'relocation', label: 'Relocation' },
  { value: 'connectivity', label: 'Connectivity' },
  { value: 'power', label: 'Power' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES: { value: ServiceTicketPriority; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'low', label: 'Low' },
];

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function packageLabel(value: string) {
  return value === 'fully_equipped' ? 'Fully Equipped' : 'Trailer & Power Base';
}

function packageVisibility(value: string) {
  if (value === 'fully_equipped') {
    return {
      label: 'Full equipped visibility',
      detail: 'Trailer power, onboard network intelligence, plus third-party monitoring and platform coverage when linked.',
      included: ['NomadXE trailer health', 'Power system intelligence', 'Monitoring partner status', 'Platform/reporting handoff'],
    };
  }

  return {
    label: 'Base trailer visibility',
    detail: 'NomadXE trailer, power, router, and onboard network intelligence. Customer-owned cameras, NVR, and platform remain outside this portal unless later integrated.',
    included: ['NomadXE trailer health', 'Power system intelligence', 'Router / Cerbo visibility', 'Service requests'],
  };
}

function activeTelemetryCount(dataMap: Record<string, VRMData | null>) {
  const nowS = Date.now() / 1000;
  return Object.values(dataMap).filter((data) => data && data.lastSeen > 0 && nowS - data.lastSeen < 15 * 60).length;
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'normal',
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof ShieldCheck;
  tone?: IntelligenceSeverity;
}) {
  const style = SEVERITY_STYLE[tone];
  const { theme } = useTheme();
  const isLight = theme === 'light';
  return (
    <div className={`rounded-xl border px-3 py-3 ${isLight ? 'border-slate-200 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)]' : `${style.border} bg-[#080c14]/76`}`}>
      <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.24em] ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/42'}`}>
        <Icon className={`h-3.5 w-3.5 ${style.text}`} />
        {label}
      </div>
      <div className={`mt-2 text-xl font-black tabular-nums ${isLight ? 'text-slate-950' : 'text-white'}`}>{value}</div>
      <div className={`mt-1 text-[10px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#93c5fd]/52'}`}>{detail}</div>
    </div>
  );
}

function FeatureKey({
  title,
  items,
}: {
  title: string;
  items: { label: string; detail: string }[];
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  return (
    <div className={`rounded-xl border px-3 py-3 ${isLight ? 'border-slate-200 bg-white' : 'border-[#1e3a5f]/38 bg-[#080c14]/52'}`}>
      <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.24em] ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/46'}`}>
        <Info className="h-3.5 w-3.5 text-[#60a5fa]" />
        {title}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className={`text-[10px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-[#93c5fd]/56'}`}>
            <span className={`font-black ${isLight ? 'text-slate-950' : 'text-[#bfdbfe]/78'}`}>{item.label}</span>
            <span> - {item.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LeaseCommandCenter({
  devices,
  dataMap,
  operations,
  fleetIntelligence,
  onTicketCreated,
}: {
  devices: DashboardDeviceRef[];
  dataMap: Record<string, VRMData | null>;
  operations: LeaseOperationsData;
  fleetIntelligence: FleetIntelligence;
  onTicketCreated: () => void;
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const openTickets = operations.tickets.filter((ticket) => !['completed', 'cancelled'].includes(ticket.status));
  const startsOpen = fleetIntelligence.severity !== 'normal' || openTickets.length > 0;
  const [type, setType] = useState<ServiceTicketType>('service');
  const [priority, setPriority] = useState<ServiceTicketPriority>('normal');
  const [siteId, setSiteId] = useState(devices[0]?.siteId ?? '');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(startsOpen);
  const [showKey, setShowKey] = useState(false);
  const [showAllProof, setShowAllProof] = useState(false);

  const liveCount = activeTelemetryCount(dataMap);
  const proofCount = operations.proofEvents.length;
  const auditCount = operations.accessEvents.length;
  const topLease = operations.leases[0] ?? null;
  const sourceLabel = operations.dataSource === 'database' ? 'Lease records linked' : 'Telemetry-derived until lease records are linked';
  const leaseVisibility = packageVisibility(topLease?.packageType ?? 'power_base');
  const visibleProofEvents = showAllProof ? operations.proofEvents.slice(0, 10) : operations.proofEvents.slice(0, 4);

  const headline = useMemo(() => {
    if (fleetIntelligence.severity === 'critical') return 'Lease visibility needs immediate operations attention.';
    if (fleetIntelligence.severity === 'action') return 'Lease coverage is active with action items queued.';
    if (fleetIntelligence.severity === 'watch') return 'Lease coverage is active with watch items.';
    return 'Lease coverage is healthy across assigned equipment.';
  }, [fleetIntelligence.severity]);
  const shellClass = isLight
    ? 'mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-[0_18px_46px_rgba(15,23,42,0.08)]'
    : 'mb-6 overflow-hidden rounded-2xl border border-[#1e3a5f]/55 bg-[linear-gradient(180deg,rgba(8,12,20,0.86),rgba(6,10,18,0.96))] shadow-[0_28px_90px_rgba(0,0,0,0.24)]';
  const panelClass = isLight
    ? 'rounded-xl border border-slate-200 bg-slate-50 p-4'
    : 'rounded-xl border border-[#1e3a5f]/45 bg-[#0b1323]/66 p-4';
  const subPanelClass = isLight
    ? 'rounded-lg border border-slate-200 bg-white px-3 py-3'
    : 'rounded-lg border border-[#1e3a5f]/38 bg-[#080c14]/58 px-3 py-3';
  const compactPanelClass = isLight
    ? 'rounded-lg border border-slate-200 bg-white px-3 py-2'
    : 'rounded-lg border border-[#1e3a5f]/38 bg-[#080c14]/58 px-3 py-2';
  const labelClass = isLight
    ? 'text-slate-500'
    : 'text-[#93c5fd]/38';
  const mutedText = isLight
    ? 'text-slate-600'
    : 'text-[#93c5fd]/58';
  const primaryText = isLight ? 'text-slate-950' : 'text-white';
  const bodyText = isLight ? 'text-slate-700' : 'text-[#bfdbfe]/72';

  async function submitTicket() {
    const trimmed = description.trim();
    if (!trimmed || !siteId) {
      setMessage('Choose a trailer and describe the request before submitting.');
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/service-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, type, priority, description: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json?.error ?? 'Could not create the service ticket.');
        return;
      }
      setDescription('');
      setMessage('Service ticket created. NomadXE operations has the request.');
      onTicketCreated();
    } catch {
      setMessage('Network error. The service ticket was not created.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={shellClass}>
      <div className={`border-b px-4 py-4 sm:px-5 ${isLight ? 'border-slate-200' : 'border-[#1e3a5f]/42'}`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-[#60a5fa] shadow-[0_0_14px_rgba(96,165,250,0.75)]" />
              <h2 className={`text-[11px] font-black uppercase tracking-[0.32em] ${primaryText}`}>Operations Command Center</h2>
              <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${isLight ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-[#1e3a5f]/60 bg-[#0b1323]/80 text-[#93c5fd]/70'}`}>
                {sourceLabel}
              </span>
            </div>
            <p className={`mt-2 max-w-4xl text-sm leading-6 ${bodyText}`}>
              {headline} {fleetIntelligence.briefing}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row xl:flex-col xl:items-stretch">
            <div className={`rounded-xl border px-4 py-3 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[#1e3a5f]/55 bg-[#080c14]/76'}`}>
              <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.24em] ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/42'}`}>
                <Sparkles className="h-3.5 w-3.5 text-[#60a5fa]" />
                Confidence
              </div>
              <div className={`mt-1 text-2xl font-black tabular-nums ${primaryText}`}>{fleetIntelligence.fleetScore}%</div>
              <div className={`mt-1 text-[10px] ${isLight ? 'text-slate-600' : 'text-[#93c5fd]/48'}`}>{liveCount}/{devices.length} live - {openTickets.length} open service</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isLight ? 'border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-700' : 'border-[#1e3a5f]/55 bg-[#080c14]/76 text-[#93c5fd]/70 hover:border-[#60a5fa]/55 hover:text-white'}`}
              >
                Key
              </button>
              <button
                type="button"
                onClick={() => setShowDetails((value) => !value)}
                aria-expanded={showDetails}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isLight ? 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400 hover:bg-blue-100' : 'border-[#2563eb]/45 bg-[#1e40af]/24 text-[#bfdbfe] hover:border-[#60a5fa]/65 hover:text-white'}`}
              >
                {showDetails ? 'Hide' : 'Open'}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showKey && (
        <div className={`border-b px-4 py-4 sm:px-5 ${isLight ? 'border-slate-200 bg-slate-50/70' : 'border-[#1e3a5f]/35'}`}>
          <div className="grid gap-3 xl:grid-cols-3">
            <FeatureKey
              title="Reading Key"
              items={[
                { label: 'Live Assets', detail: 'trailers with recent Victron VRM telemetry.' },
                { label: 'Open Service', detail: 'active customer or operations requests.' },
                { label: 'Proof Events', detail: 'evidence records from telemetry, service, monitoring, or reports.' },
                { label: 'Access Audits', detail: 'logged remote access attempts and grants.' },
                { label: 'Historical Report', detail: 'daily VRM history, alarm, GPS, firmware, and lease evidence summary.' },
              ]}
            />
            <FeatureKey
              title="Severity Key"
              items={[
                { label: 'Info', detail: 'routine evidence or confirmation.' },
                { label: 'Watch', detail: 'condition should be observed.' },
                { label: 'Action', detail: 'operations should intervene.' },
                { label: 'Critical', detail: 'immediate response risk.' },
              ]}
            />
            <FeatureKey
              title="Service Key"
              items={[
                { label: 'Service', detail: 'general maintenance or field support.' },
                { label: 'Connectivity', detail: 'router, VRM, Cerbo, or camera network issue.' },
                { label: 'Power', detail: 'battery, solar, load, charger, or runtime concern.' },
                { label: 'Monitoring', detail: 'third-party monitoring, platform, reporting, or response workflow.' },
              ]}
            />
          </div>
        </div>
      )}

      {showDetails && <div className="grid gap-4 px-4 py-4 sm:px-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-4">
            <Metric label="Live Assets" value={`${liveCount}/${devices.length}`} detail="VRM telemetry inside the 15m live window" icon={RadioTower} tone={liveCount === devices.length ? 'normal' : 'watch'} />
            <Metric label="Open Service" value={String(openTickets.length)} detail="Customer-visible tickets not completed" icon={Wrench} tone={openTickets.length > 0 ? 'watch' : 'normal'} />
            <Metric label="Proof Events" value={String(proofCount)} detail="Recent operational evidence entries" icon={ClipboardCheck} tone="normal" />
            <Metric label="Access Audits" value={String(auditCount)} detail="Remote access events in the audit trail" icon={LockKeyhole} tone="normal" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <HistoricalIntelligencePanel devices={devices} />
            </div>

            <div className={panelClass}>
              <div className={`flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.24em] ${primaryText}`}>
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Lease Package & Visibility
              </div>
              {topLease ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <div className={`text-lg font-black ${primaryText}`}>{topLease.siteName}</div>
                    <div className={`mt-1 text-[11px] ${mutedText}`}>
                      {topLease.leaseNumber} - {packageLabel(topLease.packageType)} - {topLease.status}
                    </div>
                  </div>
                  <div className={subPanelClass}>
                    <div className={`text-[9px] font-bold uppercase tracking-[0.22em] ${labelClass}`}>{leaseVisibility.label}</div>
                    <div className={`mt-1 text-[11px] leading-relaxed ${bodyText}`}>{leaseVisibility.detail}</div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {leaseVisibility.included.map((item) => (
                      <div key={item} className={compactPanelClass}>
                        <div className={`text-[9px] font-bold uppercase tracking-[0.22em] ${labelClass}`}>Visible Here</div>
                        <div className={`mt-1 text-xs font-bold ${isLight ? 'text-slate-800' : 'text-[#bfdbfe]/80'}`}>{item}</div>
                      </div>
                    ))}
                  </div>
                  <div className={`text-[11px] leading-relaxed ${mutedText}`}>
                    {topLease.assets.length} trailer{topLease.assets.length === 1 ? '' : 's'} attached to this lease. Third-party monitoring/platform records appear here only when a Fully Equipped lease is linked. Ends: {topLease.endsOn ?? 'not set'}.
                  </div>
                </div>
              ) : (
                <div className={`${subPanelClass} text-[11px] leading-relaxed ${mutedText}`}>
                  No formal lease record is linked yet. This panel is using assigned-trailer telemetry only: trailer health, power intelligence, router/Cerbo visibility, and service requests. Fully Equipped monitoring/platform details appear after a lease record is linked.
                </div>
              )}
            </div>

            <div className={panelClass}>
              <div className={`flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.24em] ${primaryText}`}>
                <FileClock className="h-4 w-4 text-[#60a5fa]" />
                Proof Of Service
              </div>
              <div className="mt-3 space-y-2.5">
                {visibleProofEvents.map((event) => {
                  const style = SEVERITY_STYLE[event.severity];
                  return (
                    <div key={event.id} className={`rounded-xl border ${style.border} ${style.bg} px-3 py-2.5`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className={`min-w-0 truncate text-sm font-bold ${primaryText}`}>{event.title}</div>
                        <div className={`text-[9px] font-mono ${isLight ? 'text-slate-500' : 'text-[#bfdbfe]/54'}`}>{formatDate(event.occurredAt)}</div>
                      </div>
                      <div className={`mt-1 text-[11px] leading-relaxed ${isLight ? 'text-slate-700' : 'text-[#bfdbfe]/66'}`}>{event.summary}</div>
                    </div>
                  );
                })}
                {operations.proofEvents.length === 0 && (
                  <div className={`${subPanelClass} text-[11px] leading-relaxed ${mutedText}`}>
                    Proof events will appear after telemetry, service, monitoring, or access events are recorded.
                  </div>
                )}
              </div>
              {operations.proofEvents.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllProof((value) => !value)}
                  className={`mt-3 w-full rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isLight ? 'border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-700' : 'border-[#1e3a5f]/45 bg-[#080c14]/58 text-[#93c5fd]/64 hover:border-[#60a5fa]/55 hover:text-white'}`}
                >
                  {showAllProof ? 'Show latest 4' : `Show ${Math.min(operations.proofEvents.length, 10)} events`}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className={panelClass}>
            <div className={`flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.24em] ${primaryText}`}>
              <Wrench className="h-4 w-4 text-amber-300" />
              Request Service
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <select aria-label="Service request trailer" value={siteId} onChange={(event) => setSiteId(event.target.value)} className={`rounded-lg border px-3 py-2 text-xs font-bold outline-none focus:border-[#60a5fa] ${isLight ? 'border-slate-200 bg-white text-slate-950' : 'border-[#1e3a5f]/55 bg-[#080c14] text-white'}`}>
                {devices.map((device) => (
                  <option key={device.siteId} value={device.siteId}>{device.displayName ?? device.name}</option>
                ))}
              </select>
              <select aria-label="Service request type" value={type} onChange={(event) => setType(event.target.value as ServiceTicketType)} className={`rounded-lg border px-3 py-2 text-xs font-bold outline-none focus:border-[#60a5fa] ${isLight ? 'border-slate-200 bg-white text-slate-950' : 'border-[#1e3a5f]/55 bg-[#080c14] text-white'}`}>
                {TICKET_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select aria-label="Service request priority" value={priority} onChange={(event) => setPriority(event.target.value as ServiceTicketPriority)} className={`rounded-lg border px-3 py-2 text-xs font-bold outline-none focus:border-[#60a5fa] ${isLight ? 'border-slate-200 bg-white text-slate-950' : 'border-[#1e3a5f]/55 bg-[#080c14] text-white'}`}>
                {PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <textarea
              aria-label="Service request details"
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, 1200))}
              rows={4}
              placeholder="What should NomadXE operations know?"
              className={`mt-2 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#60a5fa] ${isLight ? 'border-slate-200 bg-white text-slate-950 placeholder:text-slate-400' : 'border-[#1e3a5f]/55 bg-[#080c14] text-white placeholder:text-[#93c5fd]/28'}`}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className={`text-[10px] leading-relaxed ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/48'}`}>
                Tickets are validated server-side against your assigned trailer before creation.
              </div>
              <button
                type="button"
                onClick={submitTicket}
                disabled={submitting || devices.length === 0}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isLight ? 'border-blue-200 bg-blue-600 text-white hover:bg-blue-700' : 'border-[#2563eb]/45 bg-[#1e40af]/28 text-[#bfdbfe] hover:border-[#60a5fa]/70 hover:text-white'}`}
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? 'Sending' : 'Create Ticket'}
              </button>
            </div>
            {message && <div className={`mt-3 rounded-lg border px-3 py-2 text-[11px] ${isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-[#1e3a5f]/38 bg-[#080c14]/58 text-[#bfdbfe]/70'}`}>{message}</div>}
          </div>

          <div className={panelClass}>
            <div className={`flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.24em] ${primaryText}`}>
              <LockKeyhole className="h-4 w-4 text-emerald-300" />
              Recent Secure Access
            </div>
            <div className="mt-3 space-y-2">
              {operations.accessEvents.slice(0, 4).map((event) => (
                <div key={event.id} className={compactPanelClass}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-xs font-bold ${primaryText}`}>{event.accessType.replaceAll('_', ' ')}</span>
                    <span className={`text-[9px] font-mono ${isLight ? 'text-slate-500' : 'text-[#93c5fd]/50'}`}>{formatDate(event.createdAt)}</span>
                  </div>
                  <div className={`mt-1 text-[10px] ${mutedText}`}>{event.status} - {event.actorRole}</div>
                </div>
              ))}
              {operations.accessEvents.length === 0 && (
                <div className={`${subPanelClass} text-[11px] leading-relaxed ${mutedText}`}>
                  No remote access sessions have been logged for these assigned trailers yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>}
    </section>
  );
}
