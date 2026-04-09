'use client';

import type { VRMData } from './NomadXECoreView';
import { useTheme } from '@/components/ThemeProvider';

function getBatteryColor(soc: number, light: boolean) {
  if (soc >= 75) return light ? '#16a34a' : '#22c55e';  // green-600 / green-500
  if (soc >= 25) return light ? '#2563eb' : '#3b82f6';  // blue-600  / blue-500
  return               light ? '#dc2626' : '#ef4444';   // red-600   / red-500
}

const MPPT_LABEL_COLOR: Record<string, string> = {
  Float: '#22c55e', Storage: '#22c55e',
  Bulk: '#f59e0b', Absorption: '#f59e0b',
  Fault: '#ef4444',
  Off: '#9ca3af',  // raised from #4b5563 (2.8:1) to #9ca3af (6.1:1) — passes WCAG AA
};

interface Props {
  device: { siteId: string; name: string; displayName?: string | null };
  data: VRMData | null;
  selected: boolean;
  onClick: () => void;
}

export default function FleetTile({ device, data, selected, onClick }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const nowS     = Date.now() / 1000;
  const lastSeenS = data?.lastSeen ?? 0;
  const isOffline = lastSeenS > 0 && (nowS - lastSeenS) > 15 * 60;
  const noData    = lastSeenS === 0;

  const soc        = data?.battery.soc ?? 0;
  const batColor   = getBatteryColor(soc, isLight);
  const solarW     = data?.solar.power ?? 0;
  const solarActive = solarW > 5;
  const mpptLabel  = data?.solar.mpptStateLabel ?? 'Off';
  const mpptColor  = MPPT_LABEL_COLOR[mpptLabel] ?? '#4b5563';
  const charging   = (data?.battery.state ?? 0) === 1;
  const discharging = (data?.battery.state ?? 0) === 2;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-all duration-200 focus:outline-none group ${
        selected
          ? 'border-[#3b82f6]/60 bg-[#1e40af]/10 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]'
          : 'border-[#1e3a5f] bg-[#080c14] hover:border-[#1e3a5f]/80 hover:bg-[#0d1526]'
      }`}
    >
      {/* Row 1: name + status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${
              noData ? 'bg-[#4b5563]' :
              isOffline ? 'bg-red-500' :
              'bg-emerald-400 animate-pulse'
            }`}
            style={(!noData && !isOffline) ? { boxShadow: '0 0 5px #4ade80' } : {}}
          />
          <span className="text-[13px] font-bold text-white truncate">
            {device.displayName ?? device.name}
          </span>
        </div>
        <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex-shrink-0 ml-2`}
          style={{ color: mpptColor, background: mpptColor + '18', border: `1px solid ${mpptColor}30` }}>
          {mpptLabel}
        </span>
      </div>

      {/* Row 2: Battery SOC */}
      <div className="flex items-center gap-2 mb-1.5">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={batColor} strokeWidth="2">
          <rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2" />
        </svg>
        <div className="flex-1 h-1.5 bg-[#0a0f1e] rounded-full overflow-hidden border border-[#1e3a5f]/60">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.max(0, Math.min(100, soc))}%`, backgroundColor: batColor, boxShadow: isLight ? 'none' : `0 0 4px ${batColor}` }} />
        </div>
        <span className="text-[12px] font-black tabular-nums flex-shrink-0" style={{ color: batColor }}>
          {soc}<span className="text-[9px] font-bold opacity-50">%</span>
        </span>
      </div>

      {/* Row 3: Solar + charge direction */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke={solarActive ? (isLight ? '#16a34a' : '#22c55e') : (isLight ? '#94a3b8' : '#6b7280')} strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
            <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
          </svg>
          <span className="text-[11px] font-mono font-bold"
            style={{ color: solarActive ? (isLight ? '#16a34a' : '#22c55e') : (isLight ? '#94a3b8' : '#6b7280') }}>
            {solarW}W
          </span>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-widest" style={{
          color: charging
            ? (isLight ? '#16a34a' : '#22c55ecc')
            : discharging
              ? (isLight ? '#d97706' : '#f59e0bcc')
              : (isLight ? '#64748b'  : '#93c5fd80'),
        }}>
          {charging ? '↑ chg' : discharging ? '↓ bat' : noData ? '—' : 'stby'}
        </span>
      </div>

      {/* Row 4: Site ID — small, bottom of card */}
      <div className="mt-1 text-[9px] font-mono text-[#93c5fd]/50 truncate">
        {device.siteId}
      </div>
    </button>
  );
}
