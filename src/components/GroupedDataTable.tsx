"use client";

import type { GeoAdvantage } from "@/lib/advantage";
import type { DataGroup } from "@/lib/breakout-table";
import { columnGroupClasses, isNumericHeader } from "@/lib/table-headers";
import type { CellValue } from "@/lib/types";
import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { AdvantagePanel } from "./AdvantagePanel";
import { RowLabel } from "./RowLabel";
import { TableColGroup } from "./TableColGroup";
import { TableHeadRow } from "./TableHeadRow";
import { TurnoutPieChart } from "./TurnoutPieChart";

export type { DataGroup };

function TableScroll({ children }: { children: ReactNode }) {
  return <div className="table-scroll">{children}</div>;
}

function useSyncedTableScroll(
  rootRef: RefObject<HTMLDivElement | null>,
  groupCount: number,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const panes = Array.from(
      root.querySelectorAll<HTMLElement>(".table-scroll"),
    );
    if (panes.length < 2) return;

    let activePane: HTMLElement | null = null;
    let isSyncing = false;
    let rafId = 0;

    const clearActive = () => {
      activePane = null;
    };

    const syncFrom = (source: HTMLElement, scrollLeft: number) => {
      isSyncing = true;
      for (const pane of panes) {
        if (pane === source) continue;
        if (Math.abs(pane.scrollLeft - scrollLeft) > 0.5) {
          pane.scrollLeft = scrollLeft;
        }
      }
      isSyncing = false;
    };

    const onScroll = (e: Event) => {
      if (isSyncing) return;
      const source = e.currentTarget as HTMLElement;
      if (activePane && activePane !== source) return;

      const { scrollLeft } = source;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        syncFrom(source, scrollLeft);
      });
    };

    const disposers: (() => void)[] = [];

    for (const pane of panes) {
      const onPointerDown = () => {
        activePane = pane;
      };
      pane.addEventListener("pointerdown", onPointerDown, { passive: true });
      pane.addEventListener("pointerup", clearActive, { passive: true });
      pane.addEventListener("pointercancel", clearActive, { passive: true });
      pane.addEventListener("scroll", onScroll, { passive: true });
      disposers.push(() => {
        pane.removeEventListener("pointerdown", onPointerDown);
        pane.removeEventListener("pointerup", clearActive);
        pane.removeEventListener("pointercancel", clearActive);
        pane.removeEventListener("scroll", onScroll);
      });
    }

    return () => {
      cancelAnimationFrame(rafId);
      disposers.forEach((dispose) => dispose());
    };
  }, [rootRef, groupCount]);
}

export function GroupedDataTable({
  headers,
  groups,
  variant,
  groupAdvantages,
}: {
  headers: string[];
  groups: DataGroup[];
  variant?: "default" | "current" | "historical" | "rural";
  groupAdvantages?: Record<string, GeoAdvantage>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useSyncedTableScroll(rootRef, groups.length);

  return (
    <div
      ref={rootRef}
      className={`table-wrap table-wrap--${variant ?? "default"} grouped-table`}
    >
      <div className="grouped-table-sticky-head">
        <div className="data-group grouped-table-sticky-head-row">
          <div className="data-group-body">
            <div className="data-group-table">
              <TableScroll>
                <table className="data-table">
                  <TableColGroup headers={headers} />
                  <TableHeadRow headers={headers} />
                </table>
              </TableScroll>
            </div>
            <div
              className="data-group-chart data-group-chart--empty grouped-table-sticky-head-spacer"
              aria-hidden
            />
          </div>
        </div>
      </div>
      {groups.map((group) => (
        <div key={group.name} className="data-group">
          {groupAdvantages?.[group.name] ? (
            <div className="data-group-advantage">
              <AdvantagePanel
                advantage={groupAdvantages[group.name]}
                compact
              />
            </div>
          ) : null}
          <div className="data-group-body">
            <div className="data-group-table">
              <TableScroll>
                <table className="data-table">
                  <TableColGroup headers={headers} />
                  <tbody>
                    {group.rows.map((row, ri) => (
                      <DataTableBodyRow
                        key={ri}
                        headers={headers}
                        row={row}
                        rowClass={group.rowClasses[ri]}
                      />
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </div>
            <div className="data-group-chart">
              {group.chartSlices.length > 0 ? (
                <TurnoutPieChart slices={group.chartSlices} />
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DataTableBodyRow({
  headers,
  row,
  rowClass,
}: {
  headers: string[];
  row: CellValue[];
  rowClass: string;
}) {
  const labelCol = 0;

  return (
    <tr className={rowClass}>
      {row.map((cell, ci) => {
        const text = cell == null || cell === "" ? "—" : String(cell);
        const isNum = isNumericHeader(headers[ci] ?? "", ci);
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
            {ci === labelCol ? <RowLabel text={text} /> : text}
          </td>
        );
      })}
    </tr>
  );
}
