import type { GeoAdvantage } from "./advantage";

export type CellValue = string | number | null;

export interface SheetMeta {
  name: string;
  gid: string;
}

export interface SheetTable {
  title: string;
  headers: string[];
  rows: CellValue[][];
  primaryMetricIndex: number | null;
}

export interface TurnoutSnapshot {
  spreadsheetId: string;
  fetchedAt: string;
  sheets: SheetTable[];
  sourceUrl: string;
  /** Source file hash or URL for idempotency */
  sourceHash?: string;
  /** Pacific date this snapshot represents */
  asOfDate?: string;
  /** EV day index aligned to historic series */
  evDayIndex?: number;
  advantages?: GeoAdvantage[];
}
