import { displayLabel, isSubRow } from "@/lib/format";
import { columnGroupClasses, isNumericHeader } from "@/lib/table-headers";
import type { CellValue } from "@/lib/types";
import { RowLabel } from "./RowLabel";
import { TableColGroup } from "./TableColGroup";
import { TableHeadRow } from "./TableHeadRow";
import { TableScroll } from "./TableScroll";

function isNumericColumn(headers: string[], colIndex: number): boolean {
  return isNumericHeader(headers[colIndex] ?? "", colIndex);
}

function partyRowClass(label: string): string {
  const party = displayLabel(label).toLowerCase();
  if (party === "total" || party === "statewide") return "row-total";
  if (party.startsWith("republican")) return "row-republican";
  if (party.startsWith("democrat")) return "row-democrat";
  if (party.includes("non-partisan") || party.includes("3rd party")) {
    return "row-nonpartisan";
  }
  return "";
}

function resolveRowClass(
  label: string,
  rowClasses: string[] | undefined,
  ri: number,
): string {
  if (rowClasses?.[ri]) return rowClasses[ri];
  const party = partyRowClass(label);
  const sub = isSubRow(label) ? "row-sub" : "";
  return [party, sub].filter(Boolean).join(" ");
}

export function DataTable({
  headers,
  rows,
  variant = "default",
  rowClasses,
  stickyHeader = false,
  wrapHeaders = false,
}: {
  headers: string[];
  rows: CellValue[][];
  variant?: "default" | "current" | "historical" | "rural";
  rowClasses?: string[];
  stickyHeader?: boolean;
  wrapHeaders?: boolean;
}) {
  const labelCol = 0;

  return (
    <div
      className={[
        `table-wrap table-wrap--${variant}`,
        wrapHeaders ? "table-wrap--wrap-headers" : undefined,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <TableScroll>
        <table className="data-table">
          <TableColGroup headers={headers} />
          <TableHeadRow
            headers={headers}
            sticky={stickyHeader}
            compactStateHeaders={wrapHeaders}
          />
          <tbody>
          {rows.map((row, ri) => {
            const label = String(row[labelCol] ?? "");
            return (
              <tr key={ri} className={resolveRowClass(label, rowClasses, ri)}>
                {row.map((cell, ci) => {
                  const text =
                    cell == null || cell === "" ? "—" : String(cell);
                  const isNum = isNumericColumn(headers, ci);
                  return (
                    <td
                      key={ci}
                      className={[
                        isNum ? "num" : undefined,
                        columnGroupClasses(headers[ci] ?? "", ci, headers),
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      data-label={headers[ci]}
                    >
                      {ci === labelCol ? (
                        <RowLabel text={text} />
                      ) : (
                        text
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
