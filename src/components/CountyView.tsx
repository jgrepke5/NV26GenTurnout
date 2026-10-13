import type { GeoAdvantage } from "@/lib/advantage";
import { buildCountyBlocks } from "@/lib/county";
import { countyGroupKey, mapGroupAdvantages } from "@/lib/geo-keys";
import type { SheetTable } from "@/lib/types";
import { GroupedDataTable } from "./GroupedDataTable";

export function CountyView({
  sheet,
  advantages,
}: {
  sheet: SheetTable;
  advantages?: GeoAdvantage[];
}) {
  const blocks = buildCountyBlocks(sheet);

  return (
    <section className="section" id="county">
      <div className="container">
        <header className="section-header">
          <h2 className="section-title">{sheet.title}</h2>
        </header>
      </div>
      <div className="county-blocks">
        {blocks.map((block) => (
          <section
            key={block.title ?? block.variant}
            className={`section data-block data-block--${block.variant}`}
          >
            <div className="container">
              {block.title ? (
                <header className="section-header">
                  <h3 className="section-title">{block.title}</h3>
                </header>
              ) : null}
              <GroupedDataTable
                headers={block.headers}
                groups={block.groups}
                variant={block.variant}
                groupAdvantages={mapGroupAdvantages(
                  block.groups.map((g) => g.name),
                  advantages,
                  countyGroupKey,
                )}
              />
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
