import type { GeoAdvantage } from "@/lib/advantage";
import { buildStatewideBlocks } from "@/lib/statewide";
import type { SheetTable } from "@/lib/types";
import { AdvantagePanel, findAdvantage } from "./AdvantagePanel";
import { DataTable } from "./DataTable";
import { TurnoutPieChart } from "./TurnoutPieChart";

export function StatewideView({
  sheet,
  advantages,
}: {
  sheet: SheetTable;
  advantages?: GeoAdvantage[];
}) {
  const blocks = buildStatewideBlocks(sheet);
  const statewideAdv = findAdvantage(advantages, "statewide");

  return (
    <div className="statewide-blocks">
      {statewideAdv ? (
        <section className="section data-block data-block--current">
          <div className="container">
            <header className="section-header">
              <h2 className="section-title">R/D Ballot Advantage</h2>
            </header>
            <AdvantagePanel advantage={statewideAdv} />
          </div>
        </section>
      ) : null}
      {blocks.map((block) => (
        <section
          key={block.title}
          className={`section data-block data-block--${block.variant}`}
        >
          <div className="container">
            <header className="section-header">
              <h2 className="section-title">{block.title}</h2>
            </header>
            {block.chartSlices && block.chartSlices.length > 0 ? (
              <div className="data-block-layout">
                <div className="data-block-table">
                  <DataTable
                    headers={block.headers}
                    rows={block.rows}
                    variant={block.variant}
                  />
                </div>
                <aside className="data-block-chart data-group-charts">
                  {block.registrationSlices &&
                  block.registrationSlices.length > 0 ? (
                    <TurnoutPieChart
                      slices={block.registrationSlices}
                      caption="2026 VR"
                    />
                  ) : null}
                  <TurnoutPieChart
                    slices={block.chartSlices}
                    caption="Votes to Date"
                  />
                </aside>
              </div>
            ) : (
              <DataTable
                headers={block.headers}
                rows={block.rows}
                variant={block.variant}
                wrapHeaders={block.wrapHeaders}
              />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
