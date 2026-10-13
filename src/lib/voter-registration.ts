import { readFile } from "fs/promises";
import path from "path";
import {
  formatCount,
  formatPct,
  type AggregateResult,
  type PartyMethodCounts,
} from "./ingest/aggregate";
import type { CellValue, SheetTable, TurnoutSnapshot } from "./types";

export type OfficialVr = {
  asOf: string;
  source?: string;
  statewide: number;
  counties: Record<string, number>;
  congress: Record<string, number>;
  senate: Record<string, number>;
  assembly: Record<string, number>;
};

const VR_PATH = path.join(process.cwd(), "data", "voter-registration.json");

let cached: OfficialVr | null = null;

export async function loadOfficialVr(): Promise<OfficialVr> {
  if (cached) return cached;
  const raw = await readFile(VR_PATH, "utf-8");
  cached = JSON.parse(raw) as OfficialVr;
  return cached;
}

function setRegistered(bucket: PartyMethodCounts | undefined, n: number) {
  if (bucket) bucket.registered = n;
}

/** Overlay SOS active VR totals onto aggregate buckets (replaces VIVID row counts). */
export function applyOfficialVr(
  agg: AggregateResult,
  vr: OfficialVr,
): AggregateResult {
  agg.statewide.registered = vr.statewide;

  for (const [county, n] of Object.entries(vr.counties)) {
    setRegistered(agg.counties.get(county.toUpperCase()), n);
    // Ensure county exists even with zero votes so VR still shows
    if (!agg.counties.has(county.toUpperCase())) {
      agg.counties.set(county.toUpperCase(), {
        REP: { early: 0, mail: 0, eday: 0, other: 0 },
        DEM: { early: 0, mail: 0, eday: 0, other: 0 },
        OTHER: { early: 0, mail: 0, eday: 0, other: 0 },
        registered: n,
      });
    } else {
      agg.counties.get(county.toUpperCase())!.registered = n;
    }
  }

  const setDistrictVr = (
    map: Map<string, PartyMethodCounts>,
    id: string,
    n: number,
  ) => {
    const key = String(Number(id));
    const candidates = [id, key, id.padStart(2, "0"), key.padStart(2, "0")];
    let bucket: PartyMethodCounts | undefined;
    for (const c of candidates) {
      bucket = map.get(c);
      if (bucket) break;
    }
    // Also match whatever keys already exist numerically
    if (!bucket) {
      for (const [k, b] of map) {
        if (String(Number(k)) === key) {
          bucket = b;
          break;
        }
      }
    }
    if (bucket) bucket.registered = n;
    else {
      map.set(key, {
        REP: { early: 0, mail: 0, eday: 0, other: 0 },
        DEM: { early: 0, mail: 0, eday: 0, other: 0 },
        OTHER: { early: 0, mail: 0, eday: 0, other: 0 },
        registered: n,
      });
    }
  };

  for (const [cd, n] of Object.entries(vr.congress)) {
    setDistrictVr(agg.congress, cd, n);
  }
  for (const [sd, n] of Object.entries(vr.senate)) {
    setDistrictVr(agg.senate, sd, n);
  }
  for (const [ad, n] of Object.entries(vr.assembly)) {
    setDistrictVr(agg.assembly, ad, n);
  }

  return agg;
}

function parseCountCell(v: CellValue): number | null {
  if (v == null || v === "" || v === "—") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function vrColumnIndex(headers: string[]): number {
  return headers.findIndex((h) => /'26\s*vr|2026\s*vr|26\s*vr/i.test(h));
}

function turnoutColumnIndex(headers: string[]): number {
  return headers.findIndex((h) =>
    /turnout\s*%|'26\s*to\s*%|2026\s*turnout/i.test(h),
  );
}

function votesColumnIndex(headers: string[]): number {
  return headers.findIndex((h) => /votes to date|total votes/i.test(h));
}

function setRowVr(
  row: CellValue[],
  vrIdx: number,
  turnoutIdx: number,
  votesIdx: number,
  registered: number,
) {
  row[vrIdx] = formatCount(registered);
  if (turnoutIdx >= 0 && votesIdx >= 0) {
    const votes = parseCountCell(row[votesIdx]);
    row[turnoutIdx] =
      votes != null && registered > 0 ? formatPct(votes / registered) : "—";
  }
}

function isPartySubrow(label: string): boolean {
  return /^\s/.test(label) || /^(democrat|republican|non-partisan)/i.test(label.trim());
}

function countyVr(vr: OfficialVr, label: string): number | null {
  const key = label.trim().toUpperCase();
  if (key === "TOTAL") return vr.statewide;
  if (key === "RURALS") {
    return Object.entries(vr.counties)
      .filter(([c]) => c !== "CLARK" && c !== "WASHOE")
      .reduce((sum, [, n]) => sum + n, 0);
  }
  return vr.counties[key] ?? null;
}

function districtVr(
  map: Record<string, number>,
  label: string,
  prefix: RegExp,
): number | null {
  const m = label.trim().match(prefix);
  if (!m) return null;
  const id = String(Number(m[1]));
  return map[id] ?? map[m[1]] ?? map[id.padStart(2, "0")] ?? null;
}

function patchSheetVr(sheet: SheetTable, vr: OfficialVr) {
  const vrIdx = vrColumnIndex(sheet.headers);
  if (vrIdx < 0) return;
  const turnoutIdx = turnoutColumnIndex(sheet.headers);
  const votesIdx = votesColumnIndex(sheet.headers);
  const title = sheet.title.toLowerCase();

  for (const row of sheet.rows) {
    if (!row.length) continue;
    const label = String(row[0] ?? "");
    if (!label || isPartySubrow(label)) continue;
    // Section banners like "RURALS", "CLARK", "NON-COMPETITIVE..."
    if (row.length === 1) continue;

    let registered: number | null = null;
    if (title === "statewide") {
      if (label.trim().toLowerCase() === "total") registered = vr.statewide;
    } else if (title === "county") {
      registered = countyVr(vr, label);
    } else if (title === "congressional") {
      registered = districtVr(vr.congress, label, /^CD\s*(\d+)/i);
    } else if (title === "legislative") {
      registered =
        districtVr(vr.senate, label, /^SD\s*(\d+)/i) ??
        districtVr(vr.assembly, label, /^AD\s*(\d+)/i);
    } else if (title === "commission") {
      // No SOS commission totals — clear VIVID row-count VR so it is not
      // mistaken for official registration.
      row[vrIdx] = null;
      if (turnoutIdx >= 0) row[turnoutIdx] = null;
      continue;
    }

    if (registered != null) {
      setRowVr(row, vrIdx, turnoutIdx, votesIdx, registered);
    }
  }
}

/** Re-apply SOS VR onto sheet cells (build/read path — does not need File 6). */
export async function applyOfficialVrToSnapshot(
  snapshot: TurnoutSnapshot,
): Promise<TurnoutSnapshot> {
  const vr = await loadOfficialVr();
  for (const sheet of snapshot.sheets) {
    patchSheetVr(sheet, vr);
  }
  return snapshot;
}
