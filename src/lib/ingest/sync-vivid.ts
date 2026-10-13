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
import { applyOfficialVr, loadOfficialVr } from "../voter-registration";
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
    if (!file) throw new Error("File 6 not found");
    const zipPath = await downloadToRaw(file.url, "File6-latest.zip");
    const csvPath = await extractCsvFromZip(zipPath);
    return { csvPath, sourceUrl: file.url, sourceLabel: file.label };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `${msg}\n\nPlace the NVSOS File 6 zip at data/raw/File6.zip and run npm run sync again.`,
    );
  }
}

export async function syncVividSnapshot(): Promise<TurnoutSnapshot> {
  console.log("Resolving VIVID File 6…");
  const { csvPath, sourceUrl, sourceLabel } = await resolveCsvPath();
  console.log(`  Using ${sourceLabel}: ${csvPath}`);

  const sourceHash = await hashStream(csvPath);
  console.log(`  Hash ${sourceHash}`);
  console.log("Aggregating (streaming)…");
  let agg = await aggregateVividCsv(csvPath);
  const vr = await loadOfficialVr();
  agg = applyOfficialVr(agg, vr);
  console.log(`  Accepted ballots: ${agg.acceptedVotes.toLocaleString()}`);
  console.log(
    `  Official VR (as of ${vr.asOf}): ${agg.statewide.registered.toLocaleString()}`,
  );

  const asOfDate = todayPacificYmd();
  const evDayIndex = evDayIndexForDate(
    asOfDate,
    SITE.earlyVoteStart,
    SITE.dayBeforeEarlyVote,
  );

  const snapshot = await snapshotFromAggregate(agg, {
    sourceUrl,
    sourceHash,
    asOfDate,
    evDayIndex,
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
