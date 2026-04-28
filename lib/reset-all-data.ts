/**
 * 清除所有本地数据：用于用户主动"删除所有数据"场景。
 *
 * 使用 AsyncStorage.clear() 清除本应用所有 AsyncStorage 键。
 * 订阅状态由 Apple App Store 与 RevenueCat 管理，不受影响。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export async function resetAllLocalData(): Promise<void> {
  await AsyncStorage.clear();
}
