import {
  countyTotalRegionSlices,
  partyRegistrationSlicesFromRows,
  partySlicesFromRows,
  type PieSlice,
} from "./chart-data";
import { displayLabel } from "./format";
import type { CellValue, SheetTable } from "./types";
export interface DataGroup {
  name: string;
  rows: CellValue[][];
  rowClasses: string[];
  chartSlices: PieSlice[];
  registrationSlices: PieSlice[];
}

export interface BreakoutTableBlock {
  title?: string;
  headers: string[];
  groups: DataGroup[];
  variant: "current" | "rural";
}

type ColumnSpec = {
  match: (header: string) => boolean;
  label: string;
};

const DATA_COLUMNS: ColumnSpec[] = [
  {
    match: (h) => /'26\s*vr|2026\s*vr/i.test(h),
    label: "2026 VR",
  },
  { match: (h) => /early voted/i.test(h), label: "Early Voted" },
  { match: (h) => /mail voted/i.test(h), label: "Mail Voted" },
  { match: (h) => /e-day voted/i.test(h), label: "E-Day Voted" },
  { match: (h) => /total votes/i.test(h), label: "Total Votes" },
  { match: (h) => /% early votes/i.test(h), label: "% Early Votes" },
  { match: (h) => /% mail votes/i.test(h), label: "% Mail Votes" },
  { match: (h) => /% e-day votes/i.test(h), label: "% E-Day Votes" },
  { match: (h) => /turnout %/i.test(h), label: "Turnout %" },
];

export type BreakoutTableConfig = {
  sheetName: string;
  labelColumnMatch: (header: string) => boolean;
  labelHeader: string;
  isSectionMarker: (label: string, row: CellValue[], layout: BreakoutLayout) => boolean;
  secondaryBlockTitle: string;
  primaryBlockTitle?: string;
  filterGroup?: (group: BreakoutGroup, section: BreakoutSection) => boolean;
  transformGroup?: (group: BreakoutGroup) => BreakoutGroup;
  buildChartSlices?: (
    group: BreakoutGroup,
    context: {
      allGroups: BreakoutGroup[];
      section: BreakoutSection;
      headers: string[];
    },
  ) => PieSlice[];
};

interface BreakoutLayout {
  labelIndex: number;
  dataIndices: number[];
  headers: string[];
}

export interface BreakoutGroup {
  name: string;
  headerRow: CellValue[];
  partyRows: CellValue[][];
}

export type BreakoutSection = "primary" | "secondary";

function resolveLayout(
  sheet: SheetTable,
  config: BreakoutTableConfig,
): BreakoutLayout {
  const labelIndex = sheet.headers.findIndex(config.labelColumnMatch);
  if (labelIndex < 0) {
    throw new Error(`Missing label column on ${config.sheetName} sheet`);
  }

  const dataIndices = DATA_COLUMNS.map((spec) => {
    const idx = sheet.headers.findIndex((h) => spec.match(h));
    if (idx < 0) {
      throw new Error(
        `Missing expected column on ${config.sheetName} sheet: ${spec.label}`,
      );
    }
    return idx;
  });

  return {
    labelIndex,
    dataIndices,
    headers: [config.labelHeader, ...DATA_COLUMNS.map((s) => s.label)],
  };
}

function projectRow(row: CellValue[], layout: BreakoutLayout): CellValue[] {
  return [
    row[layout.labelIndex] ?? null,
    ...layout.dataIndices.map((i) => row[i] ?? null),
  ];
}

function rowLabel(row: CellValue[], layout: BreakoutLayout): string {
  return String(row[layout.labelIndex] ?? "");
}

function isPartyRow(label: string): boolean {
  if (/^\s{2,}/.test(label)) return true;
  const t = displayLabel(label).toLowerCase();
  return (
    t.startsWith("democrat") ||
    t.startsWith("republican") ||
    t.includes("non-partisan") ||
    t.includes("3rd party")
  );
}

function partyRowClass(label: string): string {
  const party = displayLabel(label).toLowerCase();
  if (party.startsWith("republican")) return "row-republican";
  if (party.startsWith("democrat")) return "row-democrat";
  if (party.includes("non-partisan") || party.includes("3rd party")) {
    return "row-nonpartisan";
  }
  return "";
}

function readGroup(
  rows: CellValue[][],
  start: number,
  layout: BreakoutLayout,
): { group: BreakoutGroup; next: number } | null {
  if (start >= rows.length) return null;

  const rawLabel = rowLabel(rows[start], layout);
  const name = displayLabel(rawLabel);
  if (!name || isPartyRow(rawLabel)) return null;

  const headerRow = projectRow(rows[start], layout);
  let i = start + 1;
  const partyRows: CellValue[][] = [];

  while (i < rows.length) {
    const nextLabel = rowLabel(rows[i], layout);
    if (!isPartyRow(nextLabel)) break;
    partyRows.push(projectRow(rows[i], layout));
    i++;
  }

  return { group: { name, headerRow, partyRows }, next: i };
}

function parseSection(
  rows: CellValue[][],
  start: number,
  end: number,
  layout: BreakoutLayout,
  config: BreakoutTableConfig,
): BreakoutGroup[] {
  const groups: BreakoutGroup[] = [];
  let i = start;

  while (i < end) {
    const label = displayLabel(rowLabel(rows[i], layout));
    if (config.isSectionMarker(label, rows[i], layout)) {
      i++;
      continue;
    }

    const parsed = readGroup(rows, i, layout);
    if (!parsed) {
      i++;
      continue;
    }

    groups.push(parsed.group);
    i = parsed.next;
  }

  return groups;
}

function findSectionMarkerIndex(
  rows: CellValue[][],
  layout: BreakoutLayout,
  config: BreakoutTableConfig,
): number {
  return rows.findIndex((row) =>
    config.isSectionMarker(displayLabel(rowLabel(row, layout)), row, layout),
  );
}

function splitSheetRows(
  rows: CellValue[][],
  layout: BreakoutLayout,
  config: BreakoutTableConfig,
): { primary: BreakoutGroup[]; secondary: BreakoutGroup[] } {
  const markerIdx = findSectionMarkerIndex(rows, layout, config);
  const primaryEnd = markerIdx >= 0 ? markerIdx : rows.length;
  const primary = parseSection(rows, 0, primaryEnd, layout, config);
  const secondaryStart = markerIdx >= 0 ? markerIdx + 1 : rows.length;
  const secondary = parseSection(
    rows,
    secondaryStart,
    rows.length,
    layout,
    config,
  );
  return { primary, secondary };
}

function flattenGroup(group: BreakoutGroup): {
  rows: CellValue[][];
  rowClasses: string[];
} {
  const rows: CellValue[][] = [];
  const rowClasses: string[] = [];
  const isTotal = group.name.toLowerCase() === "total";

  rows.push(group.headerRow);
  rowClasses.push(
    isTotal ? "row-county-header row-total" : "row-county-header",
  );

  for (const partyRow of group.partyRows) {
    rows.push(partyRow);
    const partyClass = partyRowClass(String(partyRow[0] ?? ""));
    rowClasses.push(["row-sub", partyClass].filter(Boolean).join(" "));
  }

  return { rows, rowClasses };
}

function applyGroupTransforms(
  groups: BreakoutGroup[],
  section: BreakoutSection,
  config: BreakoutTableConfig,
): BreakoutGroup[] {
  return groups
    .filter((g) => config.filterGroup?.(g, section) ?? true)
    .map((g) => config.transformGroup?.(g) ?? g);
}

function defaultChartSlices(
  group: BreakoutGroup,
  headers: string[],
): PieSlice[] {
  return partySlicesFromRows(headers, group.partyRows);
}

function defaultRegistrationSlices(
  group: BreakoutGroup,
  headers: string[],
): PieSlice[] {
  return partyRegistrationSlicesFromRows(headers, group.partyRows);
}

function buildBlock(
  groups: BreakoutGroup[],
  headers: string[],
  variant: BreakoutTableBlock["variant"],
  config: BreakoutTableConfig,
  section: BreakoutSection,
  title?: string,
): BreakoutTableBlock {
  const displayGroups: DataGroup[] = groups.map((group) => {
    const flat = flattenGroup(group);
    const chartSlices =
      config.buildChartSlices?.(group, { allGroups: groups, section, headers }) ??
      defaultChartSlices(group, headers);
    return {
      name: group.name,
      rows: flat.rows,
      rowClasses: flat.rowClasses,
      chartSlices,
      registrationSlices: defaultRegistrationSlices(group, headers),
    };
  });

  return { title, headers, groups: displayGroups, variant };
}

function isEmptyDataRow(row: CellValue[], layout: BreakoutLayout): boolean {
  return projectRow(row, layout)
    .slice(1)
    .every((c) => c == null || c === "");
}

export function buildBreakoutBlocks(
  sheet: SheetTable,
  config: BreakoutTableConfig,
): BreakoutTableBlock[] {
  const layout = resolveLayout(sheet, config);
  const { primary, secondary } = splitSheetRows(sheet.rows, layout, config);

  const primaryGroups = applyGroupTransforms(primary, "primary", config);
  const secondaryGroups = applyGroupTransforms(secondary, "secondary", config);

  return [
    buildBlock(
      primaryGroups,
      layout.headers,
      "current",
      config,
      "primary",
      config.primaryBlockTitle,
    ),
    buildBlock(
      secondaryGroups,
      layout.headers,
      "rural",
      config,
      "secondary",
      config.secondaryBlockTitle,
    ),
  ].filter((block) => block.groups.length > 0);
}


export function isMarkerRow(
  label: string,
  row: CellValue[],
  layout: BreakoutLayout,
  markerTest: (label: string) => boolean,
): boolean {
  return markerTest(label) && isEmptyDataRow(row, layout);
}
