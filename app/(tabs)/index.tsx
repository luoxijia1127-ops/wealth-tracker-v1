/**
 * DASHBOARD SCREEN
 * 重构版：高端时尚杂志拼贴风 (Editorial Collage)
 * 颜色随当前主题的 swatches 动态派生。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import type { TranslationKey } from '@/lib/language';
import {
  FREE_THEME_RUST_ORANGE,
  FREE_TIER_PALETTE_ID,
  type AppPaletteTheme,
} from '@/lib/app-palette';
import { canAddAnotherAsset } from '@/lib/asset-limit';
import { archiveAssetRecord, moveAssetToTrash } from '@/lib/asset-recycle';
import { getAssets } from '@/lib/asset-storage';
import {
  filterAssetsForDashboard,
  formatMoney,
  formatNetWorthSummary,
  getAssetCurrency,
  getAssetDisplayValue,
  isAssetHiddenFromDashboard,
  sumDisplayValuesInCurrency,
  sumDisplayValuesNaive
} from '@/lib/asset-value';
import { rgbaFromHex } from '@/lib/color-utils';
import { createDashboardStyles, type DashboardStyles } from '@/lib/dashboard-styles';
import {
  magazineBlocks,
  magazineStrongOnBlock,
} from '@/lib/editorial-reference-layout';
import { themeFinanceDeltaColor } from '@/lib/finance-colors';
import { numberSingleLineTextProps } from '@/lib/numeric-display-one-line';
import {
  ensureFxUsdRatesHistoryBackfill,
  type FxUsdMidRates,
} from '@/lib/fx-rates';
import {
  formatInsightsPnlParts,
  getDailyChangeInDisplay,
} from '@/lib/insights-model';
import { useAppStore } from '@/lib/store/app-store';
import {
  useAssets,
  useDisplayCurrency,
  useFxUsdRates,
  useHydrated,
  useSnapshots,
} from '@/lib/store/selectors';
import { FREE_ASSET_LIMIT } from '@/lib/subscription-constants';
import {
  ASSET_CATEGORY_ORDER,
  type AssetCategory,
  type SimpleAsset
} from '@/types/asset';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import * as ExpoStatusBar from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const CATEGORY_ORDER = ASSET_CATEGORY_ORDER;

/** 无资产时指向右上角「添加」的脉动箭头，风格与标题区 chevron 一致 */
function DashboardAddCoachArrows({ color, wrapStyle }: { color: string; wrapStyle: ViewStyle }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 680, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 680, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [pulse]);

  const trailStyle = useAnimatedStyle(() => ({
    opacity: 0.14 + pulse.value * 0.36,
    transform: [{ translateX: pulse.value * 9 - 5 }],
  }));
  const leadStyle = useAnimatedStyle(() => ({
    opacity: 0.38 + pulse.value * 0.52,
    transform: [{ translateX: pulse.value * 9 }],
  }));

  return (
    <View style={wrapStyle} pointerEvents="none">
      <Animated.View style={trailStyle}>
        <MaterialIcons name="chevron-right" size={22} color={color} />
      </Animated.View>
      <Animated.View style={[leadStyle, { marginLeft: -13 }]}>
        <MaterialIcons name="chevron-right" size={25} color={color} />
      </Animated.View>
    </View>
  );
}

/**
 * 把被隐藏的资产归档；mutation 走 saveAssets，store 会通过 listener 自动同步。
 * 保留为非阻塞调用即可，无需返回值。
 */
async function archiveHiddenAssetsIfAny(): Promise<void> {
  const list = await getAssets();
  const hidden = list.filter(isAssetHiddenFromDashboard);
  if (hidden.length === 0) return;
  for (const a of hidden) {
    try {
      await archiveAssetRecord(a);
    } catch {
      // ignore single failure
    }
  }
}

const CATEGORY_ROW_ICONS: Record<AssetCategory, keyof typeof MaterialIcons.glyphMap> = {
  Stock: 'show-chart',
  Fund: 'pie-chart-outline',
  ETF: 'layers',
  Cash: 'payments',
  Gold: 'star-outline',
  Custom: 'category',
};

function groupByCategory(assets: SimpleAsset[]): Record<string, SimpleAsset[]> {
  const grouped: Record<string, SimpleAsset[]> = {};
  for (const asset of assets) {
    const cat = asset.category ?? 'Cash';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(asset);
  }
  return grouped;
}

function categoryNamesSubtitle(assets: SimpleAsset[]): string {
  if (assets.length === 0) return '';
  const names = assets.map((a) => a.name.trim()).filter((n) => n.length > 0);
  const max = 3;
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} ...`;
}

function AssetPrimaryValue({
  amount,
  currency,
  accentColor,
  styles,
  hero,
}: {
  amount: number;
  currency: string;
  accentColor: string;
  styles: DashboardStyles;
  hero?: boolean;
}) {
  if (currency === 'CNY' && Number.isFinite(amount)) {
    const [intRaw, dec = '00'] = amount.toFixed(2).split('.');
    const intFmt = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const intSt = hero ? styles.totalValueInt : styles.categoryAmount;
    const decSt = hero ? styles.totalValueDec : { fontSize: 16, fontWeight: '600' as const, paddingTop: 9, letterSpacing: -0.4 };
    /** 整数 ≥7 位时略降最小字号，尽量整段「¥ + 千分位 + 小数」单行放下 */
    const intLen = intRaw.length;
    const intMinScale = hero
      ? intLen >= 7
        ? 0.22
        : intLen >= 6
          ? 0.26
          : 0.3
      : intLen >= 7
        ? 0.32
        : intLen >= 6
          ? 0.38
          : 0.44;

    /** 单层嵌套 Text：整段「¥整数.小数」一起参与 adjustsFontSizeToFit；占满可用宽便于缩字不切尾 */
    return (
      <Text
        {...numberSingleLineTextProps}
        minimumFontScale={intMinScale}
        style={{ width: '100%', textAlign: 'right' }}
      >
        <Text style={[intSt, { color: accentColor }]}>¥{intFmt}</Text>
        <Text style={[decSt, { color: accentColor }]}>.{dec}</Text>
      </Text>
    );
  }
  return (
    <Text
      {...numberSingleLineTextProps}
      style={[hero ? styles.totalValueForeign : styles.categoryAmount, { color: accentColor }]}
    >
      {formatMoney(amount, currency)}
    </Text>
  );
}

function DashboardHeroUpperHalf({
  insets,
  styles,
  theme,
  blocks,
  netWorthDisplay,
  displayCurrency,
  netWorthSummary,
  dailyChange,
  onPressAdd,
  addLabel,
  todayChangeLabel,
  totalValueLabel,
  showAddCoachmark,
  addCoachAccessibilityHint,
  addCoachArrowColor,
}: {
  insets: { top: number; right: number; left: number; bottom: number };
  styles: DashboardStyles;
  theme: AppPaletteTheme;
  blocks: ReturnType<typeof magazineBlocks>;
  netWorthDisplay: number | null;
  displayCurrency: string;
  netWorthSummary: { lines: string; hasMultiple: boolean };
  dailyChange: { diff: number; pct: number } | null;
  onPressAdd: () => void | Promise<void>;
  addLabel: string;
  todayChangeLabel: string;
  totalValueLabel: string;
  showAddCoachmark: boolean;
  addCoachAccessibilityHint: string;
  addCoachArrowColor: string;
}) {
  const mastheadInk = magazineStrongOnBlock(theme);
  const showMultiBand = netWorthSummary.hasMultiple;

  const { pctText } = formatInsightsPnlParts(
    dailyChange?.diff ?? 0,
    dailyChange?.pct ?? 0,
    displayCurrency
  );

  const deltaZeroColor = rgbaFromHex(mastheadInk, 0.55);
  const deltaColor =
    dailyChange !== null
      ? themeFinanceDeltaColor(
          dailyChange.pct,
          theme.statusPositive,
          theme.statusNegative,
          deltaZeroColor
        )
      : deltaZeroColor;

  const breakdownParts = netWorthSummary.lines.split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <View style={styles.heroStage}>
      {/* 紫色块最底；黄色块叠在上面；文字层最顶（见 dashboard-styles zIndex） */}
      <View style={[styles.heroBlueTopBlock, { backgroundColor: blocks.blockB }]} />
      <View style={[styles.heroMastheadYellowBg, { backgroundColor: blocks.blockA }]} />
      <View style={[styles.heroMastheadTextLayer, { paddingTop: insets.top + 24 }]}>
        <View style={styles.mastheadTitleRow}>
          <View style={styles.mastheadTitleFill}>
            <Text
              style={[styles.masthead, { color: mastheadInk }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              Dashboard
            </Text>
          </View>
          <View style={styles.mastheadAddCluster}>
            {showAddCoachmark ? (
              <DashboardAddCoachArrows color={addCoachArrowColor} wrapStyle={styles.mastheadAddCoachArrows} />
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.heroAddFabOuter, pressed && styles.headerAddFabPressed]}
              onPress={() => void onPressAdd()}
              accessibilityLabel={addLabel}
              accessibilityHint={showAddCoachmark ? addCoachAccessibilityHint : undefined}
              hitSlop={8}
            >
              <View style={styles.heroAddFabHalo}>
                <MaterialIcons name="add" size={26} color={mastheadInk} />
              </View>
            </Pressable>
          </View>
        </View>
        <Text style={[styles.kicker, { color: mastheadInk }]}>PORTFOLIO SUMMARY</Text>
      </View>

      <View style={[styles.heroChangeBlock, { backgroundColor: blocks.blockB }]} />

      <View style={[styles.heroTotalBlock, { backgroundColor: blocks.blockA }]}>
        <Pressable 
          onPress={() => router.push('/settings-attribution')}
          style={{ alignItems: 'flex-end', marginBottom: 8 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 0 }}>
            <Text style={[styles.totalValueInt, { color: deltaColor }]} numberOfLines={1} adjustsFontSizeToFit>
              {pctText}
            </Text>
            <MaterialIcons name="chevron-right" size={28} color={deltaColor} style={{ marginLeft: 2, marginBottom: 2 }} />
          </View>
          <Text style={[styles.metricLabel, { color: mastheadInk, marginTop: 2 }]}>
            {todayChangeLabel}
          </Text>
        </Pressable>
        
        {netWorthDisplay !== null && Number.isFinite(netWorthDisplay) ? (
          <AssetPrimaryValue amount={netWorthDisplay} currency={displayCurrency} accentColor={mastheadInk} styles={styles} hero />
        ) : (
          <Text style={[styles.totalValueForeign, { color: mastheadInk }]} numberOfLines={1} adjustsFontSizeToFit>
            {netWorthSummary.lines}
          </Text>
        )}
        <Text style={[styles.metricLabel, { color: mastheadInk }]}>
          {totalValueLabel}
        </Text>
        {showMultiBand ? (
          <View style={styles.heroCurrencyBreakdownRow}>
            {breakdownParts.flatMap((part, i) => {
              const dotColor = rgbaFromHex(mastheadInk, 0.42);
              const partColor = rgbaFromHex(mastheadInk, 0.78);
              const row: React.ReactElement[] = [];
              if (i > 0) {
                row.push(
                  <Text key={`dot-${i}`} style={[styles.heroCurrencyBreakdownDot, { color: dotColor }]}>
                    {' · '}
                  </Text>
                );
              }
              row.push(
                <Text
                  key={`part-${i}`}
                  style={[styles.magHeroCurrencyInline, { color: partColor }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {part}
                </Text>
              );
              return row;
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function CategoryCollageRow({
  category,
  assets,
  displayCurrency,
  fxUsdRates,
  blocks,
  styles,
  theme,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  category: string;
  assets: SimpleAsset[];
  displayCurrency: string;
  fxUsdRates: any;
  blocks: ReturnType<typeof magazineBlocks>;
  styles: DashboardStyles;
  theme: AppPaletteTheme;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (asset: SimpleAsset) => void;
  onDelete: (asset: SimpleAsset) => void;
}) {
  const { t } = useLanguage();
  const catUnified = sumDisplayValuesInCurrency(assets, displayCurrency, fxUsdRates);
  const subtitle = categoryNamesSubtitle(assets);

  const mastheadInk = magazineStrongOnBlock(theme);
  const accent = theme.categoryAccents[category as AssetCategory] ?? theme.primary;
  
  // Collage layout logic: introduce irregular positioning based on index
  const index = CATEGORY_ORDER.indexOf(category as AssetCategory);
  
  // Use category accent for subtle color differences between rows
  const rowBgColor = index % 2 === 0 ? rgbaFromHex(accent, 0.06) : 'transparent';
  const iconBgColor = index % 2 !== 0 ? rgbaFromHex(accent, 0.12) : 'transparent';
  const mainBgColor = index % 3 === 1 ? rgbaFromHex(accent, 0.04) : 'transparent';
  const deltaBgColor = index % 3 === 2 ? rgbaFromHex(accent, 0.08) : 'transparent';

  return (
    <View style={{ marginBottom: 0 }}>
      <Pressable
        style={({ pressed }) => [
          styles.categoryRowPressable, 
          pressed && styles.categoryRowPressed
        ]}
        onPress={onToggle}
      >
        <View style={[styles.categoryIconCell, { backgroundColor: iconBgColor }]}>
          <MaterialIcons name={CATEGORY_ROW_ICONS[category as AssetCategory] ?? 'folder'} size={26} color={mastheadInk} />
        </View>

        <View style={[styles.categoryMainCell, { backgroundColor: mainBgColor || rowBgColor }]}>
          <Text style={[styles.categoryName, { color: mastheadInk }]}>
            {t(`asset.categoryPlural.${category}` as TranslationKey)}
          </Text>
          {subtitle ? (
            <Text style={[styles.categoryMeta, { color: rgbaFromHex(mastheadInk, 0.6) }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={[styles.categoryDeltaCell, { backgroundColor: deltaBgColor || rowBgColor }]}>
          {catUnified !== null && Number.isFinite(catUnified) ? (
            <AssetPrimaryValue amount={catUnified} currency={displayCurrency} accentColor={mastheadInk} styles={styles} />
          ) : (
            <Text style={[styles.categoryAmount, { color: mastheadInk }]}>{formatNetWorthSummary(assets).lines}</Text>
          )}
        </View>
      </Pressable>

      {isExpanded ? (
        <View style={{ flexDirection: 'row', backgroundColor: mainBgColor || rowBgColor }}>
          <View style={{ width: '15%' }} />
          <View style={styles.assetListContainer}>
            {assets.map((a, i) => {
              const cur = getAssetCurrency(a);
              const amt = getAssetDisplayValue(a);
              const isLast = i === assets.length - 1;
              return (
                <Pressable
                  key={a.id}
                  style={({ pressed }) => [
                    styles.assetRow, 
                    pressed && styles.assetRowPressed,
                    { borderBottomColor: isLast ? 'transparent' : rgbaFromHex(mastheadInk, 0.08) }
                  ]}
                  onPress={() => onEdit(a)}
                  onLongPress={() => onDelete(a)}
                >
                  <View style={{ width: 3, height: 14, backgroundColor: accent, marginRight: 12, opacity: 0.8 }} />
                  <View style={styles.assetRowMiddleCol}>
                    <Text style={[styles.assetName, { color: mastheadInk }]}>{a.name}</Text>
                    {(a.account?.trim() || (typeof a.shares === 'number' && a.shares > 0)) ? (
                      <Text style={[styles.assetHoldings, { color: rgbaFromHex(mastheadInk, 0.5) }]}>
                        {[
                          a.account?.trim(), 
                          (typeof a.shares === 'number' && a.shares > 0)
                            ? `${a.shares} ${t('dashboard.shareUnit')}`
                            : null
                        ].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.assetRowRightCol}>
                    <Text
                      {...numberSingleLineTextProps}
                      style={[styles.assetValue, { color: mastheadInk }]}
                    >
                      {formatMoney(amt, cur)}
                    </Text>
                    {a.markPriceDate ? (
                      <Text style={[styles.assetQuoteDate, { color: rgbaFromHex(mastheadInk, 0.4) }]}>{a.markPriceDate}</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function Dashboard() {
  const { theme, appearance, paletteId } = useAppPalette();
  const { t } = useLanguage();
  const styles = useMemo(() => createDashboardStyles(theme), [theme]);

  const addCoachArrowColor = useMemo(
    () =>
      paletteId === FREE_TIER_PALETTE_ID ? FREE_THEME_RUST_ORANGE : theme.purposeAccent,
    [paletteId, theme.purposeAccent]
  );

  const handlePressAdd = useCallback(async () => {
    const gate = await canAddAnotherAsset();
    if (!gate.allowed) {
      Alert.alert(t('dashboard.limitTitle'), t('dashboard.limitMessage', { limit: FREE_ASSET_LIMIT }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('dashboard.learnSubscription'), onPress: () => router.push('/paywall') },
      ]);
      return;
    }
    router.push({ pathname: '/modal', params: {} });
  }, [t]);

  const blocks = useMemo(() => magazineBlocks(theme), [theme]);
  const insets = useSafeAreaInsets();

  const hydrated = useHydrated();
  const assets = useAssets();
  const snapshots = useSnapshots();
  const displayCurrency = useDisplayCurrency();
  const fxUsdRatesCached = useFxUsdRates();
  const fxUsdRates = useMemo<FxUsdMidRates['rates'] | null>(
    () => fxUsdRatesCached?.rates ?? null,
    [fxUsdRatesCached]
  );
  /** 后台 sync 不驱动 RefreshControl，避免未下拉时出现大块加载区与手势异常（与洞察页一致） */
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const pullRefreshGuard = useRef(false);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set());
  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const handleEditAsset = useCallback((asset: SimpleAsset) => {
    router.push({ pathname: '/asset-action', params: { id: asset.id } });
  }, []);

  const handleDeleteAsset = useCallback(
    (asset: SimpleAsset) => {
      Alert.alert(
        t('asset.form.deleteTitle'),
        t('asset.form.deleteMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('asset.form.deleteTitle'),
            style: 'destructive',
            onPress: () => {
              /** moveAssetToTrash 内部 saveAssets，listener 自动通知 store */
              void moveAssetToTrash(asset.id);
            },
          },
        ]
      );
    },
    [t]
  );

  const refreshMarketData = useCallback(async () => {
    if (pullRefreshGuard.current) return;
    pullRefreshGuard.current = true;
    setPullRefreshing(true);
    try {
      /** 强制刷新（绕节流）；archive 后 listener 自动通知 store */
      await useAppStore.getState().syncNetWorthFromMarket();
      await archiveHiddenAssetsIfAny();
    } finally {
      setPullRefreshing(false);
      pullRefreshGuard.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      ExpoStatusBar.setStatusBarStyle(appearance === 'dark' ? 'light' : 'dark');
      return () => ExpoStatusBar.setStatusBarStyle('auto');
    }, [appearance])
  );

  useFocusEffect(
    useCallback(() => {
      void ensureFxUsdRatesHistoryBackfill();
      void archiveHiddenAssetsIfAny();
      return undefined;
    }, [])
  );

  const dashboardAssets = useMemo(() => filterAssetsForDashboard(assets), [assets]);
  const grouped = useMemo(() => groupByCategory(dashboardAssets), [dashboardAssets]);
  const netWorthSummary = useMemo(() => formatNetWorthSummary(dashboardAssets), [dashboardAssets]);
  const dailyChange = useMemo(() => getDailyChangeInDisplay(snapshots, displayCurrency, fxUsdRates), [snapshots, displayCurrency, fxUsdRates]);

  const netWorthDisplay = useMemo<number | null>(() => {
    const unified = sumDisplayValuesInCurrency(dashboardAssets, displayCurrency, fxUsdRates);
    if (unified !== null) return unified;
    const needsFx = dashboardAssets.some((a) => getAssetCurrency(a) !== displayCurrency);
    if (!needsFx) return sumDisplayValuesNaive(dashboardAssets);
    return null;
  }, [dashboardAssets, displayCurrency, fxUsdRates]);

  if (!hydrated) {
    return (
      <View style={styles.screenWrapper}>
        <View style={styles.dashboardAmbient} pointerEvents="none" />
        <View style={[styles.container, styles.centered, { flex: 1 }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screenWrapper}>
      <View style={styles.dashboardAmbient} pointerEvents="none" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32, flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={() => void refreshMarketData()}
            tintColor={theme.primary}
            title={Platform.OS === 'ios' ? t('common.loading') : undefined}
            titleColor={rgbaFromHex(theme.primary, 0.55)}
            colors={[theme.primary]}
            progressBackgroundColor={
              appearance === 'dark' ? 'rgba(32,32,38,0.98)' : '#ffffff'
            }
          />
        }
      >
        <DashboardHeroUpperHalf
          insets={insets}
          styles={styles}
          theme={theme}
          blocks={blocks}
          netWorthDisplay={netWorthDisplay}
          displayCurrency={displayCurrency}
          netWorthSummary={netWorthSummary}
          dailyChange={dailyChange}
          onPressAdd={handlePressAdd}
          addLabel={t('dashboard.addAsset')}
          todayChangeLabel={t('dashboard.todayChange')}
          totalValueLabel={t('dashboard.totalValue')}
          showAddCoachmark={dashboardAssets.length === 0}
          addCoachAccessibilityHint={t('dashboard.addAssetCoachHint')}
          addCoachArrowColor={addCoachArrowColor}
        />
        
        <View style={styles.groupsContainer}>
          {dashboardAssets.length === 0 ? (
            <Text style={styles.emptyCategoryText}>
              {t('dashboard.empty.subtitle')}
            </Text>
          ) : (
            CATEGORY_ORDER.map((category) => {
              const list = grouped[category];
              if (!list || list.length === 0) return null;
              return (
                <CategoryCollageRow
                  key={category}
                  category={category}
                  assets={list}
                  displayCurrency={displayCurrency}
                  fxUsdRates={fxUsdRates}
                  blocks={blocks}
                  styles={styles}
                  theme={theme}
                  isExpanded={expandedCategories.has(category)}
                  onToggle={() => toggleCategory(category)}
                  onEdit={handleEditAsset}
                  onDelete={handleDeleteAsset}
                />
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
