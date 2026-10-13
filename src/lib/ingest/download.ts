import { createHash } from "crypto";
import { createWriteStream } from "fs";
import { mkdir, readdir, readFile, stat } from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const RAW_DIR = path.join(process.cwd(), "data", "raw");

export async function ensureRawDir() {
  await mkdir(RAW_DIR, { recursive: true });
}

/** Find newest local File 6 zip or extracted csv in data/raw */
export async function findLocalRaw(): Promise<{
  zipPath?: string;
  csvPath?: string;
} | null> {
  await ensureRawDir();
  const names = await readdir(RAW_DIR);
  const zips = names
    .filter((n) => /\.zip$/i.test(n) && /file\s*6|file6/i.test(n))
    .sort();
  const csvs = names
    .filter((n) => /\.csv$/i.test(n))
    .sort();

  if (zips.length === 0 && csvs.length === 0) {
    // also accept any zip
    const anyZip = names.filter((n) => /\.zip$/i.test(n)).sort();
    if (anyZip.length === 0) return null;
    return { zipPath: path.join(RAW_DIR, anyZip[anyZip.length - 1]!) };
  }

  return {
    zipPath: zips.length
      ? path.join(RAW_DIR, zips[zips.length - 1]!)
      : undefined,
    csvPath: csvs.length
      ? path.join(RAW_DIR, csvs[csvs.length - 1]!)
      : undefined,
  };
}

export async function downloadToRaw(
  url: string,
  filename = "File6.zip",
): Promise<string> {
  await ensureRawDir();
  const dest = path.join(RAW_DIR, filename);
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; NV26GenTurnout/1.0; +https://github.com/jgrepke5/NV26GenTurnout)",
    },
    redirect: "follow",
  });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download File 6 (${res.status})`);
  }
  const nodeStream = createWriteStream(dest);
  // @ts-expect-error Node fetch body is a web stream
  await pipeline(res.body, nodeStream);
  return dest;
}

export async function extractCsvFromZip(zipPath: string): Promise<string> {
  await ensureRawDir();
  const extractDir = path.join(RAW_DIR, "extracted");
  await mkdir(extractDir, { recursive: true });
  await execFileAsync("unzip", ["-o", zipPath, "-d", extractDir], {
    maxBuffer: 10 * 1024 * 1024,
  });

  async function walk(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) files.push(...(await walk(p)));
      else if (/\.csv$/i.test(e.name)) files.push(p);
    }
    return files;
  }

  const csvs = await walk(extractDir);
  if (csvs.length === 0) {
    throw new Error(`No CSV found inside ${zipPath}`);
  }
  // Prefer largest CSV (File 6)
  let best = csvs[0]!;
  let bestSize = 0;
  for (const c of csvs) {
    const s = (await stat(c)).size;
    if (s > bestSize) {
      bestSize = s;
      best = c;
    }
  }
  return best;
}

export async function hashFile(filePath: string): Promise<string> {
  const buf = await readFile(filePath);
  return createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

export { RAW_DIR };
