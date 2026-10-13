import {
  buildBreakoutBlocks,
  isMarkerRow,
  type BreakoutTableBlock,
  type BreakoutTableConfig,
} from "./breakout-table";
import type { SheetTable } from "./types";

export type LegislativeTableBlock = BreakoutTableBlock;

const LEGISLATIVE_CONFIG: BreakoutTableConfig = {
  sheetName: "Legislative",
  labelColumnMatch: (h) => /competitive legislative districts/i.test(h),
  labelHeader: "District",
  isSectionMarker: (label, row, layout) =>
    isMarkerRow(label, row, layout, (l) =>
      /non-competitive legislative districts/i.test(l),
    ),
  primaryBlockTitle: "State Senate Districts",
  secondaryBlockTitle: "Assembly Districts",
};

export function buildLegislativeBlocks(
  sheet: SheetTable,
): LegislativeTableBlock[] {
  return buildBreakoutBlocks(sheet, LEGISLATIVE_CONFIG);
}
