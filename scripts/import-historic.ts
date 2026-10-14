/**
 * Precompute cumulative R/D advantage series from historic xlsx workbooks.
 * Usage: npx tsx scripts/import-historic.ts
 *
 * Sources:
 * - data/NV_AB_EV_ByDay_2024_2022.xlsx → statewide/senate/Clark Comm F (legacy tabs)
 * - data/2026_NV_ABEV_DTE_Comps_Cnty_CD_ADs_final.xlsx → statewide, CDs, counties, selected ADs
 */
import { execSync } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { metricsFromCounts, type AdvantageMetrics } from "../src/lib/advantage";
import type { HistoricSeriesFile } from "../src/lib/historic-rd";

const LEGACY_XLSX = path.join(
  process.cwd(),
  "data",
  "NV_AB_EV_ByDay_2024_2022.xlsx",
);
const COMPS_XLSX = path.join(
  process.cwd(),
  "data",
  "2026_NV_ABEV_DTE_Comps_Cnty_CD_ADs_final.xlsx",
);
const OUT = path.join(process.cwd(), "data", "historic-rd-advantage.json");

const LEGACY_SHEET_TO_GEO: Record<string, string> = {
  STW: "statewide",
  SD8: "senate-8",
  SD9: "senate-9",
  SD12: "senate-12",
  "Clark CommDist F": "commission-clark-f",
};

function loadSharedStrings(xlsxPath: string): string[] {
  const listing = execSync(`unzip -l "${xlsxPath}"`, { encoding: "utf8" });
  if (!listing.includes("xl/sharedStrings.xml")) return [];
  const xml = execSync(`unzip -p "${xlsxPath}" xl/sharedStrings.xml`, {
    encoding: "utf8",
    maxBuffer: 40 * 1024 * 1024,
  });
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => {
    const ts = [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]);
    return ts.join("");
  });
}

function workbookSheets(xlsxPath: string): { name: string; file: string }[] {
  const wb = execSync(`unzip -p "${xlsxPath}" xl/workbook.xml`, {
    encoding: "utf8",
  });
  const rels = execSync(`unzip -p "${xlsxPath}" xl/_rels/workbook.xml.rels`, {
    encoding: "utf8",
  });
  const ridToTarget = new Map<string, string>();
  for (const m of rels.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
    ridToTarget.set(m[1], m[2].replace(/^\//, ""));
  }
  for (const m of rels.matchAll(/Target="([^"]+)"[^>]*Id="(rId\d+)"/g)) {
    ridToTarget.set(m[2], m[1].replace(/^\//, ""));
  }

  const sheets: { name: string; file: string }[] = [];
  for (const m of wb.matchAll(
    /<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g,
  )) {
    const target = ridToTarget.get(m[2]);
    if (!target) continue;
    const file = target.startsWith("xl/") ? target : `xl/${target}`;
    sheets.push({ name: m[1], file });
  }
  return sheets;
}

function parseSheet(
  xlsxPath: string,
  sheetFile: string,
  strings: string[],
): Record<string, string>[] {
  // Targets in some workbooks are "/xl/worksheets/…"
  const file = sheetFile.replace(/^\//, "");
  const xml = execSync(`unzip -p "${xlsxPath}" "${file}"`, {
    encoding: "utf8",
    maxBuffer: 40 * 1024 * 1024,
  });
  const rows: Record<string, string>[] = [];
  for (const rowMatch of xml.matchAll(
    /<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g,
  )) {
    const cells: Record<string, string> = {};
    for (const c of rowMatch[2].matchAll(
      /<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g,
    )) {
      const col = c[1];
      const attrs = c[3];
      const body = c[4];
      if (/t="inlineStr"/.test(attrs)) {
        const ts = [...body.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]);
        cells[col] = ts.join("");
        continue;
      }
      const vMatch = body.match(/<v>([^<]*)<\/v>/);
      const v = vMatch?.[1] ?? "";
      cells[col] = /t="s"/.test(attrs) ? (strings[Number(v)] ?? "") : v;
    }
    rows.push(cells);
  }
  return rows;
}

function num(v: string | undefined): number {
  if (v == null || v === "" || v === "NULL") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type DayRow = {
  year: string;
  rowNo: number;
  mailR: number;
  mailD: number;
  mailO: number;
  evR: number;
  evD: number;
  evO: number;
};

/** Legacy STW (Year in A) vs district sheets (Geo in A, Year in B). */
function normalizedLegacyRows(rows: Record<string, string>[]): DayRow[] {
  const header = rows[0] ?? {};
  const hasGeo = header.A === "Geo" || header.B === "Year";
  return rows.slice(1).map((r) => {
    if (hasGeo) {
      return {
        year: r.B,
        rowNo: Number(r.C),
        mailR: num(r.F),
        mailD: num(r.G),
        mailO: num(r.H),
        evR: num(r.I),
        evD: num(r.J),
        evO: num(r.K),
      };
    }
    return {
      year: r.A,
      rowNo: Number(r.B),
      mailR: num(r.E),
      mailD: num(r.F),
      mailO: num(r.G),
      evR: num(r.H),
      evD: num(r.I),
      evO: num(r.J),
    };
  });
}

/** New comps workbook: GeoType, Geo, Year, RowNo, … Mail_*, EV_* */
function normalizedCompsRows(rows: Record<string, string>[]): (DayRow & {
  geo: string;
})[] {
  return rows.slice(1).map((r) => ({
    geo: (r.B ?? "").trim(),
    year: r.C,
    rowNo: Number(r.D),
    mailR: num(r.G),
    mailD: num(r.H),
    mailO: num(r.I),
    evR: num(r.J),
    evD: num(r.K),
    evO: num(r.L),
  }));
}

function geoKeyFromCompsLabel(geo: string): string | null {
  const g = geo.trim();
  if (!g) return null;
  if (/^nevada\s+statewide$/i.test(g) || /^statewide$/i.test(g)) {
    return "statewide";
  }
  const cd = g.match(/^CD\s*(\d+)$/i);
  if (cd) return `congress-${Number(cd[1])}`;
  const ad = g.match(/^AD\s*(\d+)$/i);
  if (ad) return `assembly-${Number(ad[1])}`;
  const sd = g.match(/^SD\s*(\d+)$/i);
  if (sd) return `senate-${Number(sd[1])}`;
  // County names are uppercase in the workbook (e.g. CARSON CITY, CLARK)
  if (/^[A-Z][A-Z\s]+$/.test(g)) {
    return `county-${g.toLowerCase().replace(/\s+/g, "-")}`;
  }
  return null;
}

/** Prefer sheet tab names — some AD tabs mislabel Geo (e.g. AD9 rows say "AD 5"). */
function geoKeyFromCompsSheetName(sheetName: string): string | null {
  const name = sheetName.trim();
  if (/^statewide$/i.test(name)) return "statewide";
  if (/^all\s*geos$/i.test(name)) return null;
  const cd = name.match(/^CD\s*(\d+)$/i);
  if (cd) return `congress-${Number(cd[1])}`;
  const ad = name.match(/^AD\s*(\d+)$/i);
  if (ad) return `assembly-${Number(ad[1])}`;
  const sd = name.match(/^SD\s*(\d+)$/i);
  if (sd) return `senate-${Number(sd[1])}`;
  // County tabs use title case, e.g. "Carson City", "White Pine"
  if (/^[A-Za-z][A-Za-z\s]+$/.test(name)) {
    return `county-${name.toLowerCase().replace(/\s+/g, "-")}`;
  }
  return null;
}

function buildCumulativeForYear(
  rows: DayRow[],
  year: string,
): Record<string, AdvantageMetrics> {
  const yearRows = rows
    .filter((r) => String(r.year) === year)
    .filter((r) => Number.isFinite(r.rowNo))
    .sort((a, b) => a.rowNo - b.rowNo);

  let cumR = 0;
  let cumD = 0;
  let cumO = 0;
  const out: Record<string, AdvantageMetrics> = {};

  for (const r of yearRows) {
    cumR += r.mailR + r.evR;
    cumD += r.mailD + r.evD;
    cumO += r.mailO + r.evO;
    out[String(r.rowNo)] = metricsFromCounts(cumR, cumD, cumO);
  }
  return out;
}

function setSeries(
  series: HistoricSeriesFile["series"],
  geoKey: string,
  rows: DayRow[],
  label: string,
) {
  series[geoKey] = {
    "2022": buildCumulativeForYear(rows, "2022"),
    "2024": buildCumulativeForYear(rows, "2024"),
  };
  console.log(
    `  · ${label} → ${geoKey}: 2022 days=${Object.keys(series[geoKey]["2022"]).length}, 2024 days=${Object.keys(series[geoKey]["2024"]).length}`,
  );
}

async function importLegacy(series: HistoricSeriesFile["series"]) {
  console.log(`Legacy workbook: ${path.basename(LEGACY_XLSX)}`);
  const strings = loadSharedStrings(LEGACY_XLSX);
  const sheets = workbookSheets(LEGACY_XLSX);
  for (const sheet of sheets) {
    const geoKey = LEGACY_SHEET_TO_GEO[sheet.name];
    if (!geoKey) {
      console.warn(`  Skipping unmapped sheet: ${sheet.name}`);
      continue;
    }
    const rows = normalizedLegacyRows(
      parseSheet(LEGACY_XLSX, sheet.file, strings),
    );
    setSeries(series, geoKey, rows, sheet.name);
  }
}

async function importComps(series: HistoricSeriesFile["series"]) {
  console.log(`Comps workbook: ${path.basename(COMPS_XLSX)}`);
  const strings = loadSharedStrings(COMPS_XLSX);
  const sheets = workbookSheets(COMPS_XLSX);
  const allGeos = sheets.find((s) => s.name === "All Geos");
  if (!allGeos) {
    throw new Error(`Missing "All Geos" sheet in ${COMPS_XLSX}`);
  }
  const raw = parseSheet(COMPS_XLSX, allGeos.file, strings);
  const rows = normalizedCompsRows(raw);

  const byGeo = new Map<string, DayRow[]>();
  for (const r of rows) {
    const geoKey = geoKeyFromCompsLabel(r.geo);
    if (!geoKey) continue;
    const list = byGeo.get(geoKey) ?? [];
    list.push(r);
    byGeo.set(geoKey, list);
  }

  for (const [geoKey, geoRows] of [...byGeo.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    setSeries(series, geoKey, geoRows, geoKey);
  }

  // Individual tabs fill gaps (and fix mislabeled Geo cells, e.g. AD9 → "AD 5").
  for (const sheet of sheets) {
    if (sheet.name === "All Geos") continue;
    const geoKey = geoKeyFromCompsSheetName(sheet.name);
    if (!geoKey) continue;
    if (series[geoKey] && Object.keys(series[geoKey]["2024"] ?? {}).length > 0) {
      continue;
    }
    const sheetRows = normalizedCompsRows(
      parseSheet(COMPS_XLSX, sheet.file, strings),
    );
    setSeries(series, geoKey, sheetRows, `${sheet.name} (sheet)`);
  }
}

/** Sum every county except Clark/Washoe into county-rurals. */
function buildRuralAggregate(series: HistoricSeriesFile["series"]) {
  const ruralKeys = Object.keys(series).filter(
    (k) =>
      k.startsWith("county-") &&
      k !== "county-clark" &&
      k !== "county-washoe" &&
      k !== "county-rurals",
  );
  if (ruralKeys.length === 0) {
    console.warn("No rural counties available to aggregate");
    return;
  }

  const out: Record<string, Record<string, AdvantageMetrics>> = {
    "2022": {},
    "2024": {},
  };

  for (const year of ["2022", "2024"] as const) {
    const daySet = new Set<string>();
    for (const key of ruralKeys) {
      for (const day of Object.keys(series[key]?.[year] ?? {})) {
        daySet.add(day);
      }
    }
    const days = [...daySet]
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    for (const day of days) {
      let r = 0;
      let d = 0;
      let o = 0;
      for (const key of ruralKeys) {
        const m = series[key]?.[year]?.[String(day)];
        if (!m) continue;
        r += m.republicanVotes;
        d += m.democratVotes;
        o += m.otherVotes;
      }
      out[year][String(day)] = metricsFromCounts(r, d, o);
    }
  }

  series["county-rurals"] = out;
  console.log(
    `  · rural aggregate → county-rurals: 2022 days=${Object.keys(out["2022"]).length}, 2024 days=${Object.keys(out["2024"]).length} (from ${ruralKeys.length} counties)`,
  );
}

async function main() {
  const series: HistoricSeriesFile["series"] = {};

  // Legacy first (senate + Clark F); comps overwrite statewide with the newer book.
  await importLegacy(series);
  await importComps(series);
  buildRuralAggregate(series);

  const out: HistoricSeriesFile = {
    generatedAt: new Date().toISOString(),
    series,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2), "utf-8");
  console.log(`Wrote ${OUT} (${Object.keys(series).length} geos)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
