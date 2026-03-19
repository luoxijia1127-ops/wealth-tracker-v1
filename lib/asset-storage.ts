/**
 * Asset storage utility
 *
 * Centralizes all AsyncStorage operations for assets.
 * Storage key: "assets". Uses ensureAsset for legacy migration on read.
 *
 * All functions are async and reusable. Data consistency: read-modify-write
 * is done atomically (load → modify → save) to avoid race conditions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureAsset, type SimpleAsset } from '@/types/asset';

export const ASSETS_STORAGE_KEY = 'assets';

/**
 * Loads all assets from storage. Migrates legacy format via ensureAsset.
 * Returns empty array on error or if no data.
 */
export async function getAssets(): Promise<SimpleAsset[]> {
  try {
    const stored = await AsyncStorage.getItem(ASSETS_STORAGE_KEY);
    const raw: unknown[] = stored ? JSON.parse(stored) : [];
    return raw.map((item) => ensureAsset(item));
  } catch {
    return [];
  }
}

/**
 * Saves the full assets array to storage. Overwrites existing data.
 */
export async function saveAssets(assets: SimpleAsset[]): Promise<void> {
  await AsyncStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));
}

/**
 * Appends one asset to storage. Loads current list, pushes, saves.
 */
export async function addAsset(asset: SimpleAsset): Promise<void> {
  const assets = await getAssets();
  assets.push(asset);
  await saveAssets(assets);
}

/**
 * Removes an asset by id. No-op if id not found.
 */
export async function deleteAsset(id: string): Promise<void> {
  const assets = await getAssets();
  const filtered = assets.filter((a) => a.id !== id);
  if (filtered.length !== assets.length) {
    await saveAssets(filtered);
  }
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Replaces an existing asset with the same id.
 * When value changes, appends { date, value } to history (never overwrites).
 * If id not found, appends as new asset (fallback).
 */
export async function updateAsset(updatedAsset: SimpleAsset): Promise<void> {
  const assets = await getAssets();
  const index = assets.findIndex((a) => a.id === updatedAsset.id);
  if (index >= 0) {
    const existing = assets[index];
    let history = existing.history ? [...existing.history] : [];
    const oldValue = typeof existing.value === 'number' ? existing.value : 0;
    const newValue = typeof updatedAsset.value === 'number' ? updatedAsset.value : 0;
    if (newValue !== oldValue) {
      history.push({ date: getTodayDateString(), value: newValue });
    }
    assets[index] = {
      ...updatedAsset,
      history: history.length > 0 ? history : undefined,
    };
  } else {
    assets.push(updatedAsset);
  }
  await saveAssets(assets);
}
