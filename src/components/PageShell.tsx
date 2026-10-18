import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Masthead } from "./Masthead";
import { SiteNav } from "./SiteNav";
import { SnapshotMetaProvider } from "./SnapshotMeta";
import { UpdateBanner } from "./UpdateBanner";

export function PageShell({
  fetchedAt,
  asOfDate,
  children,
}: {
  fetchedAt: string;
  asOfDate?: string;
  children: ReactNode;
}) {
  return (
    <SnapshotMetaProvider asOfDate={asOfDate}>
      <Masthead />
      <SiteNav />
      <UpdateBanner fetchedAt={fetchedAt} />
      <main>{children}</main>
      <Footer />
    </SnapshotMetaProvider>
  );
}
