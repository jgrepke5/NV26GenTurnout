import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { unstable_cache, revalidateTag } from "next/cache";
import { isCacheStale } from "./schedule";
import { syncVividSnapshot } from "./ingest/sync-vivid";
import type { TurnoutSnapshot } from "./types";

const CACHE_TAG = "turnout-data";
const REVALIDATE_SECONDS = 86400;
const LOCAL_CACHE_PATH = path.join(process.cwd(), "data", "cache.json");

const isVercel = Boolean(process.env.VERCEL);

function useBuildTimeCache(): boolean {
  return (
    process.env.NEXT_USE_SHEET_CACHE === "1" ||
    process.env.NEXT_PHASE === "phase-production-build"
  );
}

const getCachedSnapshot = unstable_cache(
  async () => {
    const local = await readLocalCache();
    if (local) return local;
    return syncVividSnapshot();
  },
  ["turnout-snapshot-vivid"],
  { revalidate: REVALIDATE_SECONDS, tags: [CACHE_TAG] },
);

async function readLocalCache(): Promise<TurnoutSnapshot | null> {
  try {
    const raw = await readFile(LOCAL_CACHE_PATH, "utf-8");
    return JSON.parse(raw) as TurnoutSnapshot;
  } catch {
    return null;
  }
}

async function writeLocalCache(snapshot: TurnoutSnapshot): Promise<void> {
  await mkdir(path.dirname(LOCAL_CACHE_PATH), { recursive: true });
  await writeFile(LOCAL_CACHE_PATH, JSON.stringify(snapshot, null, 2), "utf-8");
}

/** Fetch from VIVID File 6 and write data/cache.json */
export async function fetchAndPersistSnapshot(): Promise<TurnoutSnapshot> {
  const snapshot = await syncVividSnapshot();
  await writeLocalCache(snapshot);
  return snapshot;
}

export async function refreshSnapshot(): Promise<TurnoutSnapshot> {
  revalidateTag(CACHE_TAG);
  return fetchAndPersistSnapshot();
}

export async function getSnapshot(force = false): Promise<TurnoutSnapshot> {
  if (force) {
    return fetchAndPersistSnapshot();
  }

  if (isVercel && useBuildTimeCache()) {
    const cached = await readLocalCache();
    if (cached) return cached;
    throw new Error(
      "Missing data/cache.json. Run npm run sync before npm run build.",
    );
  }

  if (isVercel) {
    return getCachedSnapshot();
  }

  const cached = await readLocalCache();
  if (cached && !isCacheStale(cached.fetchedAt)) {
    return cached;
  }

  // Prefer existing cache if sync would need a huge File 6 download
  if (cached) return cached;

  const snapshot = await fetchAndPersistSnapshot();
  return snapshot;
}
