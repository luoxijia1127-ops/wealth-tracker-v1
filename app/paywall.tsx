/**
 * 订阅：RevenueCat Offerings — 海报风对比圆 + 横向套餐 + 继续（主题随 palette）
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { usePurchasesEntitlement } from '@/contexts/purchases-context';
import { AppFont } from '@/lib/app-fonts';
import { pickTextOnAccent, rgbaFromHex } from '@/lib/color-utils';
import { getPrivacyPolicyUrlForLocale } from '@/lib/privacy-policy-url';
import { paywallLoadErrorTranslationKey } from '@/lib/paywall-load-error';
import { isRevenueCatConfigured } from '@/lib/revenuecat';
import { FREE_ASSET_LIMIT } from '@/lib/subscription-constants';
import { getTermsOfServiceUrlForLocale } from '@/lib/terms-of-service-url';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Purchases, { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import type { Translate } from '@/lib/language';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PKG_SORT_ORDER: Partial<Record<PACKAGE_TYPE, number>> = {
  [PACKAGE_TYPE.WEEKLY]: 1,
  [PACKAGE_TYPE.MONTHLY]: 2,
  [PACKAGE_TYPE.TWO_MONTH]: 3,
  [PACKAGE_TYPE.THREE_MONTH]: 4,
  [PACKAGE_TYPE.SIX_MONTH]: 5,
  [PACKAGE_TYPE.ANNUAL]: 6,
  [PACKAGE_TYPE.LIFETIME]: 7,
};

function sortPackages(pkgs: PurchasesPackage[]): PurchasesPackage[] {
  return [...pkgs].sort(
    (a, b) =>
      (PKG_SORT_ORDER[a.packageType] ?? 99) - (PKG_SORT_ORDER[b.packageType] ?? 99)
  );
}

function preferredPackageId(pkgs: PurchasesPackage[]): string | null {
  if (pkgs.length === 0) return null;
  const annual = pkgs.find((p) => p.packageType === PACKAGE_TYPE.ANNUAL);
  if (annual) return annual.identifier;
  const monthly = pkgs.find((p) => p.packageType === PACKAGE_TYPE.MONTHLY);
  if (monthly) return monthly.identifier;
  const life = pkgs.find((p) => p.packageType === PACKAGE_TYPE.LIFETIME);
  if (life) return life.identifier;
  return pkgs[0]!.identifier;
}

function packageLabel(pkg: PurchasesPackage, t: Translate): string {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.ANNUAL:
      return t('paywall.yearly');
    case PACKAGE_TYPE.MONTHLY:
      return t('paywall.monthly');
    case PACKAGE_TYPE.LIFETIME:
      return t('paywall.lifetime');
    case PACKAGE_TYPE.WEEKLY:
      return t('paywall.monthly');
    default:
      return pkg.product.title || pkg.identifier;
  }
}

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { theme } = useAppPalette();
  const { t, locale } = useLanguage();
  const { refresh } = usePurchasesEntitlement();

  const secondary = rgbaFromHex(theme.primary, 0.72);
  const muted = rgbaFromHex(theme.primary, 0.5);
  const privacyUrl = useMemo(() => getPrivacyPolicyUrlForLocale(locale), [locale]);
  const termsUrl = useMemo(() => getTermsOfServiceUrlForLocale(locale), [locale]);

  const heroTint = rgbaFromHex(theme.primary, 0.12);
  const proCircleBg = theme.swatches[2] ?? theme.statusPositive;
  const freeCircleBg = theme.swatches[1] ?? rgbaFromHex(theme.primary, 0.42);
  const proInk = pickTextOnAccent(proCircleBg);
  const freeInk = pickTextOnAccent(freeCircleBg);
  const ctaBg = theme.ctaPillBg ?? theme.primary;
  const ctaInk = pickTextOnAccent(ctaBg);

  const pad = 20;
  const usableW = width - pad * 2;
  /** 左侧会员大圆：显著大于右侧免费圆 */
  const bigD = Math.min(usableW * 1.06 + 8, 312);
  const smallD = bigD * 0.52;
  const heroMinH = bigD * 0.78 + smallD * 0.28;

  const openLegal = useCallback(
    async (url: string | null, fallbackHint: string) => {
      if (!url) {
        Alert.alert(fallbackHint);
        return;
      }
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch {
        try {
          await Linking.openURL(url);
        } catch {
          Alert.alert(fallbackHint);
        }
      }
    },
    []
  );

  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (Platform.OS === 'web') {
      setHint(t('paywall.nativeOnly'));
      setPackages([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }
    if (!isRevenueCatConfigured()) {
      setHint(t('paywall.notConfigured'));
      setPackages([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }
    setHint(null);
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      const list = sortPackages(current?.availablePackages ?? []);
      setPackages(list);
      setSelectedId(preferredPackageId(list));
      if (!list.length) {
        setHint(t('paywall.noPackages'));
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (__DEV__) {
        console.warn('[paywall] getOfferings failed:', raw);
      }
      const mapped = paywallLoadErrorTranslationKey(raw);
      setHint(mapped ? t(mapped) : t('paywall.loadFailed'));
      setPackages([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedPkg = useMemo(
    () => packages.find((p) => p.identifier === selectedId) ?? null,
    [packages, selectedId]
  );

  /** 1–3 个套餐：与外层 pad 对齐的可用宽度内等分、占满一行；>3 时保持可横向滑动 */
  const planGap = 10;
  const rowInnerW = width - pad * 2;
  const compactPlanRow = !loading && packages.length > 0 && packages.length <= 3;
  const equalPlanPillWidth = compactPlanRow
    ? (rowInnerW - planGap * (packages.length - 1)) / packages.length
    : null;

  const featureKeys = useMemo(
    () =>
      ['paywall.feature1', 'paywall.feature2', 'paywall.feature3', 'paywall.feature4'] as const,
    []
  );

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
      Alert.alert(
        t('paywall.restoreFailedTitle'),
        e instanceof Error ? e.message : t('paywall.tryLater')
      );
    } finally {
      setLoading(false);
    }
  };

  const onContinue = () => {
    if (!selectedPkg || purchasingId) return;
    void onPurchase(selectedPkg);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.pageBg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: pad,
            paddingBottom: 14,
            backgroundColor: heroTint,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              marginBottom: 6,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('paywall.closeA11y')}
              hitSlop={12}
              onPress={() => router.back()}
              style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1, padding: 4 })}
            >
              <Ionicons name="close" size={28} color={theme.primary} />
            </Pressable>
          </View>

          <Text
            style={{
              fontFamily: AppFont.extraBold,
              fontSize: 26,
              fontWeight: '800',
              color: theme.primary,
              letterSpacing: -0.5,
              marginBottom: 4,
            }}
          >
            {t('paywall.heroKicker')}
          </Text>
          <Text
            style={{
              fontFamily: AppFont.medium,
              fontSize: 15,
              lineHeight: 21,
              color: secondary,
              marginBottom: 18,
            }}
          >
            {t('paywall.heroSubtitle')}
          </Text>

          <View style={{ minHeight: heroMinH, marginBottom: 0 }}>
            <View
              style={{
                position: 'absolute',
                left: -bigD * 0.05,
                top: 0,
                width: bigD,
                height: bigD,
                borderRadius: bigD / 2,
                backgroundColor: proCircleBg,
                paddingLeft: 52,
                paddingRight: bigD * 0.31,
                paddingTop: bigD * 0.2,
                paddingBottom: 40,
                justifyContent: 'space-between',
              }}
            >
              <View style={{ gap: 8 }}>
                {featureKeys.map((key) => (
                  <View
                    key={key}
                    style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
                  >
                    <MaterialIcons name="check-circle" size={17} color={proInk} style={{ opacity: 0.92 }} />
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: AppFont.semiBold,
                        fontSize: 14,
                        lineHeight: 19,
                        fontWeight: '600',
                        color: proInk,
                      }}
                    >
                      {t(key)}
                    </Text>
                  </View>
                ))}
              </View>
              <View>
                <Text
                  style={{
                    fontFamily: AppFont.extraBold,
                    fontSize: 44,
                    fontWeight: '900',
                    color: proInk,
                    letterSpacing: -2,
                  }}
                >
                  {t('paywall.compareProPercent')}
                </Text>
                <Text
                  style={{
                    fontFamily: AppFont.semiBold,
                    fontSize: 13,
                    fontWeight: '600',
                    color: proInk,
                    opacity: 0.85,
                  }}
                >
                  {t('paywall.compareProCaption')}
                </Text>
              </View>
            </View>

            <View
              style={{
                position: 'absolute',
                right: 0,
                top: bigD * 0.12,
                width: smallD,
                height: smallD,
                borderRadius: smallD / 2,
                backgroundColor: freeCircleBg,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 12,
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: AppFont.bold,
                  fontSize: 14,
                  fontWeight: '700',
                  color: freeInk,
                  opacity: 0.9,
                }}
              >
                {t('paywall.compareFreeTitle')}
              </Text>
              <Text
                style={{
                  fontFamily: AppFont.extraBold,
                  fontSize: 23,
                  fontWeight: '900',
                  color: freeInk,
                  letterSpacing: -0.6,
                }}
              >
                {t('paywall.compareFreeLimitLine', { limit: FREE_ASSET_LIMIT })}
              </Text>
              <Text
                style={{
                  fontFamily: AppFont.semiBold,
                  fontSize: 11,
                  fontWeight: '600',
                  color: freeInk,
                  opacity: 0.78,
                  textAlign: 'center',
                }}
              >
                {t('paywall.compareFreeHint')}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: pad, paddingTop: 22 }}>
          <Text
            style={{
              fontFamily: AppFont.bold,
              fontSize: 15,
              fontWeight: '700',
              color: theme.primary,
              marginBottom: 12,
            }}
          >
            {t('paywall.selectPlanHint')}
          </Text>

          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 20 }} />
          ) : null}

          {hint ? (
            <Text style={{ fontSize: 14, lineHeight: 21, color: muted, marginBottom: 12 }}>
              {hint}
            </Text>
          ) : null}

          {!loading && packages.length === 0 ? (
            <Pressable
              onPress={() => {
                setLoading(true);
                setHint(null);
                void load();
              }}
              style={({ pressed }) => ({
                alignSelf: 'flex-start',
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: rgbaFromHex(theme.primary, 0.14),
                marginBottom: 14,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.primary }}>
                {t('paywall.retry')}
              </Text>
            </Pressable>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              {
                flexDirection: 'row',
                alignItems: 'stretch',
                gap: planGap,
                paddingVertical: 4,
              },
              compactPlanRow
                ? { flexGrow: 1, minWidth: rowInnerW, justifyContent: 'flex-start' as const }
                : { paddingHorizontal: 8 },
            ]}
          >
            {packages.map((pkg) => {
              const selected = pkg.identifier === selectedId;
              const isLifetime = pkg.packageType === PACKAGE_TYPE.LIFETIME;
              const pillBg = selected ? theme.primary : rgbaFromHex(theme.primary, 0.1);
              const pillInk = selected ? pickTextOnAccent(theme.primary) : theme.primary;
              const subInk = selected ? pickTextOnAccent(theme.primary) : secondary;
              return (
                <Pressable
                  key={pkg.identifier}
                  onPress={() => setSelectedId(pkg.identifier)}
                  disabled={!!purchasingId}
                  style={({ pressed }) => ({
                    ...(equalPlanPillWidth != null
                      ? { width: equalPlanPillWidth }
                      : { minWidth: width * 0.26, maxWidth: width * 0.34 }),
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: pillBg,
                    borderWidth: selected ? 0 : StyleSheet.hairlineWidth,
                    borderColor: rgbaFromHex(theme.primary, 0.22),
                    opacity: pressed ? 0.88 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: AppFont.bold,
                      fontSize: 14,
                      fontWeight: '700',
                      color: pillInk,
                      textAlign: 'center',
                    }}
                    numberOfLines={1}
                  >
                    {packageLabel(pkg, t)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: AppFont.semiBold,
                      fontSize: 15,
                      fontWeight: '700',
                      color: subInk,
                      textAlign: 'center',
                      marginTop: 6,
                    }}
                    numberOfLines={2}
                  >
                    {pkg.product.priceString}
                  </Text>
                  {isLifetime ? (
                    <Text
                      style={{
                        fontFamily: AppFont.medium,
                        fontSize: 10,
                        color: subInk,
                        opacity: 0.85,
                        textAlign: 'center',
                        marginTop: 4,
                      }}
                      numberOfLines={2}
                    >
                      {t('paywall.lifetimeOneTime')}
                    </Text>
                  ) : (
                    <Text
                      style={{
                        fontFamily: AppFont.medium,
                        fontSize: 10,
                        color: subInk,
                        opacity: 0.8,
                        textAlign: 'center',
                        marginTop: 4,
                      }}
                      numberOfLines={1}
                    >
                      {t('paywall.autoRenew')}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={onContinue}
            disabled={!selectedPkg || !!purchasingId || loading}
            style={({ pressed }) => ({
              marginTop: 22,
              paddingVertical: 16,
              borderRadius: 16,
              backgroundColor: ctaBg,
              alignItems: 'center',
              opacity:
                !selectedPkg || purchasingId || loading ? 0.45 : pressed ? 0.9 : 1,
            })}
          >
            {purchasingId ? (
              <ActivityIndicator color={ctaInk} />
            ) : (
              <Text
                style={{
                  fontFamily: AppFont.bold,
                  fontSize: 17,
                  fontWeight: '800',
                  color: ctaInk,
                }}
              >
                {t('paywall.continue')}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => void onRestore()}
            disabled={loading || Platform.OS === 'web'}
            style={{ marginTop: 14, paddingVertical: 10, alignItems: 'center' }}
          >
            <Text
              style={{
                fontSize: 14,
                color: theme.primary,
                textDecorationLine: 'underline',
                fontFamily: AppFont.semiBold,
                fontWeight: '600',
              }}
            >
              {t('paywall.restore')}
            </Text>
          </Pressable>

          <Text
            style={{
              fontSize: 11,
              lineHeight: 17,
              color: muted,
              marginTop: 16,
              fontFamily: AppFont.regular,
            }}
          >
            {t('paywall.footer')}
          </Text>

          <View
            style={{
              marginTop: 12,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 14,
            }}
          >
            <Pressable
              onPress={() => void openLegal(privacyUrl, t('paywall.linkUnavailable'))}
              hitSlop={8}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: theme.primary,
                  textDecorationLine: 'underline',
                  fontFamily: AppFont.semiBold,
                  fontWeight: '600',
                }}
              >
                {t('paywall.privacy')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void openLegal(termsUrl, t('paywall.linkUnavailable'))}
              hitSlop={8}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: theme.primary,
                  textDecorationLine: 'underline',
                  fontFamily: AppFont.semiBold,
                  fontWeight: '600',
                }}
              >
                {t('paywall.serviceAgreement')}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
