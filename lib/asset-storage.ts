/**
 * 资产列表的 AsyncStorage 读写。读失败时打日志并尽量返回上一次成功结果（内存缓存，仅本次进程有效）。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { getAssetDisplayValue } from '@/lib/asset-value';
import { mergeListedDuplicateAssets } from '@/lib/listed-merge';
import { ensureAsset, type SimpleAsset } from '@/types/asset';

function assetsJsonEqual(a: SimpleAsset[], b: SimpleAsset[]): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export const ASSETS_STORAGE_KEY = 'assets';

/** 本次 App 运行内最后一次成功解析的资产列表（解析失败时回退） */
let lastGoodAssets: SimpleAsset[] | null = null;

export async function getAssets(): Promise<SimpleAsset[]> {
  try {
    const stored = await AsyncStorage.getItem(ASSETS_STORAGE_KEY);
    const raw: unknown[] = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(raw)) {
      throw new Error('stored assets is not an array');
    }
    const list = raw.map((item) => ensureAsset(item));
    const merged = mergeListedDuplicateAssets(list);
    if (!assetsJsonEqual(list, merged)) {
      lastGoodAssets = merged;
      await AsyncStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
    lastGoodAssets = list;
    return list;
  } catch (e) {
    console.warn('[assetup] getAssets 解析失败，使用上次成功缓存或空数组', e);
    return lastGoodAssets ?? [];
  }
}

export async function saveAssets(assets: SimpleAsset[]): Promise<void> {
  await AsyncStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));
  lastGoodAssets = assets;
  notifyAssets(assets);
}

const assetListeners = new Set<(assets: SimpleAsset[]) => void>();

/** 订阅资产持久化写入；回调收到的是写入后的最新数组。返回取消订阅函数。 */
export function subscribeAssets(
  listener: (assets: SimpleAsset[]) => void
): () => void {
  assetListeners.add(listener);
  return () => {
    assetListeners.delete(listener);
  };
}

function notifyAssets(assets: SimpleAsset[]): void {
  assetListeners.forEach((cb) => {
    try {
      cb(assets);
    } catch {
      /* listener 异常不影响其它订阅者 */
    }
  });
}

export async function addAsset(asset: SimpleAsset): Promise<void> {
  const assets = await getAssets();
  assets.push(asset);
  await saveAssets(assets);
}

export async function deleteAsset(id: string): Promise<void> {
  const assets = await getAssets();
  const filtered = assets.filter((a) => a.id !== id);
  if (filtered.length !== assets.length) {
    await saveAssets(filtered);
  }
}

/**
 * 按 id 替换一条资产；若展示市值变化则往 history 追加一条（日期为上海当天）。
 */
export async function updateAsset(updatedAsset: SimpleAsset): Promise<void> {
  const assets = await getAssets();
  const index = assets.findIndex((a) => a.id === updatedAsset.id);
  if (index >= 0) {
    const existing = assets[index];
    let history = existing.history ? [...existing.history] : [];
    const oldValue = getAssetDisplayValue(existing);
    const newValue = getAssetDisplayValue(updatedAsset);
    if (newValue !== oldValue) {
      history.push({ date: getShanghaiDateString(), value: newValue });
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
