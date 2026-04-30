type FormSubmissionRow = {
  id: string;
  form_type: string;
  status: string;
  name: string | null;
  email: string | null;
  company: string | null;
  phone: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function labelFor(type: string) {
  if (type === 'order') return 'Order';
  if (type === 'relocation') return 'Relocation';
  if (type === 'deactivation') return 'Deactivation';
  if (type === 'contact') return 'Contact';
  return type;
}

function shortSummary(row: FormSubmissionRow) {
  const payload = row.payload ?? {};
  const site = payload.location_name ?? payload.site_name ?? payload.dest_site_name ?? payload.company;
  const unit = payload.unit_identifier ?? payload.trailer_count ?? payload.quantity;
  return [site, unit].filter(Boolean).join(' - ') || 'No summary fields captured';
}

export function FormSubmissionsPanel({ submissions }: { submissions: FormSubmissionRow[] }) {
  return (
    <section className="mb-10 rounded-2xl border border-[#1e3a5f] bg-[#0d1526] p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.24em] text-white">Form Intake</h2>
          <p className="mt-1 text-xs text-[#93c5fd]/65">
            First-party ledger for order, relocation, deactivation, and contact requests. Make forwarding is optional.
          </p>
        </div>
        <span className="rounded-lg border border-[#1e3a5f] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#93c5fd]/65">
          {submissions.length} latest
        </span>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-xl border border-[#1e3a5f]/70 bg-[#080c14] px-4 py-5 text-xs text-[#93c5fd]/62">
          No first-party form submissions have been recorded yet.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {submissions.map((submission) => (
            <article key={submission.id} className="rounded-xl border border-[#1e3a5f]/70 bg-[#080c14] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#3b82f6]">{labelFor(submission.form_type)}</div>
                  <h3 className="mt-1 truncate text-sm font-black text-white">{submission.name ?? submission.company ?? 'Unnamed request'}</h3>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">
                  {submission.status}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#bfdbfe]/72">{shortSummary(submission)}</p>
              <div className="mt-4 space-y-1.5 text-[10px] text-[#93c5fd]/58">
                <div>{submission.email ?? 'No email captured'}</div>
                <div>{submission.phone ?? 'No phone captured'}</div>
                <div>{formatDate(submission.created_at)}</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
