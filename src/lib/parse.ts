import type { CellValue, SheetTable } from "./types";

interface GvizCell {
  v?: string | number | null;
  f?: string | null;
}

interface GvizCol {
  label?: string;
  type?: string;
  pattern?: string;
}

interface GvizResponse {
  table: {
    cols: GvizCol[];
    rows: { c: (GvizCell | null)[] }[];
    parsedNumHeaders?: number;
  };
}

export function parseGvizJson(raw: string): {
  headers: string[];
  rows: CellValue[][];
  formatted: string[][];
} {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Invalid gviz response");
  const data = JSON.parse(match[0]) as GvizResponse;
  const { cols, rows } = data.table;

  const headers = cols.map((c, i) => {
    const label = (c.label ?? "").trim();
    return label || `Column ${i + 1}`;
  });

  const formatted: string[][] = [];
  const values: CellValue[][] = [];

  for (const row of rows) {
    const fRow: string[] = [];
    const vRow: CellValue[] = [];
    let hasContent = false;

    for (let i = 0; i < cols.length; i++) {
      const cell = row.c[i];
      const display =
        cell?.f != null && String(cell.f).trim() !== ""
          ? String(cell.f)
          : cell?.v != null
            ? String(cell.v)
            : "";
      const value = cell?.v ?? (display || null);
      fRow.push(display);
      vRow.push(value as CellValue);
      if (display.trim()) hasContent = true;
    }

    if (hasContent) {
      formatted.push(fRow);
      values.push(vRow);
    }
  }

  return { headers, rows: values, formatted };
}

/** Drop leading empty columns; merge title rows into section label */
export function toSheetTable(
  title: string,
  headers: string[],
  formatted: string[][],
): SheetTable {
  const trimmed = trimEmptyLeadingColumns(headers, formatted);
  const { headers: h, rows } = collapseTitleRows(trimmed.headers, trimmed.rows);
  return {
    title,
    headers: h,
    rows,
    primaryMetricIndex: findTurnoutColumn(h),
  };
}

function trimEmptyLeadingColumns(
  headers: string[],
  rows: string[][],
): { headers: string[]; rows: string[][] } {
  let start = 0;
  while (start < headers.length) {
    const headerEmpty = !headers[start]?.trim();
    const colEmpty = rows.every((r) => !r[start]?.trim());
    if (!headerEmpty || !colEmpty) break;
    start++;
  }
  return {
    headers: headers.slice(start),
    rows: rows.map((r) => r.slice(start)),
  };
}

function collapseTitleRows(
  headers: string[],
  rows: string[][],
): { headers: string[]; rows: string[][] } {
  const dataRows: string[][] = [];
  let pendingTitle = "";

  for (const row of rows) {
    const label = row[0]?.trim() ?? "";
    const restFilled = row.slice(1).some((c) => c?.trim());
    const looksLikeTitle =
      label.length > 0 &&
      !restFilled &&
      label.toUpperCase() === label &&
      label.length > 12;

    if (looksLikeTitle) {
      pendingTitle = label;
      continue;
    }

    if (pendingTitle && label) {
      dataRows.push([...row]);
    } else if (label || restFilled) {
      dataRows.push(row);
    }
  }

  const cleanHeaders = headers.map((h, i) => {
    if (i === 0 && !h.trim()) return "Category";
    return h.trim() || `Column ${i + 1}`;
  });

  return { headers: cleanHeaders, rows: dataRows };
}

function findTurnoutColumn(headers: string[]): number | null {
  const idx = headers.findIndex((h) =>
    /turnout|to %|votes to date/i.test(h),
  );
  return idx >= 0 ? idx : null;
}

export function extractHeroMetrics(
  statewide: SheetTable,
): { votes: string; turnout: string; registered: string } | null {
  const totalRow = [...statewide.rows].reverse().find((r) => {
    const label = String(r[0] ?? "").toLowerCase();
    return label === "total";
  });
  if (!totalRow) return null;

  const headers = statewide.headers;
  const votesIdx = headers.findIndex((h) => /votes to date|total votes/i.test(h));
  const turnoutIdx = headers.findIndex((h) =>
    /'26 to %|26 to %|2026 turnout|turnout %/i.test(h),
  );
  const regIdx = headers.findIndex((h) => /'26 vr|26 vr|2026 vr/i.test(h));

  const fmt = (i: number) =>
    i >= 0 && totalRow[i] != null ? String(totalRow[i]) : "—";

  return {
    votes: fmt(votesIdx),
    turnout: fmt(turnoutIdx),
    registered: fmt(regIdx),
  };
}
