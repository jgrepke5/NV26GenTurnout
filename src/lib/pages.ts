import { getSnapshot } from "./cache";
import { applyOfficialVrToSnapshot } from "./voter-registration";
import type { TurnoutSnapshot } from "./types";

export async function loadTurnoutData(): Promise<TurnoutSnapshot> {
  const snapshot = await getSnapshot();
  return applyOfficialVrToSnapshot(snapshot);
}

export function getSheet(snapshot: TurnoutSnapshot, title: string) {
  const sheet = snapshot.sheets.find(
    (s) => s.title.toLowerCase() === title.toLowerCase(),
  );
  if (!sheet) {
    throw new Error(`Sheet "${title}" not found in spreadsheet data`);
  }
  return sheet;
}
