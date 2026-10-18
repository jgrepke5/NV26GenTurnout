import { CongressionalView } from "@/components/CongressionalView";
import { ErrorPage } from "@/components/ErrorPage";
import { PageShell } from "@/components/PageShell";
import { getSheet, loadTurnoutData } from "@/lib/pages";

export const revalidate = 86400;

export default async function CongressionalPage() {
  try {
    const snapshot = await loadTurnoutData();
    const sheet = getSheet(snapshot, "Congressional");

    return (
      <PageShell
        fetchedAt={snapshot.fetchedAt}
        asOfDate={snapshot.asOfDate}
      >
        <CongressionalView sheet={sheet} advantages={snapshot.advantages} />
      </PageShell>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return <ErrorPage message={message} />;
  }
}
