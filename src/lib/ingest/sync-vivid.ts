import { createHash } from "crypto";
import { createReadStream } from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  evDayIndexForDate,
  todayPacificYmd,
} from "../advantage";
import { SITE } from "../site-config";
import type { TurnoutSnapshot } from "../types";
import { aggregateVividCsv } from "./aggregate";
import { snapshotFromAggregate } from "./build-sheets";
import { discoverFile6 } from "./discover";
import {
  downloadToRaw,
  extractCsvFromZip,
  findLocalRaw,
} from "./download";

const HISTORY_DIR = path.join(process.cwd(), "data", "history");

async function hashStream(filePath: string): Promise<string> {
  // For large files, hash first/last chunks + size via streaming
  const hash = createHash("sha256");
  const stream = createReadStream(filePath, { highWaterMark: 1024 * 1024 });
  let size = 0;
  for await (const chunk of stream) {
    size += (chunk as Buffer).length;
    hash.update(chunk as Buffer);
  }
  return `${hash.digest("hex").slice(0, 16)}-${size}`;
}

async function resolveCsvPath(): Promise<{
  csvPath: string;
  sourceUrl: string;
  sourceLabel: string;
}> {
  // Prefer local raw (avoids Incapsula)
  const local = await findLocalRaw();
  if (local?.csvPath) {
    return {
      csvPath: local.csvPath,
      sourceUrl: SITE.sourceUrl,
      sourceLabel: path.basename(local.csvPath),
    };
  }
  if (local?.zipPath) {
    const csvPath = await extractCsvFromZip(local.zipPath);
    return {
      csvPath,
      sourceUrl: SITE.sourceUrl,
      sourceLabel: path.basename(local.zipPath),
    };
  }

  // Try live discover + download
  try {
    const file = await discoverFile6();
    if (!file) throw new Error("VIVID extract not found");
    const zipPath = await downloadToRaw(file.url, "File6-latest.zip");
    const csvPath = await extractCsvFromZip(zipPath);
    return { csvPath, sourceUrl: file.url, sourceLabel: file.label };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `${msg}\n\nPlace the NVSOS VIVID extract zip in data/raw/ and run npm run sync again.`,
    );
  }
}

export async function syncVividSnapshot(): Promise<TurnoutSnapshot> {
  console.log("Resolving VIVID extract…");
  const { csvPath, sourceUrl, sourceLabel } = await resolveCsvPath();
  console.log(`  Using ${sourceLabel}: ${csvPath}`);

  const sourceHash = await hashStream(csvPath);
  console.log(`  Hash ${sourceHash}`);
  console.log("Aggregating (streaming)…");
  const agg = await aggregateVividCsv(csvPath);
  console.log(`  Accepted ballots: ${agg.acceptedVotes.toLocaleString()}`);
  console.log(
    `  VIVID registered: ${agg.statewide.registered.toLocaleString()} (R ${agg.statewide.REP.registered.toLocaleString()} / D ${agg.statewide.DEM.registered.toLocaleString()} / Other ${agg.statewide.OTHER.registered.toLocaleString()})`,
  );

  const asOfDate = todayPacificYmd();
  const fetchedAt = process.env.FETCHED_AT || new Date().toISOString();
  const calendarDay = evDayIndexForDate(
    asOfDate,
    SITE.earlyVoteStart,
    SITE.dayBeforeEarlyVote,
  );

  // Morning (9:30 PT) extracts are mostly through end of yesterday, while
  // historic RowNo N is cumulative through end of EV day N. Align historic
  // one day behind for morning banners; afternoon (4:00 PT) uses calendar day.
  const pacificHour = Number(
    new Date(fetchedAt).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hour12: false,
    }),
  );
  const morningLag = pacificHour < 12;

  const forceDay = process.env.FORCE_EV_DAY_INDEX;
  let evDayIndex: number;
  if (forceDay !== undefined && forceDay !== "") {
    evDayIndex = Number(forceDay);
    console.log(`  Forced evDayIndex=${evDayIndex} (FORCE_EV_DAY_INDEX)`);
  } else if (morningLag) {
    evDayIndex = Math.max(0, calendarDay - 1);
    console.log(
      `  Morning update: historic day ${evDayIndex} (calendar day ${calendarDay} − 1)`,
    );
  } else {
    evDayIndex = calendarDay;
    console.log(`  Afternoon update: historic day ${evDayIndex}`);
  }
  if (!Number.isFinite(evDayIndex) || evDayIndex < 0) {
    throw new Error(`Invalid FORCE_EV_DAY_INDEX: ${forceDay}`);
  }

  const snapshot = await snapshotFromAggregate(agg, {
    sourceUrl,
    sourceHash,
    asOfDate,
    evDayIndex,
    fetchedAt,
  });

  await mkdir(HISTORY_DIR, { recursive: true });
  const histPath = path.join(HISTORY_DIR, `${asOfDate}.json`);
  await writeFile(
    histPath,
    JSON.stringify(
      {
        asOfDate,
        evDayIndex,
        sourceHash,
        fetchedAt: snapshot.fetchedAt,
        advantages: snapshot.advantages,
      },
      null,
      2,
    ),
    "utf-8",
  );
  console.log(`  Sealed history → ${histPath}`);

  return snapshot;
}
