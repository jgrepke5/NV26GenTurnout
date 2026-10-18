import { ErrorPage } from "@/components/ErrorPage";
import { LegislativeView } from "@/components/LegislativeView";
import { PageShell } from "@/components/PageShell";
import { getSheet, loadTurnoutData } from "@/lib/pages";

export const revalidate = 86400;

export default async function LegislativePage() {
  try {
    const snapshot = await loadTurnoutData();
    const sheet = getSheet(snapshot, "Legislative");

    return (
      <PageShell
        fetchedAt={snapshot.fetchedAt}
        asOfDate={snapshot.asOfDate}
      >
        <LegislativeView sheet={sheet} advantages={snapshot.advantages} />
      </PageShell>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return <ErrorPage message={message} />;
  }
}
