import { createReadStream } from "fs";
import { createInterface } from "readline";
import {
  metricsFromCounts,
  partyBucket,
  type AdvantageMetrics,
} from "../advantage";
import { parseCsvLine } from "./csv";

export type MethodKey = "early" | "mail" | "eday" | "other";

export type PartyBucket = Record<MethodKey, number> & { registered: number };

export type PartyMethodCounts = {
  REP: PartyBucket;
  DEM: PartyBucket;
  OTHER: PartyBucket;
  /** Sum of party registered counts (File 6 rows in this geography). */
  registered: number;
};

function emptyPartyMethods(): PartyMethodCounts {
  const z = (): PartyBucket => ({
    early: 0,
    mail: 0,
    eday: 0,
    other: 0,
    registered: 0,
  });
  return { REP: z(), DEM: z(), OTHER: z(), registered: 0 };
}

function methodKey(raw: string): MethodKey {
  const m = raw.trim().toLowerCase();
  if (m === "mail") return "mail";
  if (m.includes("early")) return "early";
  if (m.includes("election")) return "eday";
  return "other";
}

export type AggregateResult = {
  extractAt: string | null;
  statewide: PartyMethodCounts;
  counties: Map<string, PartyMethodCounts>;
  congress: Map<string, PartyMethodCounts>;
  senate: Map<string, PartyMethodCounts>;
  assembly: Map<string, PartyMethodCounts>;
  /** key: `${county}|${district}` e.g. CLARK|F */
  commission: Map<string, PartyMethodCounts>;
  acceptedVotes: number;
};

function bump(
  bucket: PartyMethodCounts,
  party: "REP" | "DEM" | "OTHER",
  method: MethodKey,
) {
  bucket[party][method] += 1;
}

function ensure(
  map: Map<string, PartyMethodCounts>,
  key: string,
): PartyMethodCounts {
  let b = map.get(key);
  if (!b) {
    b = emptyPartyMethods();
    map.set(key, b);
  }
  return b;
}

export async function aggregateVividCsv(
  csvPath: string,
): Promise<AggregateResult> {
  const result: AggregateResult = {
    extractAt: null,
    statewide: emptyPartyMethods(),
    counties: new Map(),
    congress: new Map(),
    senate: new Map(),
    assembly: new Map(),
    commission: new Map(),
    acceptedVotes: 0,
  };

  const rl = createInterface({
    input: createReadStream(csvPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let idx: Record<string, number> | null = null;
  let rowNum = 0;

  for await (const line of rl) {
    rowNum++;
    if (rowNum === 1) {
      const headers = parseCsvLine(line.replace(/^\uFEFF/, "")).map((h) =>
        h.trim(),
      );
      idx = Object.fromEntries(headers.map((h, i) => [h, i]));
      const required = [
        "VOTER_REG_PARTY",
        "VOTE_METHOD",
        "BALLOT_STATUS",
        "REGISTRATION_COUNTY",
      ];
      for (const col of required) {
        if (idx[col] == null) {
          throw new Error(`VIVID CSV missing required column: ${col}`);
        }
      }
      continue;
    }

    if (!idx) continue;
    const cols = parseCsvLine(line);
    const get = (name: string) => (cols[idx![name] ?? -1] ?? "").trim();

    if (!result.extractAt) {
      const dt = get("DATE_TIME_UPDATED");
      if (dt) result.extractAt = dt;
    }

    const county = get("REGISTRATION_COUNTY").toUpperCase();
    const party = partyBucket(get("VOTER_REG_PARTY"));
    const congress = get("CONGRESS");
    const senate = get("SENATE");
    const assembly = get("ASSEMBLY");
    const commission = get("COMMISSION");

    // Registration universe (every File 6 row, by VOTER_REG_PARTY)
    const bumpRegistered = (b: PartyMethodCounts) => {
      b[party].registered += 1;
      b.registered += 1;
    };
    bumpRegistered(result.statewide);
    if (county) bumpRegistered(ensure(result.counties, county));
    if (congress) bumpRegistered(ensure(result.congress, congress));
    if (senate) bumpRegistered(ensure(result.senate, senate));
    if (assembly) bumpRegistered(ensure(result.assembly, assembly));
    if (county && commission) {
      bumpRegistered(ensure(result.commission, `${county}|${commission}`));
    }

    const status = get("BALLOT_STATUS");
    const voteMethod = get("VOTE_METHOD");
    if (!voteMethod || status.toLowerCase() !== "accepted") continue;

    result.acceptedVotes += 1;
    const mk = methodKey(voteMethod);

    bump(result.statewide, party, mk);
    if (county) bump(ensure(result.counties, county), party, mk);
    if (congress) bump(ensure(result.congress, congress), party, mk);
    if (senate) bump(ensure(result.senate, senate), party, mk);
    if (assembly) bump(ensure(result.assembly, assembly), party, mk);
    if (county && commission) {
      bump(ensure(result.commission, `${county}|${commission}`), party, mk);
    }
  }

  return result;
}

export function votesForParty(
  b: PartyMethodCounts,
  party: "REP" | "DEM" | "OTHER",
): number {
  const m = b[party];
  return m.early + m.mail + m.eday + m.other;
}

export function totalVotes(b: PartyMethodCounts): number {
  return (
    votesForParty(b, "REP") +
    votesForParty(b, "DEM") +
    votesForParty(b, "OTHER")
  );
}

export function methodTotals(b: PartyMethodCounts): {
  early: number;
  mail: number;
  eday: number;
  total: number;
} {
  const early =
    b.REP.early + b.DEM.early + b.OTHER.early;
  const mail = b.REP.mail + b.DEM.mail + b.OTHER.mail;
  const eday =
    b.REP.eday +
    b.DEM.eday +
    b.OTHER.eday +
    b.REP.other +
    b.DEM.other +
    b.OTHER.other;
  return { early, mail, eday, total: early + mail + eday };
}

export function advantageFromBucket(b: PartyMethodCounts): AdvantageMetrics {
  return metricsFromCounts(
    votesForParty(b, "REP"),
    votesForParty(b, "DEM"),
    votesForParty(b, "OTHER"),
  );
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(2)}%`;
}
