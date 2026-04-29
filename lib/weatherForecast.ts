import type { ReportSeverity } from '@/lib/historicalIntelligence';

export interface WeatherForecastWindow {
  fetchedAt: string;
  latitude: number;
  longitude: number;
  timezone: string;
  avgCloudCoverPct: number | null;
  solarRadiationWhM2: number | null;
  peakSolarRadiationWM2: number | null;
  precipitationProbabilityMaxPct: number | null;
  windMphMax: number | null;
  temperatureMinF: number | null;
  temperatureMaxF: number | null;
  daylightHours: number | null;
  sunshineHours: number | null;
  weatherCode: number | null;
}

export interface WeatherForecastAssessment {
  severity: ReportSeverity;
  label: string;
  summary: string;
  confidence: number;
  evidence: string[];
  forecast: WeatherForecastWindow;
}

type CacheEntry = {
  expiresAt: number;
  value: WeatherForecastWindow | null;
};

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_CACHE_MS = 30 * 60_000;
const WEATHER_TIMEOUT_MS = 6_000;
const weatherCache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lon: number) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function finiteValues(values: unknown): number[] {
  return Array.isArray(values)
    ? values.map(Number).filter(Number.isFinite)
    : [];
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function max(values: number[]) {
  return values.length > 0 ? Math.max(...values) : null;
}

function min(values: number[]) {
  return values.length > 0 ? Math.min(...values) : null;
}

function rounded(value: number | null, digits = 0) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function weatherLabel(code: number | null) {
  if (code == null) return 'forecast available';
  if ([0, 1].includes(code)) return 'clear solar window';
  if ([2, 3].includes(code)) return 'cloud-mixed solar window';
  if ([45, 48].includes(code)) return 'fog may reduce visibility';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'wet weather risk';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow/ice weather risk';
  if ([95, 96, 99].includes(code)) return 'storm risk';
  return 'weather window available';
}

function severityForForecast(forecast: WeatherForecastWindow): ReportSeverity {
  const radiation = forecast.solarRadiationWhM2;
  const cloud = forecast.avgCloudCoverPct;
  const precip = forecast.precipitationProbabilityMaxPct;
  const wind = forecast.windMphMax;
  const stormCode = forecast.weatherCode != null && [95, 96, 99].includes(forecast.weatherCode);

  if (stormCode || (wind != null && wind >= 50)) return 'critical';
  if ((radiation != null && radiation < 1200) || (cloud != null && cloud >= 82) || (precip != null && precip >= 80) || (wind != null && wind >= 38)) {
    return 'action';
  }
  if ((radiation != null && radiation < 2500) || (cloud != null && cloud >= 62) || (precip != null && precip >= 55) || (wind != null && wind >= 28)) {
    return 'watch';
  }
  return 'info';
}

function buildSummary(forecast: WeatherForecastWindow, severity: ReportSeverity) {
  const radiation = forecast.solarRadiationWhM2 == null ? 'unknown solar radiation' : `${Math.round(forecast.solarRadiationWhM2)} Wh/m2 solar radiation`;
  const cloud = forecast.avgCloudCoverPct == null ? 'unknown cloud cover' : `${Math.round(forecast.avgCloudCoverPct)}% average cloud cover`;
  const precip = forecast.precipitationProbabilityMaxPct == null ? 'unknown precipitation probability' : `${Math.round(forecast.precipitationProbabilityMaxPct)}% peak precipitation probability`;
  const wind = forecast.windMphMax == null ? 'unknown wind' : `${Math.round(forecast.windMphMax)} mph max wind`;

  if (severity === 'critical') return `Weather may materially threaten service continuity: ${radiation}, ${cloud}, ${precip}, and ${wind}.`;
  if (severity === 'action') return `Weather is likely to reduce recovery margin: ${radiation}, ${cloud}, ${precip}, and ${wind}.`;
  if (severity === 'watch') return `Weather should be watched against battery reserve: ${radiation}, ${cloud}, ${precip}, and ${wind}.`;
  return `Weather supports normal operation: ${radiation}, ${cloud}, ${precip}, and ${wind}.`;
}

export async function fetchWeatherForecast(lat: number, lon: number): Promise<WeatherForecastWindow | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  const key = cacheKey(lat, lon);
  const cached = weatherCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m');
  url.searchParams.set('hourly', 'shortwave_radiation,cloud_cover,precipitation_probability,temperature_2m,wind_speed_10m');
  url.searchParams.set('daily', 'weather_code,shortwave_radiation_sum,precipitation_probability_max,wind_speed_10m_max,sunshine_duration,daylight_duration');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '3');
  url.searchParams.set('forecast_hours', '24');

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
    const json = await response.json();
    const cloud = finiteValues(json?.hourly?.cloud_cover);
    const radiation = finiteValues(json?.hourly?.shortwave_radiation);
    const precipitation = finiteValues(json?.hourly?.precipitation_probability);
    const wind = finiteValues(json?.hourly?.wind_speed_10m);
    const temp = finiteValues(json?.hourly?.temperature_2m);
    const dailySunshine = finiteValues(json?.daily?.sunshine_duration);
    const dailyDaylight = finiteValues(json?.daily?.daylight_duration);
    const dailyCodes = finiteValues(json?.daily?.weather_code);
    const currentCode = Number(json?.current?.weather_code);

    const value: WeatherForecastWindow = {
      fetchedAt: new Date().toISOString(),
      latitude: lat,
      longitude: lon,
      timezone: String(json?.timezone ?? 'auto'),
      avgCloudCoverPct: rounded(average(cloud)),
      solarRadiationWhM2: rounded(radiation.reduce((sum, item) => sum + item, 0)),
      peakSolarRadiationWM2: rounded(max(radiation)),
      precipitationProbabilityMaxPct: rounded(max(precipitation)),
      windMphMax: rounded(max(wind)),
      temperatureMinF: rounded(min(temp)),
      temperatureMaxF: rounded(max(temp)),
      daylightHours: dailyDaylight[0] != null ? rounded(dailyDaylight[0] / 3600, 1) : null,
      sunshineHours: dailySunshine[0] != null ? rounded(dailySunshine[0] / 3600, 1) : null,
      weatherCode: Number.isFinite(currentCode) ? currentCode : dailyCodes[0] ?? null,
    };

    weatherCache.set(key, { value, expiresAt: Date.now() + WEATHER_CACHE_MS });
    return value;
  } catch (error: any) {
    console.warn('[weather-forecast] lookup failed:', error?.message ?? error);
    weatherCache.set(key, { value: null, expiresAt: Date.now() + 5 * 60_000 });
    return null;
  }
}

export function assessWeatherForecast(forecast: WeatherForecastWindow | null): WeatherForecastAssessment | null {
  if (!forecast) return null;
  const severity = severityForForecast(forecast);
  const label = weatherLabel(forecast.weatherCode);
  return {
    severity,
    label,
    summary: buildSummary(forecast, severity),
    confidence: forecast.solarRadiationWhM2 == null ? 55 : forecast.avgCloudCoverPct == null ? 68 : 82,
    evidence: [
      forecast.solarRadiationWhM2 == null ? 'Solar radiation forecast unavailable' : `Next 24h solar radiation: ${Math.round(forecast.solarRadiationWhM2)} Wh/m2`,
      forecast.avgCloudCoverPct == null ? 'Cloud cover forecast unavailable' : `Average cloud cover: ${Math.round(forecast.avgCloudCoverPct)}%`,
      forecast.precipitationProbabilityMaxPct == null ? 'Precipitation forecast unavailable' : `Peak precipitation probability: ${Math.round(forecast.precipitationProbabilityMaxPct)}%`,
      forecast.windMphMax == null ? 'Wind forecast unavailable' : `Max wind: ${Math.round(forecast.windMphMax)} mph`,
    ],
    forecast,
  };
}
