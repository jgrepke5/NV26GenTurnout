import { readFile } from "fs/promises";
import path from "path";
import {
  metricsFromCounts,
  type AdvantageMetrics,
  type GeoAdvantage,
} from "./advantage";

export type HistoricSeriesFile = {
  generatedAt: string;
  /** geoKey → year → evDayIndex → metrics */
  series: Record<string, Record<string, Record<string, AdvantageMetrics>>>;
};

const HISTORIC_PATH = path.join(
  process.cwd(),
  "data",
  "historic-rd-advantage.json",
);

let cached: HistoricSeriesFile | null = null;

export async function loadHistoricSeries(): Promise<HistoricSeriesFile> {
  if (cached) return cached;
  const raw = await readFile(HISTORIC_PATH, "utf-8");
  cached = JSON.parse(raw) as HistoricSeriesFile;
  return cached;
}

export function lookupHistoric(
  series: HistoricSeriesFile,
  geoKey: string,
  year: "2022" | "2024",
  evDayIndex: number,
): AdvantageMetrics | null {
  const byYear = series.series[geoKey];
  if (!byYear) return null;
  const byDay = byYear[year];
  if (!byDay) return null;
  // Cap at max available day
  const keys = Object.keys(byDay)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (keys.length === 0) return null;
  const idx = Math.min(evDayIndex, keys[keys.length - 1]!);
  return byDay[String(idx)] ?? null;
}

export function attachHistoric(
  geo: Omit<GeoAdvantage, "historic2022" | "historic2024">,
  series: HistoricSeriesFile,
  evDayIndex: number,
): GeoAdvantage {
  // Show 2022/2024 whenever the historic series has this geography.
  return {
    ...geo,
    historic2022: lookupHistoric(series, geo.geoKey, "2022", evDayIndex),
    historic2024: lookupHistoric(series, geo.geoKey, "2024", evDayIndex),
  };
}

/** Re-export for scripts that build metrics while importing. */
export { metricsFromCounts };
