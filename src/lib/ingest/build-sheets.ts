import {
  attachHistoric,
  loadHistoricSeries,
  type HistoricSeriesFile,
} from "../historic-rd";
import type { CellValue, SheetTable, TurnoutSnapshot } from "../types";
import { SITE } from "../site-config";
import type { GeoAdvantage } from "../advantage";
import {
  advantageFromBucket,
  formatCount,
  formatPct,
  methodTotals,
  type AggregateResult,
  type PartyMethodCounts,
} from "./aggregate";

const BREAKOUT_HEADERS = [
  "TURNOUT BY COUNTY",
  "2026 VR",
  "Early Voted",
  "Mail Voted",
  "E-Day Voted",
  "Total Votes",
  "% Early Votes",
  "% Mail Votes",
  "% E-Day Votes",
  "Turnout %",
];

function partyRows(b: PartyMethodCounts, labelCol: string): CellValue[][] {
  const rows: CellValue[][] = [];
  const parties: { key: "DEM" | "REP" | "OTHER"; label: string }[] = [
    { key: "DEM", label: "  Democrat" },
    { key: "REP", label: "  Republican" },
    { key: "OTHER", label: "  Non-Partisan / 3rd Party" },
  ];

  for (const { key, label } of parties) {
    const early = b[key].early;
    const mail = b[key].mail;
    const eday = b[key].eday + b[key].other;
    const total = early + mail + eday;
    const methods = early + mail + eday;
    const vr = b[key].registered;
    rows.push([
      label,
      vr ? formatCount(vr) : "0",
      early ? formatCount(early) : "0",
      mail ? formatCount(mail) : "0",
      eday ? formatCount(eday) : "0",
      total ? formatCount(total) : "0",
      methods > 0 ? formatPct(early / methods) : "—",
      methods > 0 ? formatPct(mail / methods) : "—",
      methods > 0 ? formatPct(eday / methods) : "—",
      vr > 0 ? formatPct(total / vr) : "—",
    ]);
  }
  void labelCol;
  return rows;
}

function addPartyBuckets(into: PartyMethodCounts, from: PartyMethodCounts) {
  for (const p of ["REP", "DEM", "OTHER"] as const) {
    for (const m of ["early", "mail", "eday", "other", "registered"] as const) {
      into[p][m] += from[p][m];
    }
  }
  into.registered += from.registered;
}

function headerRow(name: string, b: PartyMethodCounts): CellValue[] {
  const m = methodTotals(b);
  const methods = m.total;
  return [
    name,
    formatCount(b.registered),
    formatCount(m.early),
    formatCount(m.mail),
    formatCount(m.eday),
    formatCount(m.total),
    methods > 0 ? formatPct(m.early / methods) : "—",
    methods > 0 ? formatPct(m.mail / methods) : "—",
    methods > 0 ? formatPct(m.eday / methods) : "—",
    b.registered > 0 ? formatPct(m.total / b.registered) : "—",
  ];
}

function appendGroup(
  rows: CellValue[][],
  name: string,
  b: PartyMethodCounts,
) {
  rows.push(headerRow(name, b));
  rows.push(...partyRows(b, name));
}

function titleCaseCounty(c: string): string {
  return c
    .toLowerCase()
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function buildCountySheet(agg: AggregateResult): SheetTable {
  const headers = [...BREAKOUT_HEADERS];
  headers[0] = "TURNOUT BY COUNTY";
  const rows: CellValue[][] = [];

  const clark = agg.counties.get("CLARK") ?? null;
  const washoe = agg.counties.get("WASHOE") ?? null;
  const ruralKeys = [...agg.counties.keys()]
    .filter((c) => c !== "CLARK" && c !== "WASHOE")
    .sort();

  const ruralBucket: PartyMethodCounts = {
    REP: { early: 0, mail: 0, eday: 0, other: 0, registered: 0 },
    DEM: { early: 0, mail: 0, eday: 0, other: 0, registered: 0 },
    OTHER: { early: 0, mail: 0, eday: 0, other: 0, registered: 0 },
    registered: 0,
  };

  for (const key of ruralKeys) {
    addPartyBuckets(ruralBucket, agg.counties.get(key)!);
  }

  const totalBucket: PartyMethodCounts = {
    REP: { early: 0, mail: 0, eday: 0, other: 0, registered: 0 },
    DEM: { early: 0, mail: 0, eday: 0, other: 0, registered: 0 },
    OTHER: { early: 0, mail: 0, eday: 0, other: 0, registered: 0 },
    registered: 0,
  };
  for (const b of [clark, washoe, ruralBucket]) {
    if (!b) continue;
    addPartyBuckets(totalBucket, b);
  }

  if (clark) appendGroup(rows, "Clark", clark);
  if (washoe) appendGroup(rows, "Washoe", washoe);
  appendGroup(rows, "Rurals", ruralBucket);
  appendGroup(rows, "Total", totalBucket);

  rows.push(["RURALS"]);
  for (const key of ruralKeys) {
    appendGroup(rows, titleCaseCounty(key), agg.counties.get(key)!);
  }

  return {
    title: "County",
    headers,
    rows,
    primaryMetricIndex: 9,
  };
}

export function buildCongressionalSheet(agg: AggregateResult): SheetTable {
  const headers = [...BREAKOUT_HEADERS];
  headers[0] = "CONGRESSIONAL DISTRICTS";
  const rows: CellValue[][] = [];
  const cds = [...agg.congress.keys()].sort(
    (a, b) => Number(a) - Number(b) || a.localeCompare(b),
  );
  for (const cd of cds) {
    appendGroup(rows, `CD${Number(cd)}`, agg.congress.get(cd)!);
  }
  return {
    title: "Congressional",
    headers,
    rows,
    primaryMetricIndex: 9,
  };
}

export function buildLegislativeSheet(agg: AggregateResult): SheetTable {
  const headers = [...BREAKOUT_HEADERS];
  headers[0] = "COMPETITIVE LEGISLATIVE DISTRICTS";
  const rows: CellValue[][] = [];

  const senates = [...agg.senate.keys()].sort(
    (a, b) => Number(a) - Number(b) || a.localeCompare(b),
  );
  for (const sd of senates) {
    appendGroup(rows, `SD${Number(sd)}`, agg.senate.get(sd)!);
  }

  rows.push(["NON-COMPETITIVE LEGISLATIVE DISTRICTS"]);

  const assemblies = [...agg.assembly.keys()].sort(
    (a, b) => Number(a) - Number(b) || a.localeCompare(b),
  );
  for (const ad of assemblies) {
    appendGroup(rows, `AD${Number(ad)}`, agg.assembly.get(ad)!);
  }

  return {
    title: "Legislative",
    headers,
    rows,
    primaryMetricIndex: 9,
  };
}

export function buildCommissionSheet(agg: AggregateResult): SheetTable {
  const headers = [...BREAKOUT_HEADERS];
  headers[0] = "WASHOE";
  const rows: CellValue[][] = [];

  // Washoe has districts 1–5 only; File 6 sometimes tags stray E/F rows.
  const washoe = [...agg.commission.entries()]
    .filter(([k]) => {
      if (!k.startsWith("WASHOE|")) return false;
      const dist = (k.split("|")[1] ?? "").toUpperCase();
      return !["E", "F"].includes(dist);
    })
    .sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, b] of washoe) {
    const dist = key.split("|")[1] ?? key;
    appendGroup(rows, `District ${dist}`, b);
  }

  rows.push(["CLARK"]);

  const clark = [...agg.commission.entries()]
    .filter(([k]) => k.startsWith("CLARK|"))
    .sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, b] of clark) {
    const dist = key.split("|")[1] ?? key;
    appendGroup(rows, `District ${dist}`, b);
  }

  return {
    title: "Commission",
    headers,
    rows,
    primaryMetricIndex: 9,
  };
}

export function buildStatewideSheet(agg: AggregateResult): SheetTable {
  const b = agg.statewide;
  const headers = [
    "Party Affiliation",
    "'26 VR",
    "Votes to Date",
    "'26 TO %",
    "% Early Votes",
    "% Mail Votes",
    "% E-Day Votes",
  ];

  const mkRow = (
    label: string,
    party: "REP" | "DEM" | "OTHER" | "ALL",
  ): CellValue[] => {
    if (party === "ALL") {
      const m = methodTotals(b);
      const methods = m.total;
      return [
        label,
        formatCount(b.registered),
        formatCount(m.total),
        b.registered > 0 ? formatPct(m.total / b.registered) : "—",
        methods > 0 ? formatPct(m.early / methods) : "—",
        methods > 0 ? formatPct(m.mail / methods) : "—",
        methods > 0 ? formatPct(m.eday / methods) : "—",
      ];
    }
    const early = b[party].early;
    const mail = b[party].mail;
    const eday = b[party].eday + b[party].other;
    const total = early + mail + eday;
    const methods = total;
    const vr = b[party].registered;
    return [
      label,
      formatCount(vr),
      formatCount(total),
      vr > 0 ? formatPct(total / vr) : "—",
      methods > 0 ? formatPct(early / methods) : "—",
      methods > 0 ? formatPct(mail / methods) : "—",
      methods > 0 ? formatPct(eday / methods) : "—",
    ];
  };

  return {
    title: "Statewide",
    headers,
    rows: [
      mkRow("Republican", "REP"),
      mkRow("Democrat", "DEM"),
      mkRow("Non-Partisan / 3rd Party", "OTHER"),
      mkRow("Total", "ALL"),
    ],
    primaryMetricIndex: 3,
  };
}

function geoAdvantages(
  agg: AggregateResult,
  historic: HistoricSeriesFile,
  evDayIndex: number,
): GeoAdvantage[] {
  const list: Omit<GeoAdvantage, "historic2022" | "historic2024">[] = [
    {
      geoKey: "statewide",
      label: "Statewide",
      metrics: advantageFromBucket(agg.statewide),
    },
  ];

  for (const [county, b] of [...agg.counties.entries()].sort()) {
    list.push({
      geoKey: `county-${county.toLowerCase().replace(/\s+/g, "-")}`,
      label: titleCaseCounty(county),
      metrics: advantageFromBucket(b),
    });
  }

  // Aggregated rurals (every county except Clark + Washoe)
  {
    const ruralBucket: PartyMethodCounts = {
      REP: { early: 0, mail: 0, eday: 0, other: 0, registered: 0 },
      DEM: { early: 0, mail: 0, eday: 0, other: 0, registered: 0 },
      OTHER: { early: 0, mail: 0, eday: 0, other: 0, registered: 0 },
      registered: 0,
    };
    for (const [county, b] of agg.counties) {
      if (county === "CLARK" || county === "WASHOE") continue;
      addPartyBuckets(ruralBucket, b);
    }
    list.push({
      geoKey: "county-rurals",
      label: "Rurals",
      metrics: advantageFromBucket(ruralBucket),
    });
  }

  for (const [cd, b] of [...agg.congress.entries()].sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  )) {
    const n = Number(cd);
    list.push({
      geoKey: `congress-${n}`,
      label: `CD${n}`,
      metrics: advantageFromBucket(b),
    });
  }

  for (const [sd, b] of [...agg.senate.entries()].sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  )) {
    const n = Number(sd);
    list.push({
      geoKey: `senate-${n}`,
      label: `SD${n}`,
      metrics: advantageFromBucket(b),
    });
  }

  for (const [ad, b] of [...agg.assembly.entries()].sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  )) {
    const n = Number(ad);
    list.push({
      geoKey: `assembly-${n}`,
      label: `AD${n}`,
      metrics: advantageFromBucket(b),
    });
  }

  for (const [key, b] of [...agg.commission.entries()].sort()) {
    const [county, dist] = key.split("|");
    const distKey = (dist ?? "").toUpperCase();
    if (county === "WASHOE" && (distKey === "E" || distKey === "F")) continue;
    const geoKey =
      county === "CLARK" && distKey === "F"
        ? "commission-clark-f"
        : `commission-${county?.toLowerCase()}-${dist?.toLowerCase()}`;
    list.push({
      geoKey,
      label: `${titleCaseCounty(county ?? "")} Commission ${dist}`,
      metrics: advantageFromBucket(b),
    });
  }

  return list.map((g) => attachHistoric(g, historic, evDayIndex));
}

export async function snapshotFromAggregate(
  agg: AggregateResult,
  opts: {
    sourceUrl: string;
    sourceHash: string;
    asOfDate: string;
    evDayIndex: number;
    fetchedAt?: string;
  },
): Promise<TurnoutSnapshot> {
  const historic = await loadHistoricSeries();
  return {
    spreadsheetId: "vivid-file6",
    fetchedAt: opts.fetchedAt ?? new Date().toISOString(),
    sourceUrl: opts.sourceUrl || SITE.sourceUrl,
    sourceHash: opts.sourceHash,
    asOfDate: opts.asOfDate,
    evDayIndex: opts.evDayIndex,
    sheets: [
      buildStatewideSheet(agg),
      buildCountySheet(agg),
      buildCongressionalSheet(agg),
      buildLegislativeSheet(agg),
      buildCommissionSheet(agg),
    ],
    advantages: geoAdvantages(agg, historic, opts.evDayIndex),
  };
}
