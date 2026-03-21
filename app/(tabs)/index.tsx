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
 * 其他资产：使用 value。净值按币种分行展示；快照曲线为数值直接相加（多币种未折算）。
 *
 * 浅色「文件夹」交互：大类默认只显示合计 + 资产名摘要；点击展开明细；展开时头部用类别色条填充。
 */

import { deleteAsset, getAssets } from '@/lib/asset-storage';
import {
    formatMoney,
    formatNetWorthLines,
    formatNetWorthSummary,
    getAssetCurrency,
    getAssetDisplayValue,
} from '@/lib/asset-value';
import { setEditingAssetId } from '@/lib/edit-asset-store';
import { syncNetWorthFromMarket } from '@/lib/net-worth-sync';
import {
    ASSET_CATEGORY_ORDER,
    CATEGORY_LABEL_ZH,
    getListedUnitPrice,
    isListedAssetCategory,
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
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORY_ORDER = ASSET_CATEGORY_ORDER;

/**
 * sea 配色（coolors）：雾蓝底 / 天蓝 / 珊瑚 / 靛灰文案与强调 / 灰紫。
 */
const SEA = {
  mist: '#B1D4F8',
  sky: '#98CCF8',
  coral: '#FAB8B4',
  slate: '#5C6390',
  lavender: '#B286B3',
} as const;

const PAGE_BG = SEA.mist;

const CATEGORY_ACCENTS: Record<AssetCategory, string> = {
  Stock: SEA.slate,
  Fund: SEA.coral,
  ETF: SEA.sky,
  Cash: SEA.lavender,
  /** 与基金同属暖色块；条形色仍清晰可辨 */
  Gold: SEA.coral,
};

function categoryTitle(cat: string): string {
  return CATEGORY_LABEL_ZH[cat as AssetCategory] ?? cat;
}

function getCategoryAccent(category: string): string {
  return CATEGORY_ACCENTS[category as AssetCategory] ?? SEA.slate;
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
}: {
  amount: number;
  currency: string;
  accentColor: string;
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

/** 列表展示用：有份额+六位代码即可显示持仓行（不强制行情已同步） */
function hasListedHoldingsForDisplay(asset: SimpleAsset): boolean {
  if (!isListedAssetCategory(asset.category)) return false;
  if (typeof asset.shares !== 'number' || asset.shares <= 0) return false;
  const sym = typeof asset.symbol === 'string' ? asset.symbol.trim() : '';
  return /^\d{6}$/.test(sym);
}

function listedHoldingsSubtitle(asset: SimpleAsset): string | null {
  if (!hasListedHoldingsForDisplay(asset)) return null;
  const shares = asset.shares!;
  let unit = getListedUnitPrice(asset);
  if (unit === null || unit <= 0) {
    const v = typeof asset.value === 'number' && !Number.isNaN(asset.value) ? asset.value : 0;
    if (v > 0 && shares > 0) {
      unit = v / shares;
    }
  }
  const sharesText = formatListedSharesText(shares);
  if (unit === null || unit <= 0 || !Number.isFinite(unit)) {
    return `持仓 ${sharesText}（单价待同步）`;
  }
  return `持仓 ${sharesText}，¥${formatListedUnitText(unit)}`;
}

function listedQuoteDateLabel(asset: SimpleAsset): string | null {
  if (!hasListedHoldingsForDisplay(asset)) return null;
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
  onEdit,
  onDelete,
}: {
  asset: SimpleAsset;
  accentColor: string;
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
          />
          {quoteDate ? (
            <Text style={styles.assetQuoteDate}>{quoteDate}</Text>
          ) : null}
        </View>
        <MaterialIcons
          name="chevron-right"
          size={20}
          color="rgba(92, 99, 144, 0.38)"
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
}: {
  insets: { top: number; right: number; left: number };
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
          setEditingAssetId(null);
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
  const insets = useSafeAreaInsets();
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  /** 仅首屏：本地读盘完成前显示全页加载 */
  const [loading, setLoading] = useState(true);
  /** 后台拉行情时不挡整页，只作轻提示 */
  const [syncingQuotes, setSyncingQuotes] = useState(false);
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
    setEditingAssetId(asset.id);
    router.push({ pathname: '/modal', params: { id: asset.id } });
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
      (async () => {
        try {
          const local = await getAssets();
          if (!cancelled && gen === focusLoadGen.current) {
            setAssets(local);
            setLoading(false);
          }
        } catch {
          if (!cancelled && gen === focusLoadGen.current) {
            setAssets([]);
            setLoading(false);
          }
        }
        if (cancelled || gen !== focusLoadGen.current) return;
        setSyncingQuotes(true);
        try {
          const updated = await syncNetWorthFromMarket();
          if (!cancelled && gen === focusLoadGen.current) {
            setAssets(updated);
          }
        } catch {
          /* 保留本地列表 */
        } finally {
          if (gen === focusLoadGen.current) {
            setSyncingQuotes(false);
          }
        }
      })();
      return () => {
        cancelled = true;
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
        <DashboardHeader insets={insets} />
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={SEA.slate} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screenWrapper}>
      <DashboardHeader insets={insets} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 32,
            flexGrow: 1,
            backgroundColor: PAGE_BG,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
      {/* 1. Net Worth — large, centered (below header) */}
      <View style={styles.netWorthSection}>
        <Text style={styles.netWorthLabel}>Net Worth</Text>
        <Text
          style={[
            styles.netWorthValue,
            netWorthSummary.lines.includes('\n') && styles.netWorthValueCompact,
          ]}
        >
          {netWorthSummary.lines}
        </Text>
        {netWorthSummary.hasMultiple && (
          <Text style={styles.netWorthFootnote}>
            多币种资产未折算汇率；曲线为各币种数值直接相加。
          </Text>
        )}
        {syncingQuotes ? (
          <View style={styles.syncRow}>
            <ActivityIndicator size="small" color={SEA.slate} />
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
              const accent = getCategoryAccent(category);

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

/**
 * STYLES — Light “Apple Wallet” glass: periwinkle page + blurred category cards
 */
const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: PAGE_BG,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: SEA.slate,
  },
  headerAddFab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: SEA.slate,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    ...Platform.select({
      ios: {
        shadowColor: SEA.slate,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
  headerAddFabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
  },
  // Net Worth: centered at top, large text
  netWorthSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  netWorthLabel: {
    fontSize: 13,
    color: 'rgba(92, 99, 144, 0.65)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  netWorthValue: {
    fontSize: 40,
    fontWeight: '700',
    color: SEA.slate,
    textAlign: 'center',
  },
  netWorthValueCompact: {
    fontSize: 28,
    lineHeight: 36,
  },
  netWorthFootnote: {
    fontSize: 11,
    color: 'rgba(92, 99, 144, 0.5)',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    lineHeight: 16,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  syncRowText: {
    fontSize: 12,
    color: 'rgba(92, 99, 144, 0.55)',
  },
  // Spacing between Net Worth and asset structure
  spacer: {
    height: 24,
  },
  assetStructureSection: {
    flex: 1,
  },
  groupsContainer: {
    gap: 18,
  },
  categoryCardShadow: {
    borderRadius: 22,
    backgroundColor: 'transparent',
  },
  categoryCardShadowIOS: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  categoryCardShadowAndroid: {
    elevation: 6,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  folderAccentStrip: {
    width: 7,
    minHeight: 72,
  },
  folderBody: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 10,
  },
  folderHeaderTextCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
  },
  folderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: SEA.slate,
    letterSpacing: -0.2,
  },
  folderTitleOnAccent: {
    color: '#FFFFFF',
  },
  folderSubtitle: {
    fontSize: 13,
    color: 'rgba(92, 99, 144, 0.55)',
    marginTop: 6,
    lineHeight: 18,
  },
  folderSubtitleOnAccent: {
    color: 'rgba(255, 255, 255, 0.88)',
  },
  folderHeaderRight: {
    alignItems: 'flex-end',
    maxWidth: '46%',
  },
  folderTotal: {
    fontSize: 17,
    fontWeight: '700',
    color: SEA.slate,
    textAlign: 'right',
  },
  folderTotalOnAccent: {
    color: '#FFFFFF',
  },
  folderFootDate: {
    fontSize: 11,
    color: 'rgba(92, 99, 144, 0.48)',
    marginTop: 6,
    textAlign: 'right',
  },
  folderChevron: {
    fontSize: 11,
    color: 'rgba(92, 99, 144, 0.4)',
    marginTop: 8,
    fontWeight: '600',
  },
  folderChevronOnAccent: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  folderAssetList: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    paddingTop: 4,
    backgroundColor: 'rgba(177, 212, 248, 0.45)',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  assetIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  assetRowPressed: {
    opacity: 0.94,
    backgroundColor: '#FAFAFC',
  },
  assetRowLeft: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  assetRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 8,
    paddingTop: 2,
  },
  assetRowRightStack: {
    alignItems: 'flex-end',
    gap: 4,
  },
  assetValueSplit: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  assetValueInt: {
    fontSize: 20,
    fontWeight: '700',
  },
  assetValueDec: {
    fontSize: 14,
    fontWeight: '700',
    paddingTop: 2,
  },
  assetQuoteDate: {
    fontSize: 11,
    color: 'rgba(92, 99, 144, 0.48)',
  },
  assetName: {
    fontSize: 17,
    color: SEA.slate,
    fontWeight: '600',
  },
  assetHoldings: {
    fontSize: 13,
    color: 'rgba(92, 99, 144, 0.58)',
    marginTop: 4,
    lineHeight: 18,
  },
  assetPurpose: {
    fontSize: 13,
    color: SEA.lavender,
    fontWeight: '500',
    marginTop: 2,
  },
  assetPurposeMeta: {
    fontSize: 12,
    color: 'rgba(92, 99, 144, 0.55)',
    fontWeight: '500',
    marginTop: 2,
  },
  assetValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  assetChevron: {
    marginLeft: 2,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
      },
      android: { elevation: 4 },
    }),
  },
  emptyText: {
    fontSize: 17,
    color: 'rgba(92, 99, 144, 0.55)',
  },
});
