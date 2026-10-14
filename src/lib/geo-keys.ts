import type { GeoAdvantage } from "./advantage";

export function mapGroupAdvantages(
  groupNames: string[],
  advantages: GeoAdvantage[] | undefined,
  resolve: (groupName: string) => string | null,
): Record<string, GeoAdvantage> {
  if (!advantages?.length) return {};
  const byKey = new Map(advantages.map((a) => [a.geoKey, a]));
  const out: Record<string, GeoAdvantage> = {};
  for (const name of groupNames) {
    const key = resolve(name);
    if (!key) continue;
    const adv = byKey.get(key);
    if (adv) out[name] = adv;
  }
  return out;
}

export function countyGroupKey(name: string): string | null {
  const n = name.trim().toLowerCase();
  if (!n || n === "total") return null;
  if (n === "rurals") return "county-rurals";
  return `county-${n.replace(/\s+/g, "-")}`;
}

export function congressGroupKey(name: string): string | null {
  const m = name.trim().match(/^CD\s*(\d+)/i);
  return m ? `congress-${Number(m[1])}` : null;
}

export function legislativeGroupKey(name: string): string | null {
  const sd = name.trim().match(/^SD\s*(\d+)/i);
  if (sd) return `senate-${Number(sd[1])}`;
  const ad = name.trim().match(/^AD\s*(\d+)/i);
  if (ad) return `assembly-${Number(ad[1])}`;
  return null;
}

export function commissionGroupKey(
  name: string,
  county: "washoe" | "clark",
): string | null {
  const m = name.trim().match(/district\s+(.+)/i);
  if (!m) return null;
  const dist = m[1]!.trim().toUpperCase();
  if (county === "clark" && dist === "F") return "commission-clark-f";
  return `commission-${county}-${dist.toLowerCase()}`;
}
