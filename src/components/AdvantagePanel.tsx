"use client";

import {
  formatAdvantageCount,
  formatAdvantagePct,
  type GeoAdvantage,
} from "@/lib/advantage";
import { SITE } from "@/lib/site-config";
import { useSnapshotMeta } from "./SnapshotMeta";

export function AdvantagePanel({
  advantage,
  compact = false,
}: {
  advantage: GeoAdvantage | null | undefined;
  compact?: boolean;
}) {
  const { asOfDate } = useSnapshotMeta();
  if (!advantage) return null;
  const { metrics, historic2022, historic2024 } = advantage;
  const showHistoric = historic2022 != null || historic2024 != null;
  const note = SITE.temporaryHistoricNote;
  const showHistoricNote =
    showHistoric &&
    note != null &&
    asOfDate != null &&
    asOfDate === note.throughAsOfDate;

  return (
    <div
      className={
        compact ? "advantage-panel advantage-panel--compact" : "advantage-panel"
      }
    >
      <div className="advantage-primary">
        <p className="advantage-kicker">2026 R/D advantage</p>
        <p className="advantage-value">
          {formatAdvantageCount(metrics.rdAdvantage)}
        </p>
        <p className="advantage-pct">
          {formatAdvantagePct(metrics.rdAdvantagePct)}
        </p>
        <p className="advantage-totals">
          R {metrics.republicanVotes.toLocaleString("en-US")} · D{" "}
          {metrics.democratVotes.toLocaleString("en-US")} · All{" "}
          {metrics.allVotes.toLocaleString("en-US")}
        </p>
      </div>
      {showHistoric ? (
        <div className="advantage-historic">
          {historic2024 ? (
            <div className="advantage-historic-item">
              <p className="advantage-historic-label">2024</p>
              <p className="advantage-historic-value">
                {formatAdvantageCount(historic2024.rdAdvantage)}
              </p>
              <p className="advantage-historic-pct">
                {formatAdvantagePct(historic2024.rdAdvantagePct)}
              </p>
            </div>
          ) : null}
          {historic2022 ? (
            <div className="advantage-historic-item">
              <p className="advantage-historic-label">2022</p>
              <p className="advantage-historic-value">
                {formatAdvantageCount(historic2022.rdAdvantage)}
              </p>
              <p className="advantage-historic-pct">
                {formatAdvantagePct(historic2022.rdAdvantagePct)}
              </p>
            </div>
          ) : null}
          {showHistoricNote ? (
            <p className="advantage-historic-note">{note.text}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
