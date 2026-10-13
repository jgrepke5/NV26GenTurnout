import type { SheetTable } from "@/lib/types";
import { DataTable } from "./DataTable";

const SECTION_COPY: Record<string, { intro: string }> = {
  Statewide: {
    intro:
      "Party-by-party turnout plus early, mail, and election day ballot splits.",
  },
  County: {
    intro:
      "Turnout and voting method by county, with party breakdowns where available.",
  },
  Legislative: {
    intro:
      "Participation in state senate and assembly districts.",
  },
};

export function DataSection({ sheet }: { sheet: SheetTable }) {
  const copy = SECTION_COPY[sheet.title] ?? {
    intro: "Figures from the VIVID ballot-status extract.",
  };

  return (
    <section className="section" id={sheet.title.toLowerCase()}>
      <div className="container">
        <header className="section-header">
          <p className="section-kicker">By the numbers</p>
          <h2 className="section-title">{sheet.title}</h2>
          <p className="section-intro">{copy.intro}</p>
        </header>
        <DataTable headers={sheet.headers} rows={sheet.rows} />
      </div>
    </section>
  );
}
