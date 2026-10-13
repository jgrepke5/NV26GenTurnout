import { CountyView } from "@/components/CountyView";
import { ErrorPage } from "@/components/ErrorPage";
import { PageShell } from "@/components/PageShell";
import { getSheet, loadTurnoutData } from "@/lib/pages";

export const revalidate = 86400;

export default async function CountyPage() {
  try {
    const snapshot = await loadTurnoutData();
    const county = getSheet(snapshot, "County");

    return (
      <PageShell fetchedAt={snapshot.fetchedAt}>
        <CountyView sheet={county} advantages={snapshot.advantages} />
      </PageShell>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return <ErrorPage message={message} />;
  }
}
