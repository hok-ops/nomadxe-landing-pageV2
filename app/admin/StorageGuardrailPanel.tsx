type StorageGuardrailCounts = {
  formSubmissions: number;
  cellularReports: number;
  dailyReports: number;
  discoveredHosts: number;
  networkEvents: number;
};

const FREE_PLAN_DATABASE_BYTES = 500 * 1024 * 1024;

const ESTIMATED_ROW_BYTES = {
  formSubmissions: 3_000,
  cellularReports: 850,
  dailyReports: 14_000,
  discoveredHosts: 900,
  networkEvents: 650,
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function estimateBytes(counts: StorageGuardrailCounts) {
  return (
    counts.formSubmissions * ESTIMATED_ROW_BYTES.formSubmissions +
    counts.cellularReports * ESTIMATED_ROW_BYTES.cellularReports +
    counts.dailyReports * ESTIMATED_ROW_BYTES.dailyReports +
    counts.discoveredHosts * ESTIMATED_ROW_BYTES.discoveredHosts +
    counts.networkEvents * ESTIMATED_ROW_BYTES.networkEvents
  );
}

export function StorageGuardrailPanel({ counts }: { counts: StorageGuardrailCounts }) {
  const estimatedBytes = estimateBytes(counts);
  const estimatedPercent = Math.min(100, Math.round((estimatedBytes / FREE_PLAN_DATABASE_BYTES) * 1000) / 10);
  const rows = [
    ['Form requests', counts.formSubmissions, 'Text records only; image data is redacted before storage.'],
    ['Cellular reports', counts.cellularReports, 'Small Teltonika signal readings retained for trend context.'],
    ['Daily reports', counts.dailyReports, 'Richer JSON summaries; strongest candidate for future pruning.'],
    ['Discovered hosts', counts.discoveredHosts, 'Router/Cerbo LAN inventory snapshots via upsert.'],
    ['Network events', counts.networkEvents, 'Managed device state-change audit trail.'],
  ] as const;

  return (
    <section className="mb-10 rounded-2xl border border-[#1e3a5f] bg-[#0d1526] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.34em] text-[#93c5fd]/70">Supabase Free-Plan Guardrail</div>
          <h2 className="mt-2 text-xl font-black text-white">Database Growth Watch</h2>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-[#93c5fd]/65">
            These estimates focus on NomadXE-created operational records that can grow over time. The exact Supabase project usage should still be checked in Supabase, but this panel keeps growth visible inside the workflow.
          </p>
        </div>
        <div className="min-w-[220px] rounded-xl border border-[#1e3a5f]/70 bg-[#080c14]/80 px-4 py-3">
          <div className="text-[9px] font-black uppercase tracking-[0.22em] text-[#93c5fd]/45">Estimated App Data</div>
          <div className="mt-2 text-2xl font-black text-white">{formatBytes(estimatedBytes)}</div>
          <div className="mt-1 text-[11px] text-[#93c5fd]/62">about {estimatedPercent}% of a 500 MB free database quota</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {rows.map(([label, value, note]) => (
          <div key={label} className="rounded-xl border border-[#1e3a5f]/55 bg-[#080c14]/70 p-4">
            <div className="text-xl font-black tabular-nums text-white">{value.toLocaleString()}</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#3b82f6]">{label}</div>
            <p className="mt-2 text-[10px] leading-relaxed text-[#93c5fd]/58">{note}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-[11px] leading-relaxed text-amber-100/80">
        Operating rule: store searchable text and telemetry in Postgres; move bulky evidence such as photos or exports into object storage before production volume grows.
      </div>
    </section>
  );
}
