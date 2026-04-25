/**
 * DASHBOARD SCREEN
 * 重构版：高端时尚杂志拼贴风 (Editorial Collage)
 * 颜色随当前主题的 swatches 动态派生。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import type { AppPaletteTheme } from '@/lib/app-palette';
import { canAddAnotherAsset } from '@/lib/asset-limit';
import { archiveAssetRecord } from '@/lib/asset-recycle';
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
import { loadDisplayCurrency } from '@/lib/display-currency-preference';
import {
  magazineBlocks,
  magazineStrongOnBlock,
} from '@/lib/editorial-reference-layout';
import { themeFinanceDeltaColor } from '@/lib/finance-colors';
import { numberSingleLineTextProps } from '@/lib/numeric-display-one-line';
import {
  ensureFxUsdRatesHistoryBackfill,
  getCachedFxUsdRates,
  type FxUsdMidRates,
} from '@/lib/fx-rates';
import {
  formatInsightsPnlParts,
  getDailyChangeInDisplay,
} from '@/lib/insights-model';
import { syncNetWorthFromMarket } from '@/lib/net-worth-sync';
import { getSnapshots, type Snapshot } from '@/lib/snapshots';
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
import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORY_ORDER = ASSET_CATEGORY_ORDER;

async function archiveHiddenAssetsIfAny(): Promise<SimpleAsset[]> {
  let list = await getAssets();
  const hidden = list.filter(isAssetHiddenFromDashboard);
  if (hidden.length === 0) return list;
  for (const a of hidden) {
    try {
      await archiveAssetRecord(a);
    } catch {
      // ignore single failure
    }
  }
  return getAssets();
}

function categoryTitle(cat: string): string {
  if (cat === 'Stock') return 'STOCKS';
  if (cat === 'Fund') return 'FUNDS';
  if (cat === 'ETF') return 'ETFS';
  if (cat === 'Cash') return 'CASH';
  if (cat === 'Gold') return 'GOLD';
  if (cat === 'Custom') return 'CUSTOM';
  return cat.toUpperCase();
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
          <Pressable
            style={({ pressed }) => [styles.heroAddFabOuter, pressed && styles.headerAddFabPressed]}
            onPress={() => void onPressAdd()}
            accessibilityLabel="添加资产"
            hitSlop={8}
          >
            <View style={styles.heroAddFabHalo}>
              <MaterialIcons name="add" size={26} color={mastheadInk} />
            </View>
          </Pressable>
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
          <Text style={[styles.metricLabel, { color: mastheadInk, marginTop: 2 }]}>TODAY'S CHANGE</Text>
        </Pressable>
        
        {netWorthDisplay !== null && Number.isFinite(netWorthDisplay) ? (
          <AssetPrimaryValue amount={netWorthDisplay} currency={displayCurrency} accentColor={mastheadInk} styles={styles} hero />
        ) : (
          <Text style={[styles.totalValueForeign, { color: mastheadInk }]} numberOfLines={1} adjustsFontSizeToFit>
            {netWorthSummary.lines}
          </Text>
        )}
        <Text style={[styles.metricLabel, { color: mastheadInk }]}>TOTAL VALUE</Text>
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
}) {
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
          <Text style={[styles.categoryName, { color: mastheadInk }]}>{categoryTitle(category)}</Text>
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
                >
                  <View style={{ width: 3, height: 14, backgroundColor: accent, marginRight: 12, opacity: 0.8 }} />
                  <View style={styles.assetRowMiddleCol}>
                    <Text style={[styles.assetName, { color: mastheadInk }]}>{a.name}</Text>
                    {(a.account?.trim() || (typeof a.shares === 'number' && a.shares > 0)) ? (
                      <Text style={[styles.assetHoldings, { color: rgbaFromHex(mastheadInk, 0.5) }]}>
                        {[
                          a.account?.trim(), 
                          (typeof a.shares === 'number' && a.shares > 0) ? `${a.shares} 份` : null
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
  const { theme, appearance } = useAppPalette();
  const styles = useMemo(() => createDashboardStyles(theme), [theme]);

  const handlePressAdd = useCallback(async () => {
    const gate = await canAddAnotherAsset();
    if (!gate.allowed) {
      Alert.alert('已达免费上限', `免费版最多添加 ${FREE_ASSET_LIMIT} 个资产。订阅后可继续添加。`, [
        { text: '取消', style: 'cancel' },
        { text: '了解订阅', onPress: () => router.push('/paywall') },
      ]);
      return;
    }
    router.push({ pathname: '/modal', params: {} });
  }, []);

  const blocks = useMemo(() => magazineBlocks(theme), [theme]);
  const insets = useSafeAreaInsets();
  
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingQuotes, setSyncingQuotes] = useState(false);
  const [netWorthDisplay, setNetWorthDisplay] = useState<number | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<string>('CNY');
  const [fxUsdRates, setFxUsdRates] = useState<FxUsdMidRates['rates'] | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const focusLoadGen = useRef(0);

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

  const refreshMarketData = useCallback(async () => {
    setSyncingQuotes(true);
    try {
      await syncNetWorthFromMarket();
      const cleaned = await archiveHiddenAssetsIfAny();
      setAssets(cleaned);
      const dc = await loadDisplayCurrency();
      setDisplayCurrency(dc);
      setSnapshots(await getSnapshots());
      const dash = filterAssetsForDashboard(cleaned);
      const needsFxDash = dash.some((a) => getAssetCurrency(a) !== dc);
      const cachedAfterSync = await getCachedFxUsdRates();
      setFxUsdRates(cachedAfterSync?.rates ?? null);
      const unified = sumDisplayValuesInCurrency(dash, dc, cachedAfterSync?.rates ?? null);
      if (unified !== null) setNetWorthDisplay(unified);
      else if (!needsFxDash) setNetWorthDisplay(sumDisplayValuesNaive(dash));
      else setNetWorthDisplay(null);
    } catch {
      /* ignore */
    } finally {
      setSyncingQuotes(false);
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
      const gen = ++focusLoadGen.current;
      let cancelled = false;
      (async () => {
        try {
          void ensureFxUsdRatesHistoryBackfill();
          const local = await archiveHiddenAssetsIfAny();
          if (!cancelled && gen === focusLoadGen.current) {
            setAssets(local);
            setLoading(false);
            const dc = await loadDisplayCurrency();
            setDisplayCurrency(dc);
            setSnapshots(await getSnapshots());
            const dash = filterAssetsForDashboard(local);
            const needsFx = dash.some((a) => getAssetCurrency(a) !== dc);
            const cached = await getCachedFxUsdRates();
            setFxUsdRates(cached?.rates ?? null);
            const unified = sumDisplayValuesInCurrency(dash, dc, cached?.rates ?? null);
            if (unified !== null) setNetWorthDisplay(unified);
            else if (!needsFx) setNetWorthDisplay(sumDisplayValuesNaive(dash));
            else setNetWorthDisplay(null);
          }
        } catch {
          if (!cancelled && gen === focusLoadGen.current) {
            setAssets([]);
            setLoading(false);
          }
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const dashboardAssets = useMemo(() => filterAssetsForDashboard(assets), [assets]);
  const grouped = useMemo(() => groupByCategory(dashboardAssets), [dashboardAssets]);
  const netWorthSummary = useMemo(() => formatNetWorthSummary(dashboardAssets), [dashboardAssets]);
  const dailyChange = useMemo(() => getDailyChangeInDisplay(snapshots, displayCurrency, fxUsdRates), [snapshots, displayCurrency, fxUsdRates]);

  if (loading) {
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
            refreshing={syncingQuotes}
            onRefresh={() => void refreshMarketData()}
            tintColor={theme.primary}
            title={Platform.OS === 'ios' ? '更新中…' : undefined}
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
        />
        
        <View style={styles.groupsContainer}>
          {dashboardAssets.length === 0 ? (
            <Text style={styles.emptyCategoryText}>暂无资产。点右上角「+」添加第一条资产。</Text>
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
                />
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
