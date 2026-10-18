export type AdvantageMetrics = {
  republicanVotes: number;
  democratVotes: number;
  otherVotes: number;
  allVotes: number;
  /** republicanVotes - democratVotes; + = R lead */
  rdAdvantage: number;
  /** (R - D) / allVotes; null if allVotes === 0 */
  rdAdvantagePct: number | null;
};

export type GeoAdvantage = {
  geoKey: string;
  label: string;
  metrics: AdvantageMetrics;
  historic2022: AdvantageMetrics | null;
  historic2024: AdvantageMetrics | null;
};

export function findAdvantage(
  advantages: GeoAdvantage[] | undefined,
  geoKey: string,
): GeoAdvantage | undefined {
  return advantages?.find((a) => a.geoKey === geoKey);
}

export function emptyMetrics(): AdvantageMetrics {
  return {
    republicanVotes: 0,
    democratVotes: 0,
    otherVotes: 0,
    allVotes: 0,
    rdAdvantage: 0,
    rdAdvantagePct: null,
  };
}

export function metricsFromCounts(
  republicanVotes: number,
  democratVotes: number,
  otherVotes: number,
): AdvantageMetrics {
  const allVotes = republicanVotes + democratVotes + otherVotes;
  const rdAdvantage = republicanVotes - democratVotes;
  return {
    republicanVotes,
    democratVotes,
    otherVotes,
    allVotes,
    rdAdvantage,
    rdAdvantagePct: allVotes > 0 ? rdAdvantage / allVotes : null,
  };
}

export function formatAdvantageCount(adv: number): string {
  if (adv === 0) return "EVEN";
  const abs = Math.abs(adv).toLocaleString("en-US");
  return adv > 0 ? `R+${abs}` : `D+${abs}`;
}

export function formatAdvantagePct(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  if (pct === 0) return "EVEN";
  const abs = `${(Math.abs(pct) * 100).toFixed(1)}%`;
  return pct > 0 ? `R+${abs}` : `D+${abs}`;
}

export function partyBucket(code: string): "REP" | "DEM" | "OTHER" {
  const p = code.trim().toUpperCase();
  if (p === "REP") return "REP";
  if (p === "DEM") return "DEM";
  return "OTHER";
}

/** Pacific calendar date YYYY-MM-DD → EV day index (0 = day before EV, 1 = EV day 1). */
export function evDayIndexForDate(
  ymd: string,
  earlyVoteStart = "2026-10-17",
  dayBefore = "2026-10-16",
): number {
  if (ymd <= dayBefore) return 0;
  const start = Date.parse(`${earlyVoteStart}T12:00:00-07:00`);
  const day = Date.parse(`${ymd}T12:00:00-07:00`);
  if (!Number.isFinite(start) || !Number.isFinite(day)) return 0;
  const diff = Math.floor((day - start) / 86_400_000);
  return Math.max(0, diff + 1);
}

export function todayPacificYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}
