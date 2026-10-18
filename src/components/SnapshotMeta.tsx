"use client";

import { createContext, useContext, type ReactNode } from "react";

type SnapshotMeta = {
  asOfDate?: string;
};

const SnapshotMetaContext = createContext<SnapshotMeta>({});

export function SnapshotMetaProvider({
  asOfDate,
  children,
}: SnapshotMeta & { children: ReactNode }) {
  return (
    <SnapshotMetaContext.Provider value={{ asOfDate }}>
      {children}
    </SnapshotMetaContext.Provider>
  );
}

export function useSnapshotMeta(): SnapshotMeta {
  return useContext(SnapshotMetaContext);
}
