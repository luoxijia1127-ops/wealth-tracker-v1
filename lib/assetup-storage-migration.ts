/**
 * 一次性迁移：旧 AsyncStorage 前缀 → @assetup/*
 * 顺序：优先从 @nest/* 复制，否则从 @wealth-tracker/*；仅在目标键尚无数据时写入。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const MIGRATION_FLAG = '@assetup/migrated-from-legacy-storage-keys-v1';

const KEY_PAIRS: { dest: string; sources: string[] }[] = [
  {
    dest: '@assetup/archived-assets-v1',
    sources: ['@nest/archived-assets-v1', '@wealth-tracker/archived-assets-v1'],
  },
  {
    dest: '@assetup/deleted-assets-v1',
    sources: ['@nest/deleted-assets-v1', '@wealth-tracker/deleted-assets-v1'],
  },
  {
    dest: '@assetup/display-currency',
    sources: ['@nest/display-currency', '@wealth-tracker/display-currency'],
  },
  {
    dest: '@assetup/palette-id',
    sources: ['@nest/palette-id', '@wealth-tracker/palette-id'],
  },
  {
    dest: '@assetup/language-mode',
    sources: ['@nest/language-mode'],
  },
  {
    dest: '@assetup/market-quotes-cache-v1',
    sources: ['@nest/market-quotes-cache-v1'],
  },
];

export async function migrateAssetupStorageFromLegacyOnce(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(MIGRATION_FLAG)) === '1') return;
    for (const { dest, sources } of KEY_PAIRS) {
      if ((await AsyncStorage.getItem(dest)) !== null) continue;
      for (const src of sources) {
        const v = await AsyncStorage.getItem(src);
        if (v !== null) {
          await AsyncStorage.setItem(dest, v);
          break;
        }
      }
    }
    await AsyncStorage.setItem(MIGRATION_FLAG, '1');
  } catch {
    /* 迁移失败不阻塞启动 */
  }
}
