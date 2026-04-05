/**
 * RevenueCat 会员状态：启动时 configure，并监听 CustomerInfo 更新。
 */

import {
  configureRevenueCat,
  getIsProEntitlementActive,
  isRevenueCatConfigured,
} from '@/lib/revenuecat';
import { REVENUECAT_ENTITLEMENT_ID } from '@/lib/subscription-constants';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import type { CustomerInfo } from 'react-native-purchases';

type PurchasesContextValue = {
  /** RevenueCat 已 configure（有 API Key 且成功） */
  ready: boolean;
  /** 当前是否享有 nest_pro 权益 */
  isPro: boolean;
  refresh: () => Promise<void>;
};

const PurchasesContext = createContext<PurchasesContextValue | null>(null);

export function PurchasesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [isPro, setIsPro] = useState(false);

  const refresh = useCallback(async () => {
    const active = await getIsProEntitlementActive();
    setIsPro(active);
  }, []);

  useEffect(() => {
    configureRevenueCat();
    let cancelled = false;
    void (async () => {
      await refresh();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim()) return;
    if (!isRevenueCatConfigured()) return;

    const listener = (info: CustomerInfo) => {
      setIsPro(!!info.entitlements.active[REVENUECAT_ENTITLEMENT_ID]);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  const value = useMemo(
    () => ({
      ready,
      isPro,
      refresh,
    }),
    [ready, isPro, refresh]
  );

  return (
    <PurchasesContext.Provider value={value}>
      {children}
    </PurchasesContext.Provider>
  );
}

export function usePurchasesEntitlement(): PurchasesContextValue {
  const ctx = useContext(PurchasesContext);
  if (!ctx) {
    throw new Error('usePurchasesEntitlement must be used within PurchasesProvider');
  }
  return ctx;
}
