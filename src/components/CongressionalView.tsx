import type { GeoAdvantage } from "@/lib/advantage";
import { buildCongressionalBlocks } from "@/lib/congressional";
import { congressGroupKey, mapGroupAdvantages } from "@/lib/geo-keys";
import type { SheetTable } from "@/lib/types";
import { GroupedDataTable } from "./GroupedDataTable";

export function CongressionalView({
  sheet,
  advantages,
}: {
  sheet: SheetTable;
  advantages?: GeoAdvantage[];
}) {
  const blocks = buildCongressionalBlocks(sheet);

  return (
    <section className="section" id="congressional">
      <div className="congressional-blocks county-blocks legislative-blocks">
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
                  congressGroupKey,
                )}
              />
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
