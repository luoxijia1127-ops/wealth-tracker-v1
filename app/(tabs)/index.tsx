/**
 * DASHBOARD SCREEN
 *
 * Merged view: Net Worth at top, then grouped asset structure (Category → Type → Assets).
 * Loads assets from AsyncStorage (key "assets"). Net Worth = sum of all asset values.
 *
 * Structure:
 * 1. Net Worth (large, centered)
 * 2. Grouped assets: 类别（股票/基金/ETF/现金类/黄金）→ 资产列表
 *
 * 场内标的：份额 ×（markPrice 现价优先，否则 lastClose 日 K 结算）；同步后写快照供 Insights。
 * 其他资产：使用 value。顶部 Net Worth 以折合人民币为主（Frankfurter/ECB 口径中间价串联）；分行展示原币种市值。
 *
 * 浅色「文件夹」交互：大类默认只显示合计 + 资产名摘要；点击展开明细；展开时头部用类别色条填充。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { deleteAsset, getAssets } from '@/lib/asset-storage';
import {
  formatMoney,
  formatNetWorthLines,
  formatNetWorthSummary,
  getAssetCurrency,
  getAssetDisplayValue,
  isHeldChineseAsset,
  sumDisplayValuesInCny,
  sumDisplayValuesNaive,
} from '@/lib/asset-value';
import { getCachedFxUsdRates } from '@/lib/fx-rates';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { rgbaFromHex } from '@/lib/color-utils';
import { createDashboardStyles, type DashboardStyles } from '@/lib/dashboard-styles';
import { syncNetWorthFromMarket } from '@/lib/net-worth-sync';
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
  Platform,
  Pressable,
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
}: {
  amount: number;
  currency: string;
  accentColor: string;
  styles: DashboardStyles;
}) {
  if (currency === 'CNY' && Number.isFinite(amount)) {
    const [intRaw, dec = '00'] = amount.toFixed(2).split('.');
    const intFmt = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (
      <View style={styles.assetValueSplit}>
        <Text style={[styles.assetValueInt, { color: accentColor }]}>
          ¥{intFmt}
        </Text>
        <Text style={[styles.assetValueDec, { color: accentColor }]}>
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

/** 列表展示用：场内或行情型黄金，有持仓+六位代码即可显示（不强制行情已同步） */
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
    Alert.alert('Delete Asset', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
}: {
  insets: { top: number; right: number; left: number };
  styles: DashboardStyles;
}) {
  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Text style={styles.headerTitle}>Dashboard</Text>
      <Pressable
        style={({ pressed }) => [
          styles.headerAddFab,
          pressed && styles.headerAddFabPressed,
        ]}
        onPress={() => {
          router.push({ pathname: '/modal', params: {} });
        }}
        accessibilityLabel="添加资产"
      >
        <MaterialIcons name="add" size={28} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

export default function Dashboard() {
  const { theme } = useAppPalette();
  const styles = useMemo(() => createDashboardStyles(theme), [theme]);
  const chevronMuted = useMemo(
    () => rgbaFromHex(theme.primary, 0.38),
    [theme.primary]
  );

  const insets = useSafeAreaInsets();
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  /** 仅首屏：本地读盘完成前显示全页加载 */
  const [loading, setLoading] = useState(true);
  /** 后台拉行情时不挡整页，只作轻提示 */
  const [syncingQuotes, setSyncingQuotes] = useState(false);
  /** 折合人民币净值；无汇率且含外币时为 null */
  const [netWorthCny, setNetWorthCny] = useState<number | null>(null);
  /** 汇率说明（基准日 / 离线沿用等） */
  const [fxNote, setFxNote] = useState<string | null>(null);
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
    await deleteAsset(id);
    try {
      setAssets(await getAssets());
    } catch {
      setAssets([]);
    }
  }, []);

  const handleEditAsset = useCallback((asset: SimpleAsset) => {
    router.push({ pathname: '/asset-action', params: { id: asset.id } });
  }, []);

  useFocusEffect(
    useCallback(() => {
      ExpoStatusBar.setStatusBarStyle('dark');
      return () => ExpoStatusBar.setStatusBarStyle('auto');
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      const gen = ++focusLoadGen.current;
      let cancelled = false;
      let syncing = false;
      let timer: ReturnType<typeof setInterval> | null = null;
      const runSync = async () => {
        if (syncing || cancelled || gen !== focusLoadGen.current) return;
        syncing = true;
        setSyncingQuotes(true);
        try {
          const updated = await syncNetWorthFromMarket();
          if (!cancelled && gen === focusLoadGen.current) {
            setAssets(updated.assets);
            setNetWorthCny(updated.totalValueCny);
            if (updated.fxSource === 'none') {
              setFxNote(
                updated.totalValueCny === null
                  ? '当前无法获取汇率，外币持仓未折算为人民币。'
                  : null
              );
            } else {
              const stale =
                updated.fxSource === 'stale' ? '（沿用缓存汇率）' : '';
              setFxNote(
                updated.fxApiDate
                  ? `汇率基准日 ${updated.fxApiDate}，中间价经 USD 串联折算人民币${stale}`
                  : stale || null
              );
            }
          }
        } catch {
          /* 保留本地列表 */
        } finally {
          syncing = false;
          if (gen === focusLoadGen.current) {
            setSyncingQuotes(false);
          }
        }
      };
      (async () => {
        try {
          const local = await getAssets();
          if (!cancelled && gen === focusLoadGen.current) {
            setAssets(local);
            setLoading(false);
            const needsFx = local.some((a) => getAssetCurrency(a) !== 'CNY');
            const cached = await getCachedFxUsdRates();
            const today = getShanghaiDateString();
            if (cached) {
              setNetWorthCny(sumDisplayValuesInCny(local, cached.rates));
              const stale =
                cached.shanghaiDate !== today ? '（沿用缓存汇率）' : '';
              setFxNote(
                `汇率基准日 ${cached.apiDate}，中间价经 USD 串联折算人民币${stale}`
              );
            } else if (!needsFx) {
              setNetWorthCny(sumDisplayValuesNaive(local));
              setFxNote(null);
            } else {
              setNetWorthCny(null);
              setFxNote('当前无汇率缓存，同步后将按当日中间价折算。');
            }
          }
        } catch {
          if (!cancelled && gen === focusLoadGen.current) {
            setAssets([]);
            setLoading(false);
          }
        }
        if (cancelled || gen !== focusLoadGen.current) return;
        await runSync();
        timer = setInterval(() => {
          void runSync();
        }, 60_000);
      })();
      return () => {
        cancelled = true;
        if (timer) clearInterval(timer);
      };
    }, [])
  );

  const grouped = useMemo(() => groupByCategory(assets), [assets]);

  /** 顶部净值：一次聚合得到多行文案 + 是否多币种 */
  const netWorthSummary = useMemo(
    () => formatNetWorthSummary(assets),
    [assets]
  );

  if (loading) {
    return (
      <View style={styles.screenWrapper}>
        <DashboardHeader insets={insets} styles={styles} />
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screenWrapper}>
      <DashboardHeader insets={insets} styles={styles} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 32,
            flexGrow: 1,
            backgroundColor: theme.pageBg,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
      {/* 1. Net Worth — large, centered (below header) */}
      <View style={styles.netWorthSection}>
        <Text style={styles.netWorthLabel}>Net Worth</Text>
        {netWorthCny !== null && Number.isFinite(netWorthCny) ? (
          <>
            <AssetPrimaryValue
              amount={netWorthCny}
              currency="CNY"
              accentColor={theme.primary}
              styles={styles}
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
            <Text style={styles.netWorthFootnote}>按持仓币种分列市值</Text>
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
        {fxNote ? (
          <Text style={styles.netWorthFootnote}>{fxNote}</Text>
        ) : null}
        {syncingQuotes ? (
          <View style={styles.syncRow}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={styles.syncRowText}>正在同步行情…</Text>
          </View>
        ) : null}
        <Text style={styles.netWorthFootnote}>
          行情仅作参考；返回本页会先显示本地数据，再在后台更新（场内为现价与日K收盘；场外基金为最新披露净值）。
        </Text>
      </View>

      {/* 2. Spacing between Net Worth and asset structure */}
      <View style={styles.spacer} />

      {/* 3. Grouped asset structure: Category → Assets (collapsible) */}
      <View style={styles.assetStructureSection}>
        {assets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Add assets from the Add tab</Text>
          </View>
        ) : (
          <View style={styles.groupsContainer}>
            {CATEGORY_ORDER.map((category) => {
              const list = grouped[category];
              if (!list || list.length === 0) return null;

              const isCategoryExpanded = expandedCategories.has(category);
              const categoryTotalText = formatNetWorthLines(list);
              const accent =
                theme.categoryAccents[category as AssetCategory] ??
                theme.primary;

              const subtitle = categoryNamesSubtitle(list);
              const foot = categoryQuoteFootnote(list);

              return (
                <View
                  key={category}
                  style={[
                    styles.categoryCardShadow,
                    Platform.OS === 'ios'
                      ? styles.categoryCardShadowIOS
                      : styles.categoryCardShadowAndroid,
                  ]}
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
                              isCategoryExpanded && styles.folderTotalOnAccent,
                            ]}
                            numberOfLines={2}
                          >
                            {categoryTotalText}
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
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
    </View>
  );
}
