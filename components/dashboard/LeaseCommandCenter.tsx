'use client';

import { useMemo, useState } from 'react';
import { ClipboardCheck, FileClock, Info, LockKeyhole, RadioTower, Send, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
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
  return (
    <div className={`rounded-xl border ${style.border} bg-[#080c14]/76 px-3 py-3`}>
      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.24em] text-[#93c5fd]/42">
        <Icon className={`h-3.5 w-3.5 ${style.text}`} />
        {label}
      </div>
      <div className="mt-2 text-xl font-black tabular-nums text-white">{value}</div>
      <div className="mt-1 text-[10px] leading-relaxed text-[#93c5fd]/52">{detail}</div>
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
  return (
    <div className="rounded-xl border border-[#1e3a5f]/38 bg-[#080c14]/52 px-3 py-3">
      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.24em] text-[#93c5fd]/46">
        <Info className="h-3.5 w-3.5 text-[#60a5fa]" />
        {title}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="text-[10px] leading-relaxed text-[#93c5fd]/56">
            <span className="font-black text-[#bfdbfe]/78">{item.label}</span>
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
  const [type, setType] = useState<ServiceTicketType>('service');
  const [priority, setPriority] = useState<ServiceTicketPriority>('normal');
  const [siteId, setSiteId] = useState(devices[0]?.siteId ?? '');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const openTickets = operations.tickets.filter((ticket) => !['completed', 'cancelled'].includes(ticket.status));
  const liveCount = activeTelemetryCount(dataMap);
  const proofCount = operations.proofEvents.length;
  const auditCount = operations.accessEvents.length;
  const topLease = operations.leases[0] ?? null;
  const sourceLabel = operations.dataSource === 'database' ? 'Lease records linked' : 'Telemetry-derived until lease records are linked';

  const headline = useMemo(() => {
    if (fleetIntelligence.severity === 'critical') return 'Lease visibility needs immediate operations attention.';
    if (fleetIntelligence.severity === 'action') return 'Lease coverage is active with action items queued.';
    if (fleetIntelligence.severity === 'watch') return 'Lease coverage is active with watch items.';
    return 'Lease coverage is healthy across assigned equipment.';
  }, [fleetIntelligence.severity]);

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
    <section className="mb-6 overflow-hidden rounded-2xl border border-[#1e3a5f]/55 bg-[linear-gradient(180deg,rgba(8,12,20,0.86),rgba(6,10,18,0.96))] shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
      <div className="border-b border-[#1e3a5f]/42 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-[#60a5fa] shadow-[0_0_14px_rgba(96,165,250,0.75)]" />
              <h2 className="text-[11px] font-black uppercase tracking-[0.32em] text-white">Lease Intelligence Command Center</h2>
              <span className="rounded-full border border-[#1e3a5f]/60 bg-[#0b1323]/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#93c5fd]/70">
                {sourceLabel}
              </span>
            </div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#bfdbfe]/72">
              {headline} {fleetIntelligence.briefing}
            </p>
          </div>
          <div className="rounded-xl border border-[#1e3a5f]/55 bg-[#080c14]/76 px-4 py-3">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.24em] text-[#93c5fd]/42">
              <Sparkles className="h-3.5 w-3.5 text-[#60a5fa]" />
              Intelligence Confidence
            </div>
            <div className="mt-1 text-2xl font-black tabular-nums text-white">{fleetIntelligence.fleetScore}%</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:px-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-4">
            <Metric label="Live Assets" value={`${liveCount}/${devices.length}`} detail="VRM telemetry inside the 15m live window" icon={RadioTower} tone={liveCount === devices.length ? 'normal' : 'watch'} />
            <Metric label="Open Service" value={String(openTickets.length)} detail="Customer-visible tickets not completed" icon={Wrench} tone={openTickets.length > 0 ? 'watch' : 'normal'} />
            <Metric label="Proof Events" value={String(proofCount)} detail="Recent operational evidence entries" icon={ClipboardCheck} tone="normal" />
            <Metric label="Access Audits" value={String(auditCount)} detail="Remote access events in the audit trail" icon={LockKeyhole} tone="normal" />
          </div>

          <FeatureKey
            title="Dashboard Key"
            items={[
              { label: 'Live Assets', detail: 'trailers with recent Victron VRM telemetry.' },
              { label: 'Open Service', detail: 'active customer or operations requests.' },
              { label: 'Proof Events', detail: 'evidence records from telemetry, service, monitoring, or reports.' },
              { label: 'Access Audits', detail: 'logged remote access attempts and grants.' },
            ]}
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-[#1e3a5f]/45 bg-[#0b1323]/66 p-4">
              <div className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.24em] text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Lease Scope
              </div>
              {topLease ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="text-lg font-black text-white">{topLease.siteName}</div>
                    <div className="mt-1 text-[11px] text-[#93c5fd]/54">
                      {topLease.leaseNumber} · {packageLabel(topLease.packageType)} · {topLease.status}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-[#1e3a5f]/38 bg-[#080c14]/58 px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/38">Service</div>
                      <div className="mt-1 text-xs font-bold text-[#bfdbfe]/80">{topLease.serviceLevel}</div>
                    </div>
                    <div className="rounded-lg border border-[#1e3a5f]/38 bg-[#080c14]/58 px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#93c5fd]/38">Monitoring</div>
                      <div className="mt-1 text-xs font-bold text-[#bfdbfe]/80">{topLease.monitoringPartner ?? 'Not linked'}</div>
                    </div>
                  </div>
                  <div className="text-[11px] leading-relaxed text-[#93c5fd]/58">
                    {topLease.assets.length} trailer{topLease.assets.length === 1 ? '' : 's'} attached to this lease. Ends: {topLease.endsOn ?? 'not set'}.
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-[#1e3a5f]/38 bg-[#080c14]/58 px-3 py-3 text-[11px] leading-relaxed text-[#93c5fd]/58">
                  No assigned lease scope yet. Telemetry remains visible, but linking leases unlocks service history, proof-of-service, and contract visibility.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#1e3a5f]/45 bg-[#0b1323]/66 p-4">
              <div className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.24em] text-white">
                <FileClock className="h-4 w-4 text-[#60a5fa]" />
                Proof Of Service
              </div>
              <div className="mt-3 space-y-2.5">
                {operations.proofEvents.slice(0, 4).map((event) => {
                  const style = SEVERITY_STYLE[event.severity];
                  return (
                    <div key={event.id} className={`rounded-xl border ${style.border} ${style.bg} px-3 py-2.5`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 truncate text-sm font-bold text-white">{event.title}</div>
                        <div className="text-[9px] font-mono text-[#bfdbfe]/54">{formatDate(event.occurredAt)}</div>
                      </div>
                      <div className="mt-1 text-[11px] leading-relaxed text-[#bfdbfe]/66">{event.summary}</div>
                    </div>
                  );
                })}
                {operations.proofEvents.length === 0 && (
                  <div className="rounded-lg border border-[#1e3a5f]/38 bg-[#080c14]/58 px-3 py-3 text-[11px] leading-relaxed text-[#93c5fd]/58">
                    Proof events will appear after telemetry, service, monitoring, or access events are recorded.
                  </div>
                )}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(['info', 'watch', 'action', 'critical'] as ProofEventSeverity[]).map((severity) => {
                  const style = SEVERITY_STYLE[severity];
                  return (
                    <div key={severity} className={`rounded-lg border ${style.border} ${style.bg} px-2.5 py-2`}>
                      <div className={`text-[9px] font-black uppercase tracking-[0.18em] ${style.text}`}>{style.label}</div>
                      <div className="mt-1 text-[10px] leading-relaxed text-[#bfdbfe]/56">
                        {severity === 'info' && 'Routine evidence or confirmation.'}
                        {severity === 'watch' && 'Condition should be observed.'}
                        {severity === 'action' && 'Operations should intervene.'}
                        {severity === 'critical' && 'Immediate response risk.'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[#1e3a5f]/45 bg-[#0b1323]/66 p-4">
            <div className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.24em] text-white">
              <Wrench className="h-4 w-4 text-amber-300" />
              Request Service
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <select aria-label="Service request trailer" value={siteId} onChange={(event) => setSiteId(event.target.value)} className="rounded-lg border border-[#1e3a5f]/55 bg-[#080c14] px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#60a5fa]">
                {devices.map((device) => (
                  <option key={device.siteId} value={device.siteId}>{device.displayName ?? device.name}</option>
                ))}
              </select>
              <select aria-label="Service request type" value={type} onChange={(event) => setType(event.target.value as ServiceTicketType)} className="rounded-lg border border-[#1e3a5f]/55 bg-[#080c14] px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#60a5fa]">
                {TICKET_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select aria-label="Service request priority" value={priority} onChange={(event) => setPriority(event.target.value as ServiceTicketPriority)} className="rounded-lg border border-[#1e3a5f]/55 bg-[#080c14] px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#60a5fa]">
                {PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <textarea
              aria-label="Service request details"
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, 1200))}
              rows={4}
              placeholder="What should NomadXE operations know?"
              className="mt-2 w-full resize-none rounded-lg border border-[#1e3a5f]/55 bg-[#080c14] px-3 py-2 text-sm text-white placeholder:text-[#93c5fd]/28 outline-none focus:border-[#60a5fa]"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[10px] leading-relaxed text-[#93c5fd]/48">
                Tickets are validated server-side against your assigned trailer before creation.
              </div>
              <button
                type="button"
                onClick={submitTicket}
                disabled={submitting || devices.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-[#2563eb]/45 bg-[#1e40af]/28 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#bfdbfe] transition-colors hover:border-[#60a5fa]/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? 'Sending' : 'Create Ticket'}
              </button>
            </div>
            {message && <div className="mt-3 rounded-lg border border-[#1e3a5f]/38 bg-[#080c14]/58 px-3 py-2 text-[11px] text-[#bfdbfe]/70">{message}</div>}
          </div>

          <FeatureKey
            title="Service Key"
            items={[
              { label: 'Service', detail: 'general maintenance or field support.' },
              { label: 'Connectivity', detail: 'router, VRM, Cerbo, or camera network issue.' },
              { label: 'Power', detail: 'battery, solar, load, charger, or runtime concern.' },
              { label: 'Monitoring', detail: 'partner, reporting, detection, or response workflow.' },
            ]}
          />

          <div className="rounded-xl border border-[#1e3a5f]/45 bg-[#0b1323]/66 p-4">
            <div className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.24em] text-white">
              <LockKeyhole className="h-4 w-4 text-emerald-300" />
              Recent Secure Access
            </div>
            <div className="mt-3 space-y-2">
              {operations.accessEvents.slice(0, 4).map((event) => (
                <div key={event.id} className="rounded-lg border border-[#1e3a5f]/38 bg-[#080c14]/58 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-white">{event.accessType.replaceAll('_', ' ')}</span>
                    <span className="text-[9px] font-mono text-[#93c5fd]/50">{formatDate(event.createdAt)}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-[#93c5fd]/54">{event.status} · {event.actorRole}</div>
                </div>
              ))}
              {operations.accessEvents.length === 0 && (
                <div className="rounded-lg border border-[#1e3a5f]/38 bg-[#080c14]/58 px-3 py-3 text-[11px] leading-relaxed text-[#93c5fd]/58">
                  No remote access sessions have been logged for these assigned trailers yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
