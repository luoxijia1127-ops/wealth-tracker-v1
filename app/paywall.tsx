/**
 * 订阅：RevenueCat Offerings + 恢复购买
 */

import { useAppPalette } from '@/contexts/app-palette-context';
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
  const { refresh } = usePurchasesEntitlement();
  const secondary = rgbaFromHex(theme.primary, 0.68);
  const muted = rgbaFromHex(theme.primary, 0.52);

  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (Platform.OS === 'web') {
      setHint('订阅需在 iOS 或 Android 应用内完成。');
      setPackages([]);
      setLoading(false);
      return;
    }
    if (!isRevenueCatConfigured()) {
      setHint(
        '未配置 RevenueCat（缺少 EXPO_PUBLIC_REVENUECAT_IOS_API_KEY）。请在 .env 中填写并在 RevenueCat / App Store Connect 中配置商品后重试。'
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
          '暂无可用订阅套餐。请在 RevenueCat 控制台将 Offering 关联 App Store 订阅商品。'
        );
      }
    } catch (e) {
      setHint(e instanceof Error ? e.message : '加载订阅信息失败');
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onPurchase = async (pkg: PurchasesPackage) => {
    if (Platform.OS === 'web') return;
    setPurchasingId(pkg.identifier);
    try {
      await Purchases.purchasePackage(pkg);
      await refresh();
      Alert.alert('订阅成功', '已解锁全部资产数量。', [
        { text: '好的', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (err.userCancelled) return;
      Alert.alert('购买未完成', err.message ?? '请稍后重试');
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
      Alert.alert('已恢复购买', '若您曾订阅，权益应已生效。');
    } catch (e) {
      Alert.alert('恢复失败', e instanceof Error ? e.message : '请稍后重试');
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
        Nest 会员
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: secondary, marginBottom: 20 }}>
        免费版可在主列表添加最多 {FREE_ASSET_LIMIT}{' '}
        个资产；订阅后不限数量。行情、洞察等功能对所有用户开放。
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
            {pkg.storeProduct.title}
          </Text>
          <Text style={{ fontSize: 15, color: secondary, marginTop: 4 }}>
            {pkg.storeProduct.priceString}
            {' · 自动续订'}
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
          恢复购买
        </Text>
      </Pressable>

      <Text style={{ fontSize: 12, lineHeight: 18, color: muted, marginTop: 20 }}>
        订阅将通过 Apple ID 计费，可在系统设置中管理或取消。购买前请阅读 App Store 上的产品说明。
      </Text>
    </ScrollView>
  );
}
