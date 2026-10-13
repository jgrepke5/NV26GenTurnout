/**
 * Precompute cumulative R/D advantage series from NV_AB_EV_ByDay xlsx.
 * Usage: npx tsx scripts/import-historic.ts
 */
import { execSync } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { metricsFromCounts, type AdvantageMetrics } from "../src/lib/advantage";
import type { HistoricSeriesFile } from "../src/lib/historic-rd";

const XLSX = path.join(process.cwd(), "data", "NV_AB_EV_ByDay_2024_2022.xlsx");
const OUT = path.join(process.cwd(), "data", "historic-rd-advantage.json");

const SHEET_TO_GEO: Record<string, string> = {
  STW: "statewide",
  SD8: "senate-8",
  SD9: "senate-9",
  SD12: "senate-12",
  "Clark CommDist F": "commission-clark-f",
};

function loadSharedStrings(xlsxPath: string): string[] {
  const xml = execSync(`unzip -p "${xlsxPath}" xl/sharedStrings.xml`, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
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
  for (const m of rels.matchAll(
    /Id="(rId\d+)"[^>]*Target="([^"]+)"/g,
  )) {
    ridToTarget.set(m[1], m[2].replace(/^\//, ""));
  }
  // also Target before Id
  for (const m of rels.matchAll(
    /Target="([^"]+)"[^>]*Id="(rId\d+)"/g,
  )) {
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
  const xml = execSync(`unzip -p "${xlsxPath}" "${sheetFile}"`, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const rows: Record<string, string>[] = [];
  for (const rowMatch of xml.matchAll(
    /<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g,
  )) {
    const cells: Record<string, string> = {};
    for (const c of rowMatch[2].matchAll(
      /<c r="([A-Z]+)(\d+)"([^>]*)>(?:<v>([^<]*)<\/v>)?/g,
    )) {
      const col = c[1];
      const attrs = c[3];
      const v = c[4] ?? "";
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

/** Normalize STW (Year in A) vs district sheets (Geo in A, Year in B). */
function normalizedRows(rows: Record<string, string>[]) {
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

function buildCumulativeForYear(
  rows: Record<string, string>[],
  year: string,
): Record<string, AdvantageMetrics> {
  const yearRows = normalizedRows(rows)
    .filter((r) => r.year === year)
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

async function main() {
  const strings = loadSharedStrings(XLSX);
  const sheets = workbookSheets(XLSX);
  const series: HistoricSeriesFile["series"] = {};

  for (const sheet of sheets) {
    const geoKey = SHEET_TO_GEO[sheet.name];
    if (!geoKey) {
      console.warn(`Skipping unmapped sheet: ${sheet.name}`);
      continue;
    }
    const rows = parseSheet(XLSX, sheet.file, strings);
    series[geoKey] = {
      "2022": buildCumulativeForYear(rows, "2022"),
      "2024": buildCumulativeForYear(rows, "2024"),
    };
    console.log(
      `  · ${sheet.name} → ${geoKey}: 2022 days=${Object.keys(series[geoKey]["2022"]).length}, 2024 days=${Object.keys(series[geoKey]["2024"]).length}`,
    );
  }

  const out: HistoricSeriesFile = {
    generatedAt: new Date().toISOString(),
    series,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2), "utf-8");
  console.log(`Wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
