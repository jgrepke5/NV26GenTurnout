import { partySlicesFromRows, type PieSlice } from "./chart-data";
import type { CellValue, SheetTable } from "./types";

export interface TableBlock {
  title: string;
  headers: string[];
  rows: CellValue[][];
  variant: "current" | "historical";
  chartSlices?: PieSlice[];
  wrapHeaders?: boolean;
  footnote?: string;
}

type ColumnSpec = {
  match: (header: string) => boolean;
  label: string;
};

const CURRENT_COLUMNS: ColumnSpec[] = [
  {
    match: (h) => /party affiliation/i.test(h),
    label: "Party Affiliation",
  },
  {
    match: (h) => /'26\s*vr|2026 vr/i.test(h),
    label: "2026 VR",
  },
  { match: (h) => /votes to date/i.test(h), label: "Votes to Date" },
  {
    match: (h) => /'26\s*to\s*%|2026 turnout/i.test(h),
    label: "2026 Turnout %",
  },
  { match: (h) => /% early votes/i.test(h), label: "% Early Votes" },
  { match: (h) => /% mail votes/i.test(h), label: "% Mail Votes" },
  { match: (h) => /% e-day votes/i.test(h), label: "% E-Day Votes" },
];

function findColumnIndex(headers: string[], spec: ColumnSpec): number {
  const idx = headers.findIndex((h) => spec.match(h));
  if (idx < 0) {
    throw new Error(`Missing expected column for statewide view: ${spec.label}`);
  }
  return idx;
}

function projectBlock(
  sheet: SheetTable,
  specs: ColumnSpec[],
  title: string,
  variant: TableBlock["variant"],
): TableBlock {
  const indices = specs.map((spec) => findColumnIndex(sheet.headers, spec));
  const headers = specs.map((s) => s.label);
  const rows = sheet.rows
    .filter((row) => {
      const party = String(row[indices[0]] ?? "").trim();
      return party.length > 0 && !isTitleRow(party);
    })
    .map((row) => indices.map((i) => row[i] ?? null));

  const block: TableBlock = { title, headers, rows, variant };
  if (variant === "current") {
    block.chartSlices = partySlicesFromRows(headers, rows);
  }
  return block;
}

function isTitleRow(label: string): boolean {
  return (
    label.toUpperCase() === label &&
    label.length > 20 &&
    /STATEWIDE|COMPARISON/i.test(label)
  );
}

export function buildStatewideBlocks(sheet: SheetTable): TableBlock[] {
  return [
    projectBlock(sheet, CURRENT_COLUMNS, "2026 Turnout by Party", "current"),
  ];
}
