import { readFile } from "fs/promises";
import path from "path";
import type { AggregateResult, PartyMethodCounts } from "./ingest/aggregate";

export type OfficialVr = {
  asOf: string;
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
