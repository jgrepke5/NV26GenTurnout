export const SITE = {
  electionLabel: process.env.ELECTION_LABEL ?? "General",
  shortName: "General Turnout Tracker",
  title: "2026 Nevada General Turnout",
  description:
    "Live reporting on Nevada’s 2026 general election turnout — statewide, by county, and by legislative and congressional district.",
  ogDescription:
    "Turnout figures updated from official NVSOS VIVID ballot-status files.",
  kicker: "Election 2026 · Nevada",
  deck: "Ballots cast, turnout rates, and R/D advantage vs prior generals",
  lead:
    "Nevada’s 2026 general election early vote is underway. Tables show mail and early voting by party, plus Republican vs Democrat ballot advantage compared with 2022 and 2024 where available.",
  sourceName: "NVSOS VIVID Project",
  sourceUrl:
    process.env.UPDATE_FEED_URL ??
    "https://www.nvsos.gov/elections/election-information/vivid-project",
  /** First day of early voting (Pacific calendar date). */
  earlyVoteStart: "2026-10-17",
  /** Day before early voting opens — maps to historic RowNo 0. */
  dayBeforeEarlyVote: "2026-10-16",
  /**
   * Temporary footnote under historic R/D comps. Shown while snapshot
   * asOfDate equals throughAsOfDate; drops off on the next morning sync.
   */
  temporaryHistoricNote: {
    throughAsOfDate: "2026-10-18",
    text: "Note: In 2022, Clark County didn’t update their mail until the second day of early voting.",
  },
} as const;
