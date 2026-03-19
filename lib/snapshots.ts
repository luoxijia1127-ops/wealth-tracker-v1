/**
 * Asset snapshot utilities
 *
 * Stores daily net worth snapshots in AsyncStorage for tracking value over time.
 * Snapshot format: { date: YYYY-MM-DD, totalValue: number }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const SNAPSHOTS_STORAGE_KEY = 'snapshots';

/** A single daily snapshot of total net worth. */
export type Snapshot = {
  date: string; // YYYY-MM-DD
  totalValue: number;
};

/** Returns the current date in YYYY-MM-DD format. */
function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns all snapshots from storage.
 * Returns empty array if none exist or on parse error.
 */
export async function getSnapshots(): Promise<Snapshot[]> {
  try {
    const stored = await AsyncStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves a snapshot for today's date if one doesn't already exist.
 * Does nothing if today's snapshot is already stored.
 */
export async function saveSnapshot(totalValue: number): Promise<void> {
  const snapshots = await getSnapshots();
  const today = getTodayDateString();

  if (snapshots.some((s) => s.date === today)) {
    return;
  }

  snapshots.push({ date: today, totalValue });
  await AsyncStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
}
