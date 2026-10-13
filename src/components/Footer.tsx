import { SITE } from "@/lib/site-config";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>
          Ballot figures are aggregated from the{" "}
          <a href={SITE.sourceUrl} target="_blank" rel="noopener noreferrer">
            {SITE.sourceName}
          </a>{" "}
          File 6 extract. Only ballots with status Accepted and a vote method
          are counted as cast. Active voter registration totals are from the
          Nevada Secretary of State reports as of October 1, 2026.
        </p>
        <p>
          This page refreshes when a new VIVID File 6 extract is synced.
          Percentages and vote totals reflect the file at the time of the last
          sync.
        </p>
      </div>
    </footer>
  );
}
