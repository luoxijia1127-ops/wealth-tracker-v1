/**
 * RevenueCat：初始化与权益查询（iOS/Android；Web 不启用）
 */

import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

import { REVENUECAT_ENTITLEMENT_ID } from '@/lib/subscription-constants';

let configured = false;

export function configureRevenueCat(): void {
  if (Platform.OS === 'web') return;
  if (configured) return;

  const key = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
  if (!key) {
    if (__DEV__) {
      console.warn(
        '[nest] 未设置 EXPO_PUBLIC_REVENUECAT_IOS_API_KEY，订阅与会员校验不可用'
      );
    }
    return;
  }

  try {
    void Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
    Purchases.configure({ apiKey: key });
    configured = true;
  } catch (e) {
    console.warn('[nest] RevenueCat configure 失败', e);
  }
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}

export async function getIsProEntitlementActive(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!configured) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
  } catch {
    return false;
  }
}

export async function syncPurchasesCustomerInfo(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.syncPurchases();
  } catch {
    /* 忽略 */
  }
}
