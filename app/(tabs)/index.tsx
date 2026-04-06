/**
 * DASHBOARD SCREEN
 * Merged view: Net Worth at top, then grouped asset structure (Category → Type → Assets).
 * Loads assets from AsyncStorage (key "assets"). Net Worth = sum of all asset values.
 *
 * Structure:
 * 1. Net Worth (large, centered)
 * 2. Grouped assets: 类别（股票/基金/ETF/类现金/贵金属）→ 资产列表
 *
 * 场内标的：份额 ×（markPrice 现价优先，否则 lastClose 日 K 结算）；下拉刷新拉行情并写快照；新增资产保存时会同步。
 * 其他资产：使用 value。顶部 Net Worth 以设置中的默认货币汇总（Frankfurter/ECB 口径 USD 串联）；副标题分行展示原币种市值。
 *
 * 浅色「文件夹」交互：大类默认只显示合计 + 资产名摘要；点击展开明细；展开时头部用类别色条填充。
 */

import { GlassSurface } from '@/components/glass-surface';
import { useAppPalette } from '@/contexts/app-palette-context';
import type { AppPaletteTheme } from '@/lib/app-palette';
import { canAddAnotherAsset } from '@/lib/asset-limit';
import { moveAssetToTrash } from '@/lib/asset-recycle';
import { getAssets } from '@/lib/asset-storage';
import {
  filterAssetsForDashboard,
  formatMoney,
  formatNetWorthSummary,
  getAssetCurrency,
  getAssetDisplayValue,
  hasMultipleCurrencies,
  isAssetHiddenFromDashboard,
  isHeldChineseAsset,
  sumDisplayValuesInCurrency,
  sumDisplayValuesNaive,
} from '@/lib/asset-value';
import { rgbaFromHex } from '@/lib/color-utils';
import { createDashboardStyles, type DashboardStyles } from '@/lib/dashboard-styles';
import { loadDisplayCurrency } from '@/lib/display-currency-preference';
import { BALANCE_INK } from '@/lib/finance-colors';
import { getCachedFxUsdRates, type FxUsdMidRates } from '@/lib/fx-rates';
import { syncNetWorthFromMarket } from '@/lib/net-worth-sync';
import { FREE_ASSET_LIMIT } from '@/lib/subscription-constants';
import {
  ASSET_CATEGORY_ORDER,
  CATEGORY_LABEL_ZH,
  getListedUnitPrice,
  type AssetCategory,
  type SimpleAsset,
} from '@/types/asset';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import * as ExpoStatusBar from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORY_ORDER = ASSET_CATEGORY_ORDER;

function categoryTitle(cat: string): string {
  return CATEGORY_LABEL_ZH[cat as AssetCategory] ?? cat;
}

const CATEGORY_ROW_ICONS: Record<
  AssetCategory,
  keyof typeof MaterialIcons.glyphMap
> = {
  Stock: 'trending-up',
  Fund: 'account-balance',
  ETF: 'bar-chart',
  Cash: 'account-balance-wallet',
  Gold: 'star',
  Custom: 'widgets',
};

/** 按扁平类别分组 */
function groupByCategory(
  assets: SimpleAsset[]
): Record<string, SimpleAsset[]> {
  const grouped: Record<string, SimpleAsset[]> = {};
  for (const asset of assets) {
    const cat = asset.category ?? 'Cash';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(asset);
  }
  return grouped;
}

function trimFractionZeros(numStr: string): string {
  return numStr.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function formatListedSharesText(shares: number): string {
  const s = Number(shares);
  if (!Number.isFinite(s)) return '';
  const t = trimFractionZeros(s.toFixed(4));
  const [intRaw, frac] = t.split('.');
  const intFmt = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac !== undefined ? `${intFmt}.${frac}` : intFmt;
}

function formatListedUnitText(unit: number): string {
  const u = Number(unit);
  if (!Number.isFinite(u)) return '';
  return trimFractionZeros(u.toFixed(4));
}

/** 参考图：整数大、小数略小；非 CNY 仍用整段 formatMoney */
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
  /** 仅 Dashboard 顶部人民币合计：更大字号 */
  hero?: boolean;
}) {
  if (currency === 'CNY' && Number.isFinite(amount)) {
    const [intRaw, dec = '00'] = amount.toFixed(2).split('.');
    const intFmt = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (
      <View style={styles.assetValueSplit}>
        <Text
          style={[
            hero ? styles.netWorthHeroInt : styles.assetValueInt,
            { color: accentColor },
          ]}
        >
          ¥{intFmt}
        </Text>
        <Text
          style={[
            hero ? styles.netWorthHeroDec : styles.assetValueDec,
            { color: accentColor },
          ]}
        >
          .{dec}
        </Text>
      </View>
    );
  }
  return (
    <Text style={[styles.assetValue, { color: accentColor }]}>
      {formatMoney(amount, currency)}
    </Text>
  );
}

/** 列表展示用：场内或行情型贵金属，有持仓+六位代码即可显示（不强制行情已同步） */
function hasHeldHoldingsForDisplay(asset: SimpleAsset): boolean {
  return isHeldChineseAsset(asset);
}

function listedHoldingsSubtitle(asset: SimpleAsset): string | null {
  if (!hasHeldHoldingsForDisplay(asset)) return null;
  const shares = asset.shares!;
  const gram = asset.category === 'Gold';
  let unit = getListedUnitPrice(asset);
  if (unit === null || unit <= 0) {
    const v = typeof asset.value === 'number' && !Number.isNaN(asset.value) ? asset.value : 0;
    if (v > 0 && shares > 0) {
      unit = v / shares;
    }
  }
  const sharesText = formatListedSharesText(shares);
  const qty = gram ? '克' : '份';
  if (unit === null || unit <= 0 || !Number.isFinite(unit)) {
    return `持仓 ${sharesText} ${qty}（单价待同步）`;
  }
  const cur = getAssetCurrency(asset);
  const priceText =
    cur === 'CNY'
      ? `¥${formatListedUnitText(unit)}`
      : formatMoney(unit, cur);
  return `持仓 ${sharesText} ${qty}，${priceText}`;
}

function listedQuoteDateLabel(asset: SimpleAsset): string | null {
  if (!hasHeldHoldingsForDisplay(asset)) return null;
  const iso = asset.lastCloseDate ?? asset.markPriceDate;
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [, m, d] = iso.split('-');
  return `${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

/** 折叠态摘要：主要账户名称，最多 4 个 */
function categoryNamesSubtitle(assets: SimpleAsset[]): string {
  if (assets.length === 0) return '';
  const names = assets.map((a) => a.name.trim()).filter((n) => n.length > 0);
  const max = 4;
  if (names.length <= max) return names.join('，');
  return `${names.slice(0, max).join('，')} 等${names.length}笔`;
}

/** 该类别下最近一条净值/现价日期 */
function categoryQuoteFootnote(assets: SimpleAsset[]): string | null {
  let best = '';
  for (const a of assets) {
    const d = a.lastCloseDate ?? a.markPriceDate;
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d > best) best = d;
  }
  if (!best) return null;
  const [, m, d] = best.split('-');
  return `净值参考 ${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

/**
 * 明细行：左侧圆形图标 + 名称/持仓 + 金额。
 */
function AssetRow({
  asset,
  accentColor,
  styles,
  chevronMuted,
  onEdit,
  onDelete,
}: {
  asset: SimpleAsset;
  accentColor: string;
  styles: DashboardStyles;
  chevronMuted: string;
  onEdit: (asset: SimpleAsset) => void;
  onDelete: (id: string) => void;
}) {
  const handleLongPress = useCallback(() => {
    Alert.alert('删除资产', '确定要删除该资产吗？此操作无法撤销。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => onDelete(asset.id),
      },
    ]);
  }, [asset.id, onDelete]);

  const currency = getAssetCurrency(asset);
  const amount = getAssetDisplayValue(asset);
  const holdingsLine = listedHoldingsSubtitle(asset);
  const quoteDate = listedQuoteDateLabel(asset);
  const cat = asset.category as AssetCategory;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.assetRow,
        pressed && styles.assetRowPressed,
      ]}
      onPress={() => onEdit(asset)}
      onLongPress={handleLongPress}
      delayLongPress={500}
    >
      <View
        style={[
          styles.assetIconWrap,
          { backgroundColor: `${accentColor}18` },
        ]}
      >
        <MaterialIcons
          name={CATEGORY_ROW_ICONS[cat] ?? 'folder'}
          size={22}
          color={accentColor}
        />
      </View>
      <View style={styles.assetRowLeft}>
        <Text style={styles.assetName}>{asset.name}</Text>
        {asset.account?.trim() ? (
          <Text style={styles.assetAccount} numberOfLines={1}>
            {asset.account.trim()}
          </Text>
        ) : null}
        {holdingsLine ? (
          <Text style={styles.assetHoldings}>{holdingsLine}</Text>
        ) : null}
        {asset.purpose ? (
          <Text style={styles.assetPurpose}>{asset.purpose}</Text>
        ) : null}
        {typeof asset.purposeTarget === 'number' && asset.purposeTarget > 0 ? (
          <Text style={styles.assetPurposeMeta}>
            目标{' '}
            {formatMoney(asset.purposeTarget, currency)}
            {' · '}
            完成度{' '}
            {Math.min(
              100,
              Math.round((amount / asset.purposeTarget) * 100)
            )}
            %
          </Text>
        ) : null}
      </View>
      <View style={styles.assetRowRight}>
        <View style={styles.assetRowRightStack}>
          <AssetPrimaryValue
            amount={amount}
            currency={currency}
            accentColor={accentColor}
            styles={styles}
          />
          {quoteDate ? (
            <Text style={styles.assetQuoteDate}>{quoteDate}</Text>
          ) : null}
        </View>
        <MaterialIcons
          name="chevron-right"
          size={20}
          color={chevronMuted}
          style={styles.assetChevron}
        />
      </View>
    </Pressable>
  );
}

/**
 * Top navigation bar: "Dashboard" title on left, "+" button on right.
 *
 * LAYOUT STRUCTURE:
 *   [flexDirection: row, justifyContent: space-between]
 *   — Left: Title "Dashboard" (bold, white)
 *   — Right: "+" button (minimal, touchable)
 *
 * NAVIGATION:
 *   Expo Router uses file-based routing. The route /modal maps to app/modal.tsx
 *   (a Stack screen with presentation: 'modal'). router.push('/modal') pushes
 *   that screen onto the stack, showing it as a modal overlay for adding assets.
 */
function DashboardHeader({
  insets,
  styles,
  theme,
  onPressAdd,
}: {
  insets: { top: number; right: number; left: number };
  styles: DashboardStyles;
  theme: AppPaletteTheme;
  onPressAdd: () => void | Promise<void>;
}) {
  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Text style={styles.headerTitle}>总览</Text>
      <Pressable
        style={({ pressed }) => [
          styles.headerAddFab,
          pressed && styles.headerAddFabPressed,
        ]}
        onPress={() => void onPressAdd()}
        accessibilityLabel="添加资产"
      >
        <GlassSurface
          borderRadius={27}
          intensity={56}
          style={styles.headerAddFab}
          contentStyle={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name="add" size={28} color={theme.primary} />
        </GlassSurface>
      </Pressable>
    </View>
  );
}

export default function Dashboard() {
  const { theme, appearance } = useAppPalette();
  const styles = useMemo(() => createDashboardStyles(theme), [theme]);
  const chevronMuted = useMemo(
    () => rgbaFromHex(theme.primary, 0.38),
    [theme.primary]
  );

  const handlePressAdd = useCallback(async () => {
    const gate = await canAddAnotherAsset();
    if (!gate.allowed) {
      Alert.alert(
        '已达免费上限',
        `免费版最多添加 ${FREE_ASSET_LIMIT} 个资产。订阅后可继续添加。`,
        [
          { text: '取消', style: 'cancel' },
          { text: '了解订阅', onPress: () => router.push('/paywall') },
        ]
      );
      return;
    }
    router.push({ pathname: '/modal', params: {} });
  }, []);

  const decorColors = useMemo(
    () => [
      rgbaFromHex('#8EA8C8', 0.4),
      rgbaFromHex('#9EC4E8', 0.32),
      rgbaFromHex('#B8D6F0', 0.26),
    ],
    []
  );

  const insets = useSafeAreaInsets();
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  /** 仅首屏：本地读盘完成前显示全页加载 */
  const [loading, setLoading] = useState(true);
  /** 后台拉行情时不挡整页，只作轻提示 */
  const [syncingQuotes, setSyncingQuotes] = useState(false);
  /** 默认货币口径净值；无汇率且无法安全折算时为 null */
  const [netWorthDisplay, setNetWorthDisplay] = useState<number | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<string>('CNY');
  const [fxUsdRates, setFxUsdRates] = useState<FxUsdMidRates['rates'] | null>(
    null
  );
  const focusLoadGen = useRef(0);

  /** 默认全部折叠，只显示各类合计与名称摘要 */
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set()
  );

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const handleDeleteAsset = useCallback(async (id: string) => {
    await moveAssetToTrash(id);
    try {
      setAssets(await getAssets());
    } catch {
      setAssets([]);
    }
  }, []);

  const handleEditAsset = useCallback((asset: SimpleAsset) => {
    router.push({ pathname: '/asset-action', params: { id: asset.id } });
  }, []);

  /** 下拉刷新：拉行情、写净值快照；进入页面不再自动轮询 */
  const refreshMarketData = useCallback(async () => {
    setSyncingQuotes(true);
    try {
      const updated = await syncNetWorthFromMarket();
      setAssets(updated.assets);
      const dc = await loadDisplayCurrency();
      setDisplayCurrency(dc);
      const dash = filterAssetsForDashboard(updated.assets);
      const needsFxDash = dash.some((a) => getAssetCurrency(a) !== dc);
      const cachedAfterSync = await getCachedFxUsdRates();
      setFxUsdRates(cachedAfterSync?.rates ?? null);
      const unified = sumDisplayValuesInCurrency(
        dash,
        dc,
        cachedAfterSync?.rates ?? null
      );
      if (unified !== null) {
        setNetWorthDisplay(unified);
      } else if (!needsFxDash) {
        setNetWorthDisplay(sumDisplayValuesNaive(dash));
      } else {
        setNetWorthDisplay(null);
      }
    } catch {
      /* 保留当前列表与展示 */
    } finally {
      setSyncingQuotes(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      ExpoStatusBar.setStatusBarStyle(
        appearance === 'dark' ? 'light' : 'dark'
      );
      return () => ExpoStatusBar.setStatusBarStyle('auto');
    }, [appearance])
  );

  useFocusEffect(
    useCallback(() => {
      const gen = ++focusLoadGen.current;
      let cancelled = false;
      (async () => {
        try {
          const local = await getAssets();
          if (!cancelled && gen === focusLoadGen.current) {
            setAssets(local);
            setLoading(false);
            const dc = await loadDisplayCurrency();
            setDisplayCurrency(dc);
            const dash = filterAssetsForDashboard(local);
            const needsFx = dash.some((a) => getAssetCurrency(a) !== dc);
            const cached = await getCachedFxUsdRates();
            setFxUsdRates(cached?.rates ?? null);
            const unified = sumDisplayValuesInCurrency(
              dash,
              dc,
              cached?.rates ?? null
            );
            if (unified !== null) {
              setNetWorthDisplay(unified);
            } else if (!needsFx) {
              setNetWorthDisplay(sumDisplayValuesNaive(dash));
            } else {
              setNetWorthDisplay(null);
            }
          }
        } catch {
          if (!cancelled && gen === focusLoadGen.current) {
            setAssets([]);
            setLoading(false);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const dashboardAssets = useMemo(
    () => filterAssetsForDashboard(assets),
    [assets]
  );

  /** 主列表隐藏但仍保存在本地的清仓 / 零余额资产，可点进详情并归档 */
  const hiddenFromDashboardAssets = useMemo(
    () => assets.filter((a) => isAssetHiddenFromDashboard(a)),
    [assets]
  );

  const grouped = useMemo(
    () => groupByCategory(dashboardAssets),
    [dashboardAssets]
  );

  /** 顶部净值：一次聚合得到多行文案 + 是否多币种 */
  const netWorthSummary = useMemo(
    () => formatNetWorthSummary(dashboardAssets),
    [dashboardAssets]
  );

  if (loading) {
    return (
      <View style={styles.screenWrapper}>
        <View style={styles.dashboardAmbient} pointerEvents="none" />
        <View style={styles.decorWrap} pointerEvents="none">
          <View
            style={[
              styles.decorBlob,
              {
                width: 240,
                height: 300,
                top: -50,
                left: -70,
                backgroundColor: decorColors[0],
              },
            ]}
          />
          <View
            style={[
              styles.decorBlob,
              {
                width: 300,
                height: 280,
                top: 100,
                right: -90,
                backgroundColor: decorColors[1],
              },
            ]}
          />
        </View>
        <DashboardHeader
          insets={insets}
          styles={styles}
          theme={theme}
          onPressAdd={handlePressAdd}
        />
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screenWrapper}>
      <View style={styles.dashboardAmbient} pointerEvents="none" />
      <View style={styles.decorWrap} pointerEvents="none">
        <View
          style={[
            styles.decorBlob,
            {
              width: 240,
              height: 300,
              top: -50,
              left: -70,
              backgroundColor: decorColors[0],
            },
          ]}
        />
        <View
          style={[
            styles.decorBlob,
            {
              width: 300,
              height: 280,
              top: 100,
              right: -90,
              backgroundColor: decorColors[1],
            },
          ]}
        />
        <View
          style={[
            styles.decorBlob,
            {
              width: 200,
              height: 200,
              bottom: 120,
              left: 10,
              backgroundColor: decorColors[2],
            },
          ]}
        />
      </View>
      <DashboardHeader
        insets={insets}
        styles={styles}
        theme={theme}
        onPressAdd={handlePressAdd}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 32,
            flexGrow: 1,
            backgroundColor: 'transparent',
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={syncingQuotes}
            onRefresh={refreshMarketData}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
      {/* 1. Net Worth — large, centered (below header) */}
      <GlassSurface borderRadius={32} intensity={52}>
      <View style={styles.netWorthSection}>
        <Text style={styles.netWorthLabel}>净值</Text>
        {netWorthDisplay !== null && Number.isFinite(netWorthDisplay) ? (
          <>
            <AssetPrimaryValue
              amount={netWorthDisplay}
              currency={displayCurrency}
              accentColor={BALANCE_INK}
              styles={styles}
              hero
            />
            <Text
              style={[
                styles.netWorthValue,
                styles.netWorthBreakdown,
                netWorthSummary.lines.includes('\n') &&
                  styles.netWorthValueCompact,
              ]}
            >
              {netWorthSummary.lines}
            </Text>
          </>
        ) : (
          <Text
            style={[
              styles.netWorthValue,
              netWorthSummary.lines.includes('\n') && styles.netWorthValueCompact,
            ]}
          >
            {netWorthSummary.lines}
          </Text>
        )}
      </View>
      </GlassSurface>

      {/* 2. Grouped asset structure: Category → Assets (collapsible) */}
      <View style={styles.assetStructureSection}>
        {dashboardAssets.length === 0 && hiddenFromDashboardAssets.length === 0 ? (
          <GlassSurface borderRadius={28} intensity={44}>
            <View style={styles.emptyCardInner}>
              <Text style={styles.emptyText}>
                暂无资产。点右上角「+」添加第一条资产。
              </Text>
            </View>
          </GlassSurface>
        ) : (
          <View style={styles.groupsContainer}>
            {CATEGORY_ORDER.map((category) => {
              const list = grouped[category];
              if (!list || list.length === 0) return null;

              const isCategoryExpanded = expandedCategories.has(category);
              const catUnified = sumDisplayValuesInCurrency(
                list,
                displayCurrency,
                fxUsdRates
              );
              const categoryNetWorth =
                catUnified !== null && Number.isFinite(catUnified)
                  ? {
                      lines: formatMoney(catUnified, displayCurrency),
                      hasMultiple: hasMultipleCurrencies(list),
                    }
                  : formatNetWorthSummary(list);
              const accent =
                theme.categoryAccents[category as AssetCategory] ??
                theme.primary;

              const subtitle = categoryNamesSubtitle(list);
              const foot = categoryQuoteFootnote(list);

              return (
                <GlassSurface
                  key={category}
                  borderRadius={28}
                  intensity={46}
                  style={styles.categoryGlassOuter}
                >
                  <View style={styles.folderCard}>
                    <View
                      style={[styles.folderAccentStrip, { backgroundColor: accent }]}
                    />
                    <View style={styles.folderBody}>
                      <Pressable
                        style={[
                          styles.folderHeader,
                          isCategoryExpanded && {
                            backgroundColor: accent,
                            borderTopRightRadius: 18,
                          },
                        ]}
                        onPress={() => toggleCategory(category)}
                      >
                        <View style={styles.folderHeaderTextCol}>
                          <Text
                            style={[
                              styles.folderTitle,
                              isCategoryExpanded && styles.folderTitleOnAccent,
                            ]}
                            numberOfLines={1}
                          >
                            {categoryTitle(category)}
                          </Text>
                          {subtitle.length > 0 ? (
                            <Text
                              style={[
                                styles.folderSubtitle,
                                isCategoryExpanded &&
                                  styles.folderSubtitleOnAccent,
                              ]}
                              numberOfLines={2}
                            >
                              {subtitle}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.folderHeaderRight}>
                          <Text
                            style={[
                              styles.folderTotal,
                              categoryNetWorth.lines.includes('\n') &&
                                styles.folderTotalMultiline,
                              isCategoryExpanded && styles.folderTotalOnAccent,
                            ]}
                          >
                            {categoryNetWorth.lines}
                          </Text>
                          {foot && !isCategoryExpanded ? (
                            <Text style={styles.folderFootDate}>{foot}</Text>
                          ) : null}
                          <Text
                            style={[
                              styles.folderChevron,
                              isCategoryExpanded && styles.folderChevronOnAccent,
                            ]}
                          >
                            {isCategoryExpanded ? '▼' : '▶'}
                          </Text>
                        </View>
                      </Pressable>

                      {isCategoryExpanded ? (
                        <View style={styles.folderAssetList}>
                          {list.map((asset) => (
                            <AssetRow
                              key={asset.id}
                              asset={asset}
                              accentColor={accent}
                              styles={styles}
                              chevronMuted={chevronMuted}
                              onEdit={handleEditAsset}
                              onDelete={handleDeleteAsset}
                            />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                </GlassSurface>
              );
            })}

            {hiddenFromDashboardAssets.length > 0 ? (
              <GlassSurface
                borderRadius={28}
                intensity={46}
                style={styles.categoryGlassOuter}
              >
                <View style={styles.folderCard}>
                  <View
                    style={[
                      styles.folderAccentStrip,
                      { backgroundColor: rgbaFromHex(theme.primary, 0.35) },
                    ]}
                  />
                  <View style={styles.folderBody}>
                    <View style={[styles.folderHeader, { backgroundColor: rgbaFromHex(theme.primary, 0.12) }]}>
                      <View style={styles.folderHeaderTextCol}>
                        <Text style={styles.folderTitle} numberOfLines={1}>
                          已清仓 / 零余额
                        </Text>
                        <Text style={styles.folderSubtitle} numberOfLines={2}>
                          不计入上方净值汇总；可进入详情后归档交易明细至「更多 → 已归档」
                        </Text>
                      </View>
                    </View>
                    <View style={styles.folderAssetList}>
                      {hiddenFromDashboardAssets.map((asset) => {
                        const cat = asset.category as AssetCategory;
                        const accent =
                          theme.categoryAccents[cat] ?? theme.primary;
                        return (
                          <AssetRow
                            key={asset.id}
                            asset={asset}
                            accentColor={accent}
                            styles={styles}
                            chevronMuted={chevronMuted}
                            onEdit={handleEditAsset}
                            onDelete={handleDeleteAsset}
                          />
                        );
                      })}
                    </View>
                  </View>
                </View>
              </GlassSurface>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
    </View>
  );
}
