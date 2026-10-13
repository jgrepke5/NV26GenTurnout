import { SITE } from "../site-config";

export type DiscoveredFile = {
  label: string;
  url: string;
};

/**
 * Parse VIVID project HTML for File 1…File 6 links.
 * Prefers File 6 (zip of 1–5).
 */
export function parseFileLinks(html: string, baseUrl: string): DiscoveredFile[] {
  const files: DiscoveredFile[] = [];
  const re =
    /<a[^>]+href=["']([^"']+)["'][^>]*>\s*(File\s*[1-6])\s*<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1]!;
    const label = m[2]!.replace(/\s+/g, " ").trim();
    try {
      files.push({ label, url: new URL(href, baseUrl).toString() });
    } catch {
      /* skip bad urls */
    }
  }

  // Fallback: looser match
  if (files.length === 0) {
    const loose =
      /href=["']([^"']+\.(?:zip|csv)[^"']*)["'][^>]*>\s*(File\s*[1-6])/gi;
    while ((m = loose.exec(html)) !== null) {
      try {
        files.push({
          label: m[2]!.replace(/\s+/g, " ").trim(),
          url: new URL(m[1]!, baseUrl).toString(),
        });
      } catch {
        /* skip */
      }
    }
  }

  return files;
}

export function preferFile6(files: DiscoveredFile[]): DiscoveredFile | null {
  const six = files.find((f) => /file\s*6/i.test(f.label));
  return six ?? files[files.length - 1] ?? null;
}

export async function discoverFile6(
  feedUrl = SITE.sourceUrl,
): Promise<DiscoveredFile | null> {
  const res = await fetch(feedUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; NV26GenTurnout/1.0; +https://github.com/jgrepke5/NV26GenTurnout)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Failed to load VIVID feed (${res.status})`);
  }
  const html = await res.text();
  if (/incapsula|pardon our interruption|_Incapsula_Resource/i.test(html)) {
    throw new Error(
      "VIVID feed blocked by bot protection (Incapsula). Place the VIVID extract zip in data/raw/ and re-run sync.",
    );
  }
  const files = parseFileLinks(html, feedUrl);
  if (files.length === 0) {
    throw new Error(
      "No VIVID extract links found on the VIVID page. Place the extract zip in data/raw/ and re-run sync.",
    );
  }
  return preferFile6(files);
}
