import { fetchAndPersistSnapshot } from "../src/lib/cache";

async function main() {
  console.log("Syncing turnout data from NVSOS VIVID…");
  const snapshot = await fetchAndPersistSnapshot();
  console.log(`Done. Fetched at ${snapshot.fetchedAt}`);
  console.log(`  asOfDate=${snapshot.asOfDate} evDayIndex=${snapshot.evDayIndex}`);
  for (const sheet of snapshot.sheets) {
    console.log(`  · ${sheet.title}: ${sheet.rows.length} rows`);
  }
  const statewide = snapshot.advantages?.find((a) => a.geoKey === "statewide");
  if (statewide) {
    console.log(
      `  · Advantage: R=${statewide.metrics.republicanVotes} D=${statewide.metrics.democratVotes} gap=${statewide.metrics.rdAdvantage}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
