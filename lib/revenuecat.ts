/**
 * RevenueCat：初始化与权益查询（iOS/Android；Web 不启用）
 *
 * Expo Go 内无原生 App Store / StoreKit，不能使用 appl_ 公钥，否则会抛错。
 * 本地用 Expo Go 调试时请在 .env 设置 EXPO_PUBLIC_REVENUECAT_IOS_API_KEY_TEST=test_…；
 * 真机沙盒 / 上架请用 npx expo run:ios、development build 或 EAS，并配置 appl_。
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

import { REVENUECAT_ENTITLEMENT_ID } from '@/lib/subscription-constants';

let configured = false;

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/**
 * 选择在当前环境下可用的 RevenueCat 公钥。
 * - Expo Go：仅 test_（Test Store），见 https://rev.cat/sdk-test-store
 * - 独立包 / dev client：appl_（Apple App Store）
 */
function resolveRevenueCatPublicApiKey(): string | undefined {
  const store = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
  const test = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY_TEST?.trim();

  if (isExpoGo()) {
    if (test && test.startsWith('test_')) return test;
    if (store?.startsWith('test_')) return store;
    return undefined;
  }

  if (store) return store;
  return undefined;
}

export function configureRevenueCat(): void {
  if (Platform.OS === 'web') return;
  if (configured) return;

  const key = resolveRevenueCatPublicApiKey();
  if (!key) {
    if (__DEV__) {
      if (isExpoGo()) {
        console.warn(
          '[assetup] Expo Go 内不能使用 App Store 公钥 (appl_)。请在 .env 增加 EXPO_PUBLIC_REVENUECAT_IOS_API_KEY_TEST=test_…（RevenueCat → Apps & providers → API keys → Test Store → Show key），或运行 npx expo run:ios / development build 使用 appl_。'
        );
      } else {
        console.warn(
          '[assetup] 未设置 EXPO_PUBLIC_REVENUECAT_IOS_API_KEY，订阅与会员校验不可用'
        );
      }
    }
    return;
  }

  try {
    void Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
    Purchases.configure({ apiKey: key });
    configured = true;
  } catch (e) {
    console.warn('[assetup] RevenueCat configure 失败', e);
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
