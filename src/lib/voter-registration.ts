import { readFile } from "fs/promises";
import path from "path";

/** Kept for reference / future SOS overlays; live site uses File 6 VR. */
export type OfficialVr = {
  asOf: string;
  source?: string;
  statewide: number;
  counties: Record<string, number>;
  congress: Record<string, number>;
  senate: Record<string, number>;
  assembly: Record<string, number>;
};

const VR_PATH = path.join(process.cwd(), "data", "voter-registration.json");

let cached: OfficialVr | null = null;

export async function loadOfficialVr(): Promise<OfficialVr> {
  if (cached) return cached;
  const raw = await readFile(VR_PATH, "utf-8");
  cached = JSON.parse(raw) as OfficialVr;
  return cached;
}
