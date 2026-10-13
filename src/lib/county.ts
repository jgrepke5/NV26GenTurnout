import {
  buildBreakoutBlocks,
  isMarkerRow,
  type BreakoutTableBlock,
  type BreakoutTableConfig,
} from "./breakout-table";
import { countyTotalRegionSlices, partySlicesFromRows } from "./chart-data";
import type { SheetTable } from "./types";

export type CountyTableBlock = BreakoutTableBlock;

const COUNTY_CONFIG: BreakoutTableConfig = {
  sheetName: "County",
  labelColumnMatch: (h) => /turnout by county/i.test(h),
  labelHeader: "County",
  isSectionMarker: (label, row, layout) =>
    isMarkerRow(label, row, layout, (l) => l.toUpperCase() === "RURALS"),
  primaryBlockTitle: "County Turnout",
  secondaryBlockTitle: "Rural County Breakdown",
  buildChartSlices: (group, { allGroups, section, headers }) => {
    if (section === "primary" && group.name.toLowerCase() === "total") {
      return countyTotalRegionSlices(headers, allGroups, [
        "Clark",
        "Washoe",
        "Rurals",
      ]);
    }
    return partySlicesFromRows(headers, group.partyRows);
  },
};

export function buildCountyBlocks(sheet: SheetTable): CountyTableBlock[] {
  return buildBreakoutBlocks(sheet, COUNTY_CONFIG);
}
