'use client';

import { useState } from 'react';
import { inviteNewUser, registerDevice } from './actions';
import { AssignDeviceForm } from './AssignDeviceForm';
import CopyOrderLink from './CopyOrderLink';
import GenerateLinkTool from './GenerateLinkTool';

type UserItem = { id: string; email: string | undefined };
type DeviceItem = { id: number; name: string; vrm_site_id: string };

interface Props {
  userList: UserItem[];
  deviceList: DeviceItem[];
  assignmentMap: Record<string, number[]>;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
    >
      <path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AccordionSection({
  label,
  defaultOpen = true,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#0d1526] border border-[#1e3a5f] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#111d36] transition-colors"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#93c5fd]/70">{label}</span>
        <span className="text-[#93c5fd]/50">
          <ChevronIcon open={open} />
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-[#1e3a5f]/50">
          {children}
        </div>
      )}
    </div>
  );
}

export function AdminLeftPanel({
  userList,
  deviceList,
  assignmentMap,
}: Props) {
  return (
    <div className="space-y-4">
      <AccordionSection label="Client Management" defaultOpen={true}>
        <div className="pt-4 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white mb-1">Invite New Client</h2>
            <p className="text-[11px] text-[#93c5fd]/70 leading-relaxed">
              Sends a secure invite email. Client sets their own password on first login.
            </p>
          </div>
          <form action={inviteNewUser} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-[#93c5fd]/75 font-bold">Client Email</label>
              <input
                name="email"
                type="email"
                required
                className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
                placeholder="client@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-[#93c5fd]/75 font-bold">
                Victron Site ID <span className="normal-case text-[#93c5fd]/60 font-normal">(optional)</span>
              </label>
              <input
                name="vrm_site_id"
                className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
                placeholder="e.g. 123456"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-[#93c5fd]/75 font-bold">
                Device Name <span className="normal-case text-[#93c5fd]/60 font-normal">(optional)</span>
              </label>
              <input
                name="device_name"
                className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
                placeholder="e.g. Unit Alpha"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold py-3 rounded-lg text-sm transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] active:scale-[0.98]"
            >
              Send Invitation
            </button>
          </form>
        </div>

        <div className="border-t border-[#1e3a5f]/40" />

        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-white mb-1">Assign Device to User</h2>
            <p className="text-[11px] text-[#93c5fd]/70 leading-relaxed">
              Link an additional Victron unit to an existing client. Each user can have multiple units.
            </p>
          </div>
          <AssignDeviceForm users={userList} devices={deviceList} assignmentMap={assignmentMap} />
        </div>

        <div className="border-t border-[#1e3a5f]/40" />

        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-white mb-1">Register Victron Device</h2>
            <p className="text-[11px] text-[#93c5fd]/70 leading-relaxed">
              Add a device to the fleet. Find the Site ID in VRM to link trailer telemetry.
            </p>
          </div>
          <form action={registerDevice} className="space-y-4">
            <input
              name="vrm_site_id"
              required
              className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
              placeholder="VRM Site ID"
            />
            <input
              name="name"
              required
              className="w-full bg-[#080c14] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#93c5fd]/20 outline-none focus:border-[#3b82f6] transition-colors"
              placeholder="Device name (e.g. Unit Bravo)"
            />
            <button
              type="submit"
              className="w-full border border-[#1e40af]/60 text-[#93c5fd]/70 hover:bg-[#1e40af]/20 font-bold py-3 rounded-lg text-sm transition-all active:scale-[0.98]"
            >
              Register Device
            </button>
          </form>
        </div>
      </AccordionSection>

      <AccordionSection label="Field Operations" defaultOpen={true}>
        <div className="pt-4">
          <CopyOrderLink />
        </div>
      </AccordionSection>

      <AccordionSection label="Tools & Reference" defaultOpen={false}>
        <div className="pt-4">
          <GenerateLinkTool users={userList} />
        </div>

        <div className="border-t border-[#1e3a5f]/40" />

        <div className="pt-1 space-y-4">
          <h2 className="text-xs font-bold text-[#3b82f6] uppercase tracking-widest">How This Works</h2>
          <ol className="space-y-3 text-[11px] text-[#93c5fd]/70 leading-relaxed">
            {[
              ['Invite a client', 'They receive an activation email and set their own password.'],
              ['Assign additional units', 'Use "Assign Device" to link extra Victron units after signup.'],
              ['Review LAN operations', 'Use the full-width LAN Device Operations section for fleet network visibility.'],
              ['Manage roles & access', 'Toggle Admin, suspend, send a new password reset, or delete.'],
            ].map(([title, desc], i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1e40af] text-white flex items-center justify-center text-[9px] font-black">{i + 1}</span>
                <span><strong className="text-white">{title} - </strong>{desc}</span>
              </li>
            ))}
          </ol>
          <div className="pt-3 border-t border-[#1e3a5f]/40 text-[10px] text-amber-400/80">
            Set <code className="text-amber-300">NEXT_PUBLIC_SITE_URL=https://www.nomadxe.com</code> in Vercel so invite/reset emails link correctly.
          </div>
        </div>
      </AccordionSection>
    </div>
  );
}
