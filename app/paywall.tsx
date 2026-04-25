/**
 * 订阅：RevenueCat Offerings + 恢复购买
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { usePurchasesEntitlement } from '@/contexts/purchases-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { isRevenueCatConfigured } from '@/lib/revenuecat';
import { FREE_ASSET_LIMIT } from '@/lib/subscription-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useAppPalette();
  const { t } = useLanguage();
  const { refresh } = usePurchasesEntitlement();
  const secondary = rgbaFromHex(theme.primary, 0.68);
  const muted = rgbaFromHex(theme.primary, 0.52);

  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (Platform.OS === 'web') {
      setHint(t('paywall.nativeOnly'));
      setPackages([]);
      setLoading(false);
      return;
    }
    if (!isRevenueCatConfigured()) {
      setHint(
        t('paywall.notConfigured')
      );
      setPackages([]);
      setLoading(false);
      return;
    }
    setHint(null);
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      setPackages(current?.availablePackages ?? []);
      if (!current?.availablePackages?.length) {
        setHint(
          t('paywall.noPackages')
        );
      }
    } catch (e) {
      setHint(e instanceof Error ? e.message : t('paywall.loadFailed'));
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPurchase = async (pkg: PurchasesPackage) => {
    if (Platform.OS === 'web') return;
    setPurchasingId(pkg.identifier);
    try {
      await Purchases.purchasePackage(pkg);
      await refresh();
      Alert.alert(t('paywall.successTitle'), t('paywall.successMessage'), [
        { text: t('paywall.ok'), onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (err.userCancelled) return;
      Alert.alert(t('paywall.cancelledTitle'), err.message ?? t('paywall.tryLater'));
    } finally {
      setPurchasingId(null);
    }
  };

  const onRestore = async () => {
    if (Platform.OS === 'web') return;
    setLoading(true);
    try {
      await Purchases.restorePurchases();
      await refresh();
      Alert.alert(t('paywall.restoreSuccessTitle'), t('paywall.restoreSuccessMessage'));
    } catch (e) {
      Alert.alert(t('paywall.restoreFailedTitle'), e instanceof Error ? e.message : t('paywall.tryLater'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 28,
        paddingHorizontal: 20,
      }}
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: '800',
          color: theme.primary,
          marginBottom: 8,
        }}
      >
        {t('paywall.member')}
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: secondary, marginBottom: 20 }}>
        {t('paywall.description', { limit: FREE_ASSET_LIMIT })}
      </Text>

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginVertical: 24 }} />
      ) : null}

      {hint ? (
        <Text style={{ fontSize: 14, lineHeight: 21, color: muted, marginBottom: 16 }}>
          {hint}
        </Text>
      ) : null}

      {packages.map((pkg) => (
        <Pressable
          key={pkg.identifier}
          onPress={() => void onPurchase(pkg)}
          disabled={!!purchasingId}
          style={({ pressed }) => ({
            paddingVertical: 16,
            paddingHorizontal: 18,
            borderRadius: 16,
            backgroundColor: rgbaFromHex(theme.primary, 0.12),
            marginBottom: 10,
            opacity: pressed || purchasingId ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: theme.primary }}>
            {pkg.product.title}
          </Text>
          <Text style={{ fontSize: 15, color: secondary, marginTop: 4 }}>
            {pkg.product.priceString}
            {` · ${t('paywall.autoRenew')}`}
          </Text>
          {purchasingId === pkg.identifier ? (
            <ActivityIndicator style={{ marginTop: 8 }} color={theme.primary} />
          ) : null}
        </Pressable>
      ))}

      <Pressable
        onPress={() => void onRestore()}
        disabled={loading || Platform.OS === 'web'}
        style={{ marginTop: 8, paddingVertical: 12 }}
      >
        <Text
          style={{
            fontSize: 15,
            color: theme.primary,
            textDecorationLine: 'underline',
            fontWeight: '600',
          }}
        >
          {t('paywall.restore')}
        </Text>
      </Pressable>

      <Text style={{ fontSize: 12, lineHeight: 18, color: muted, marginTop: 20 }}>
        {t('paywall.footer')}
      </Text>
    </ScrollView>
  );
}
