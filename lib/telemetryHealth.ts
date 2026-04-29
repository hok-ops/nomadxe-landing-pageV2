import type { VRMData } from './vrm';

const MIN_EXPECTED_DC_LOAD_W = 1;

export function formatWatts(value: number) {
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 1000) return `${(rounded / 1000).toFixed(1)} kW`;
  return `${rounded} W`;
}

export function hasMissingDcLoadSignal(data: VRMData | null | undefined): boolean {
  if (!data || data.lastSeen <= 0) return false;
  if (data.hasDcLoadReading === false) return true;

  const loadW = Math.abs(Number(data.dcLoad) || 0);
  if (loadW > MIN_EXPECTED_DC_LOAD_W) return false;

  const hasLiveTelemetry =
    data.battery.voltage > 10 ||
    data.battery.soc > 0 ||
    Math.abs(data.battery.current) > 0.05 ||
    Math.abs(data.battery.power) > 0.5 ||
    Math.abs(data.solar.power) > 0.5 ||
    data.solar.voltage > 0;

  return hasLiveTelemetry;
}

export function getDcLoadSignalTitle(data: VRMData | null | undefined): string {
  if (!data || data.lastSeen <= 0) return 'DC load pending';
  if (data.hasDcLoadReading === false) return 'No direct DC load reading';
  if (hasMissingDcLoadSignal(data)) return 'No DC load signal';
  return 'DC load reading';
}

export function getDcLoadSignalDetail(data: VRMData | null | undefined): string {
  if (!data || data.lastSeen <= 0) return 'Awaiting telemetry.';
  if (data.hasDcLoadReading === false) {
    return `Using an estimate of ${formatWatts(data.dcLoad)} from solar and battery flow.`;
  }
  if (hasMissingDcLoadSignal(data)) {
    return 'Battery and system telemetry are present, but DC load is reporting zero. Verify the DC System source.';
  }
  return `${formatWatts(data.dcLoad)} direct load reported.`;
}
