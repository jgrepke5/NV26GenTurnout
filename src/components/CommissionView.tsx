import type { GeoAdvantage } from "@/lib/advantage";
import { buildCommissionBlocks } from "@/lib/commission";
import { commissionGroupKey, mapGroupAdvantages } from "@/lib/geo-keys";
import type { SheetTable } from "@/lib/types";
import { GroupedDataTable } from "./GroupedDataTable";

export function CommissionView({
  sheet,
  advantages,
}: {
  sheet: SheetTable;
  advantages?: GeoAdvantage[];
}) {
  const blocks = buildCommissionBlocks(sheet);

  return (
    <section className="section" id="commission">
      <div className="commission-blocks county-blocks legislative-blocks">
        {blocks.map((block) => {
          const county = /washoe/i.test(block.title ?? "")
            ? ("washoe" as const)
            : ("clark" as const);
          return (
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
                    (name) => commissionGroupKey(name, county),
                  )}
                />
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
