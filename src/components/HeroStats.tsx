import { extractHeroMetrics } from "@/lib/parse";
import { SITE } from "@/lib/site-config";
import type { SheetTable } from "@/lib/types";

export function HeroStats({ statewide }: { statewide: SheetTable | undefined }) {
  if (!statewide) return null;

  const hero = extractHeroMetrics(statewide);
  if (!hero) return null;

  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <article className="stat-card">
            <p className="stat-label">Votes cast to date</p>
            <p className="stat-value">{hero.votes}</p>
            <p className="stat-note">Statewide total, accepted ballots</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">2026 turnout rate</p>
            <p className="stat-value">{hero.turnout}</p>
            <p className="stat-note">Share of registered voters</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Registered voters</p>
            <p className="stat-value">{hero.registered}</p>
            <p className="stat-note">Voters in latest VIVID extract</p>
          </article>
        </div>
        <p className="lead">{SITE.lead}</p>
      </div>
    </section>
  );
}
