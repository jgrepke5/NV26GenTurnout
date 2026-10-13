import type { DataGroup } from "@/lib/breakout-table";
import {
  buildBreakoutBlocks,
  type BreakoutTableBlock,
  type BreakoutTableConfig,
} from "./breakout-table";
import {
  congressionalTotalDistrictSlices,
  parseVoteCount,
  partySlicesFromRows,
} from "./chart-data";
import { displayLabel } from "./format";
import type { CellValue, SheetTable } from "./types";

export type CongressionalTableBlock = BreakoutTableBlock;

const CONGRESSIONAL_DISTRICTS = ["CD1", "CD2", "CD3", "CD4"];

const CONGRESSIONAL_CONFIG: BreakoutTableConfig = {
  sheetName: "Congressional",
  labelColumnMatch: (h) => /congressional districts/i.test(h),
  labelHeader: "District",
  isSectionMarker: () => false,
  primaryBlockTitle: "Congressional Districts",
  secondaryBlockTitle: "",
  buildChartSlices: (group, { allGroups, section, headers }) => {
    if (section === "primary" && group.name.toLowerCase() === "total") {
      return congressionalTotalDistrictSlices(
        headers,
        allGroups,
        CONGRESSIONAL_DISTRICTS,
      );
    }
    return partySlicesFromRows(headers, group.partyRows);
  },
};

function isDistrictGroup(name: string): boolean {
  return /^CD\d+/i.test(displayLabel(name));
}

function sumNumericColumns(rows: CellValue[][], colCount: number): CellValue[] {
  const sums: number[] = Array(colCount).fill(0);
  for (const row of rows) {
    for (let i = 1; i < colCount; i++) {
      sums[i] += parseVoteCount(row[i]);
    }
  }
  return sums.map((n, i) => (i === 0 ? null : n > 0 ? n : null));
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

function computeGrandTotalRow(
  districtRows: CellValue[][],
  headers: string[],
): CellValue[] {
  const colCount = headers.length;
  const sums = sumNumericColumns(districtRows, colCount);
  const row: CellValue[] = ["Total", ...sums.slice(1).map((v) => v ?? null)];

  const vrIdx = headers.indexOf("2026 VR");
  const earlyIdx = headers.indexOf("Early Voted");
  const mailIdx = headers.indexOf("Mail Voted");
  const edayIdx = headers.indexOf("E-Day Voted");
  const votesIdx = headers.indexOf("Total Votes");
  const earlyPctIdx = headers.indexOf("% Early Votes");
  const mailPctIdx = headers.indexOf("% Mail Votes");
  const edayPctIdx = headers.indexOf("% E-Day Votes");
  const turnoutIdx = headers.indexOf("Turnout %");

  const vr = vrIdx >= 0 ? parseVoteCount(row[vrIdx]) : 0;
  const early = earlyIdx >= 0 ? parseVoteCount(row[earlyIdx]) : 0;
  const mail = mailIdx >= 0 ? parseVoteCount(row[mailIdx]) : 0;
  const eday = edayIdx >= 0 ? parseVoteCount(row[edayIdx]) : 0;
  const votes = votesIdx >= 0 ? parseVoteCount(row[votesIdx]) : 0;
  const voteMethods = early + mail + eday;

  if (vrIdx >= 0 && vr > 0) row[vrIdx] = formatCount(vr);
  if (earlyIdx >= 0 && early > 0) row[earlyIdx] = formatCount(early);
  if (mailIdx >= 0 && mail > 0) row[mailIdx] = formatCount(mail);
  if (edayIdx >= 0 && eday > 0) row[edayIdx] = formatCount(eday);
  if (votesIdx >= 0 && votes > 0) row[votesIdx] = formatCount(votes);

  if (earlyPctIdx >= 0 && voteMethods > 0) {
    row[earlyPctIdx] = formatPct(early / voteMethods);
  }
  if (mailPctIdx >= 0 && voteMethods > 0) {
    row[mailPctIdx] = formatPct(mail / voteMethods);
  }
  if (edayPctIdx >= 0 && voteMethods > 0) {
    row[edayPctIdx] = formatPct(eday / voteMethods);
  }
  if (turnoutIdx >= 0 && vr > 0) {
    row[turnoutIdx] = formatPct(votes / vr);
  }

  return row;
}

function appendTotalGroup(block: BreakoutTableBlock): BreakoutTableBlock {
  const districts = block.groups.filter((g) => isDistrictGroup(g.name));
  const hasTotal = block.groups.some((g) => g.name.toLowerCase() === "total");
  if (hasTotal || districts.length === 0) return block;

  const rows: CellValue[][] = [];
  const rowClasses: string[] = [];
  const districtHeaderRows: CellValue[][] = [];

  for (const district of districts) {
    const headerRow = [...district.rows[0]];
    rows.push(headerRow);
    rowClasses.push("row-county-header row-total-district");
    districtHeaderRows.push(headerRow);
  }

  rows.push(computeGrandTotalRow(districtHeaderRows, block.headers));
  rowClasses.push("row-county-header row-total");

  const chartSlices = congressionalTotalDistrictSlices(
    block.headers,
    districts.map((d) => ({ name: d.name, headerRow: d.rows[0] })),
    CONGRESSIONAL_DISTRICTS,
  );

  const totalGroup: DataGroup = {
    name: "Total",
    rows,
    rowClasses,
    chartSlices,
  };

  return { ...block, groups: [...block.groups, totalGroup] };
}

export function buildCongressionalBlocks(
  sheet: SheetTable,
): CongressionalTableBlock[] {
  return buildBreakoutBlocks(sheet, CONGRESSIONAL_CONFIG).map(appendTotalGroup);
}
