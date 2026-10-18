import { CommissionView } from "@/components/CommissionView";
import { ErrorPage } from "@/components/ErrorPage";
import { PageShell } from "@/components/PageShell";
import { getSheet, loadTurnoutData } from "@/lib/pages";

export const revalidate = 86400;

export default async function CommissionPage() {
  try {
    const snapshot = await loadTurnoutData();
    const sheet = getSheet(snapshot, "Commission");

    return (
      <PageShell
        fetchedAt={snapshot.fetchedAt}
        asOfDate={snapshot.asOfDate}
      >
        <CommissionView sheet={sheet} advantages={snapshot.advantages} />
      </PageShell>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return <ErrorPage message={message} />;
  }
}
