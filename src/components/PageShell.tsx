import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Masthead } from "./Masthead";
import { SiteNav } from "./SiteNav";
import { UpdateBanner } from "./UpdateBanner";

export function PageShell({
  fetchedAt,
  children,
}: {
  fetchedAt: string;
  children: ReactNode;
}) {
  return (
    <>
      <Masthead />
      <SiteNav />
      <UpdateBanner fetchedAt={fetchedAt} />
      <main>{children}</main>
      <Footer />
    </>
  );
}
