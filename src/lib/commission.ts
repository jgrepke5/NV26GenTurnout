import {
  buildBreakoutBlocks,
  isMarkerRow,
  type BreakoutTableBlock,
  type BreakoutTableConfig,
} from "./breakout-table";
import type { SheetTable } from "./types";

export type CommissionTableBlock = BreakoutTableBlock;

const COMMISSION_CONFIG: BreakoutTableConfig = {
  sheetName: "Commission",
  labelColumnMatch: (h) => /washoe/i.test(h),
  labelHeader: "District",
  isSectionMarker: (label, row, layout) =>
    isMarkerRow(label, row, layout, (l) => l.toUpperCase() === "CLARK"),
  primaryBlockTitle: "Washoe County Commission",
  secondaryBlockTitle: "Clark County Commission",
  // Washoe commission is 1–5 only; ignore stray E/F tags from File 6.
  filterGroup: (group, section) => {
    if (section !== "primary") return true;
    const name = group.name.trim().toUpperCase();
    return name !== "DISTRICT E" && name !== "DISTRICT F";
  },
};

export function buildCommissionBlocks(
  sheet: SheetTable,
): CommissionTableBlock[] {
  return buildBreakoutBlocks(sheet, COMMISSION_CONFIG);
}
