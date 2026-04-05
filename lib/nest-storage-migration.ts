/**
 * 自 wealth-tracker 更名为 Nest 后，将带旧前缀的 AsyncStorage 键复制到新键（一次性）。
 * 仅在目标键不存在时复制，避免覆盖新数据。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const MIGRATION_FLAG = '@nest/migrated-storage-from-wealth-tracker-v1';

const LEGACY_TO_NEST: [string, string][] = [
  ['@wealth-tracker/archived-assets-v1', '@nest/archived-assets-v1'],
  ['@wealth-tracker/deleted-assets-v1', '@nest/deleted-assets-v1'],
  ['@wealth-tracker/display-currency', '@nest/display-currency'],
  ['@wealth-tracker/palette-id', '@nest/palette-id'],
];

export async function migrateNestStorageFromWealthTrackerOnce(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(MIGRATION_FLAG)) === '1') return;
    for (const [legacyKey, nestKey] of LEGACY_TO_NEST) {
      const nextVal = await AsyncStorage.getItem(nestKey);
      if (nextVal !== null) continue;
      const legacyVal = await AsyncStorage.getItem(legacyKey);
      if (legacyVal !== null) {
        await AsyncStorage.setItem(nestKey, legacyVal);
      }
    }
    await AsyncStorage.setItem(MIGRATION_FLAG, '1');
  } catch {
    /* 迁移失败不阻塞启动；新键为空时用户相当于新装 */
  }
}
