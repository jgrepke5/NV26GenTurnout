import { SITE } from "@/lib/site-config";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>
          Ballot and registration figures are aggregated from the{" "}
          <a href={SITE.sourceUrl} target="_blank" rel="noopener noreferrer">
            {SITE.sourceName}
          </a>
          . Registration counts every row in the extract by voter registration
          party. Only ballots with status Accepted and a vote method are
          counted as cast.
        </p>
        <p>
          This page refreshes when a new VIVID extract is synced. Percentages
          and vote totals reflect the file at the time of the last sync.
        </p>
      </div>
    </footer>
  );
}
