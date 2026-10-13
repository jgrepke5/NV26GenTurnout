import type { GeoAdvantage } from "@/lib/advantage";
import { legislativeGroupKey, mapGroupAdvantages } from "@/lib/geo-keys";
import { buildLegislativeBlocks } from "@/lib/legislative";
import type { SheetTable } from "@/lib/types";
import { GroupedDataTable } from "./GroupedDataTable";

export function LegislativeView({
  sheet,
  advantages,
}: {
  sheet: SheetTable;
  advantages?: GeoAdvantage[];
}) {
  const blocks = buildLegislativeBlocks(sheet);

  return (
    <section className="section" id="legislative">
      <div className="legislative-blocks county-blocks">
        {blocks.map((block) => (
          <section
            key={block.title ?? block.variant}
            className={`section data-block data-block--${block.variant}`}
          >
            <div className="container">
              {block.title ? (
                <header className="section-header block-title-header">
                  <h2 className="section-title">{block.title}</h2>
                </header>
              ) : null}
              <GroupedDataTable
                headers={block.headers}
                groups={block.groups}
                variant={block.variant}
                groupAdvantages={mapGroupAdvantages(
                  block.groups.map((g) => g.name),
                  advantages,
                  legislativeGroupKey,
                )}
              />
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
