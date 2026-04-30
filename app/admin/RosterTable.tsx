'use client';

import { useState } from 'react';
import { DevicesCell } from './DevicesCell';
import { DeleteUserButton } from './DeleteUserButton';
import {
  resendInvite,
  sendPasswordReset,
  updateUserStatus,
  updateUserRole,
} from './actions';

type AdminAction = (formData: FormData) => void | Promise<void>;

interface Assignment {
  id: number | string;
  vrm_devices?: { name?: string; vrm_site_id?: string } | { name?: string; vrm_site_id?: string }[] | null;
}

export interface RosterUser {
  id: string;
  email: string | undefined;
  last_sign_in_at: string | null;
  role: string | null;
  status: string | null;
  assignments: Assignment[];
}

function deviceNames(assignments: Assignment[]): string[] {
  return assignments.flatMap(a => {
    if (!a.vrm_devices) return [];
    const dev = Array.isArray(a.vrm_devices) ? a.vrm_devices[0] : a.vrm_devices;
    return [dev?.name ?? '', dev?.vrm_site_id ?? ''];
  });
}

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

function riskButtonClasses(tone: 'orange' | 'violet' | 'slate' | 'emerald') {
  if (tone === 'orange') return 'border-orange-500/30 text-orange-300 hover:bg-orange-500/10';
  if (tone === 'violet') return 'border-violet-500/30 text-violet-300 hover:bg-violet-500/10';
  if (tone === 'emerald') return 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10';
  return 'border-slate-500/30 text-slate-300 hover:bg-slate-500/10';
}

function RiskActionForm({
  action,
  fields,
  label,
  tone,
  title,
  detail,
  requiredPhrase,
}: {
  action: AdminAction;
  fields: Record<string, string>;
  label: string;
  tone: 'orange' | 'violet' | 'slate' | 'emerald';
  title: string;
  detail: string;
  requiredPhrase?: string;
}) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const canSubmit = !requiredPhrase || phrase.trim() === requiredPhrase;

  return (
    <form action={action} className="relative">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-all ${riskButtonClasses(tone)}`}
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={title}
          className="absolute right-0 top-full z-40 mt-2 w-[18rem] rounded-xl border border-[#1e3a5f] bg-[#080c14] p-3 text-left shadow-2xl"
        >
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white">{title}</div>
          <p className="mt-2 text-[11px] leading-relaxed text-[#bfdbfe]/70">{detail}</p>
          {requiredPhrase && (
            <label className="mt-3 block">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#93c5fd]/55">
                Type {requiredPhrase}
              </span>
              <input
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[#1e3a5f] bg-[#0d1526] px-3 py-2 text-xs text-white outline-none focus:border-[#60a5fa]"
              />
            </label>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPhrase('');
              }}
              className="rounded-lg border border-[#1e3a5f] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#93c5fd]/55 transition-colors hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-all disabled:cursor-not-allowed disabled:opacity-40 ${riskButtonClasses(tone)}`}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

export function RosterTable({
  users,
  totalDevices,
}: {
  users: RosterUser[];
  totalDevices: number;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(true);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter(u => {
        if ((u.email ?? '').toLowerCase().includes(q)) return true;
        return deviceNames(u.assignments).some(s => s.toLowerCase().includes(q));
      })
    : users;

  return (
    <div id="client-access-roster" className="bg-[#0d1526] border border-[#1e3a5f] rounded-xl shadow-2xl overflow-hidden">

      <div className="flex flex-wrap gap-4 items-center justify-between px-7 py-5 border-b border-[#1e3a5f]">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="client-device-roster-panel"
          className="flex items-center gap-3 text-left transition-opacity hover:opacity-85"
        >
          <span className="text-[#93c5fd]/55"><ChevronIcon open={open} /></span>
          <span>
            <span className="block text-base font-bold text-white">Client &amp; Device Roster</span>
            <span className="mt-0.5 block text-[11px] text-[#93c5fd]/65">
              {q
                ? `${filtered.length} of ${users.length} user${users.length !== 1 ? 's' : ''} match`
                : 'All accounts and their assigned Victron units'}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2.5" opacity="0.45">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search user or device…"
              className="bg-[#080c14] border border-[#1e3a5f] rounded-lg pl-8 pr-8 py-2 text-xs text-white placeholder:text-[#93c5fd]/25 outline-none focus:border-[#3b82f6]/60 transition-colors font-mono w-52"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#93c5fd]/30 hover:text-white text-xs transition-colors"
              >
                ✕
              </button>
            )}
          </div>
          <span className="text-xs font-bold text-[#93c5fd]/75 bg-[#1e40af]/20 px-3 py-1 rounded-full border border-[#1e40af]/30 whitespace-nowrap">
            {totalDevices} Devices
          </span>
        </div>
      </div>

      {open && (
      <div id="client-device-roster-panel" className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-bold text-[#93c5fd]/65 uppercase tracking-widest border-b border-[#1e3a5f] bg-[#080c14]/60">
              <th className="px-7 py-4">Account</th>
              <th className="px-7 py-4">Role</th>
              <th className="px-7 py-4">Assigned Devices</th>
              <th className="px-7 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const isAdmin     = u.role === 'admin';
              const isPending   = !u.last_sign_in_at;
              const isSuspended = u.status === 'suspended';

              return (
                <tr key={u.id} className="border-b border-[#1e3a5f]/50 hover:bg-[#1e3a5f]/10 transition-colors">

                  {/* Account */}
                  <td className="px-7 py-5 max-w-[200px]">
                    <div className="text-sm font-semibold text-white truncate">{u.email}</div>
                    {isPending ? (
                      <div className="text-[10px] text-amber-400/70 mt-1 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Awaiting activation
                      </div>
                    ) : isSuspended ? (
                      <div className="text-[10px] text-red-400/70 mt-1 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                        Suspended
                      </div>
                    ) : (
                      <div className="text-[10px] text-[#93c5fd]/60 mt-1">
                        Last active {new Date(u.last_sign_in_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                  </td>

                  {/* Role */}
                  <td className="px-7 py-5">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold border ${
                      isAdmin
                        ? 'bg-violet-900/20 text-violet-300 border-violet-500/30'
                        : 'bg-[#1e40af]/10 text-[#93c5fd]/70 border-[#1e40af]/20'
                    }`}>
                      {isAdmin ? '⬡ Admin' : '◯ Client'}
                    </span>
                  </td>

                  {/* Devices */}
                  <td className="px-7 py-5">
                    <DevicesCell assignments={u.assignments} />
                  </td>

                  {/* Actions */}
                  <td className="px-7 py-5 text-right">
                    <div className="flex justify-end gap-2 flex-wrap">

                      {isPending && (
                        <form action={resendInvite}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="email" value={u.email ?? ''} />
                          <button type="submit"
                            className="text-[10px] font-bold px-3 py-2 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all">
                            Resend Invite
                          </button>
                        </form>
                      )}

                      {!isPending && (
                        <form action={sendPasswordReset}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="email" value={u.email ?? ''} />
                          <button type="submit"
                            className="text-[10px] font-bold px-3 py-2 rounded-lg border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 transition-all">
                            Reset Password
                          </button>
                        </form>
                      )}

                      {!isPending && (
                        <RiskActionForm
                          action={updateUserStatus}
                          fields={{ userId: u.id, status: isSuspended ? 'active' : 'suspended' }}
                          label={isSuspended ? 'Reactivate' : 'Suspend'}
                          tone={isSuspended ? 'emerald' : 'orange'}
                          title={isSuspended ? 'Reactivate account' : 'Suspend account'}
                          detail={
                            isSuspended
                              ? `${u.email} will regain portal access if their credentials are valid.`
                              : `${u.email} will lose portal access until an admin reactivates the account.`
                          }
                          requiredPhrase={isSuspended ? undefined : 'SUSPEND'}
                        />
                      )}

                      <RiskActionForm
                        action={updateUserRole}
                        fields={{ userId: u.id, role: isAdmin ? 'user' : 'admin' }}
                        label={isAdmin ? 'Revoke Admin' : 'Make Admin'}
                        tone={isAdmin ? 'slate' : 'violet'}
                        title={isAdmin ? 'Revoke administrator role' : 'Grant administrator role'}
                        detail={
                          isAdmin
                            ? `${u.email} will lose administrator privileges but keep normal portal access.`
                            : `${u.email} will be able to manage users, devices, assignments, forms, and operational data.`
                        }
                        requiredPhrase={isAdmin ? 'REVOKE ADMIN' : 'MAKE ADMIN'}
                      />

                      <DeleteUserButton userId={u.id} email={u.email ?? ''} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-[#93c5fd]/60 text-sm">
            {q
              ? `No users or devices match "${query}"`
              : 'No clients yet. Invite your first client using the panel on the left.'}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
