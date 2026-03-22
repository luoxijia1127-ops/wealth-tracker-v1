/**
 * Insights：净值曲线、资产分布（Tab 切换）+ 目标进度（用途/目标金额，与图表分区展示）
 *
 * 快照先本地再 syncNetWorthFromMarket；分布与目标均按当前持仓与 Dashboard 市值口径。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { getAssets } from '@/lib/asset-storage';
import {
  formatMoney,
  getAssetCurrency,
  getAssetDisplayValue,
} from '@/lib/asset-value';
import { rgbaFromHex } from '@/lib/color-utils';
import { setEditingAssetId } from '@/lib/edit-asset-store';
import { createInsightsStyles, type InsightsStyles } from '@/lib/insights-styles';
import { syncNetWorthFromMarket } from '@/lib/net-worth-sync';
import { getSnapshots } from '@/lib/snapshots';
import type { Snapshot } from '@/lib/snapshots';
import {
  ASSET_CATEGORY_ORDER,
  CATEGORY_LABEL_ZH,
  type AssetCategory,
  type SimpleAsset,
} from '@/types/asset';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import Pie from 'paths-js/pie';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Circle, G, Path, Svg, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ChartTab = 'trend' | 'distribution';

type ChartData = {
  labels: string[];
  datasets: [{ data: number[] }];
};

type DonutSlice = {
  category: AssetCategory;
  name: string;
  value: number;
  color: string;
};

function formatUnconvertedTotal(value: number): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatChange(diff: number, pct: number): string {
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${Math.round(diff).toLocaleString()} (${sign}${pct.toFixed(1)}%)`;
}

function toChartData(snapshots: Snapshot[]): ChartData {
  return {
    labels: snapshots.map((s) => s.date.slice(5)),
    datasets: [{ data: snapshots.map((s) => s.totalValue) }],
  };
}

function getDailyChange(snapshots: Snapshot[]): { diff: number; pct: number } | null {
  if (snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const prev = sorted[sorted.length - 2];
  const last = sorted[sorted.length - 1];
  const diff = last.totalValue - prev.totalValue;
  const pct = prev.totalValue !== 0 ? (diff / prev.totalValue) * 100 : 0;
  return { diff, pct };
}

function aggregateByCategory(assets: SimpleAsset[]): Record<AssetCategory, number> {
  const m: Record<AssetCategory, number> = {
    Stock: 0,
    Fund: 0,
    ETF: 0,
    Cash: 0,
    Gold: 0,
  };
  for (const a of assets) {
    const c = a.category;
    if (c in m) m[c] += getAssetDisplayValue(a);
  }
  return m;
}

function buildDonutSlices(
  assets: SimpleAsset[],
  categoryAccents: Record<AssetCategory, string>
): DonutSlice[] {
  const sums = aggregateByCategory(assets);
  const out: DonutSlice[] = [];
  for (const cat of ASSET_CATEGORY_ORDER) {
    const v = sums[cat];
    if (v > 0) {
      out.push({
        category: cat,
        name: CATEGORY_LABEL_ZH[cat],
        value: v,
        color: categoryAccents[cat],
      });
    }
  }
  return out;
}

const CATEGORY_GOAL_ICONS: Record<
  AssetCategory,
  keyof typeof MaterialIcons.glyphMap
> = {
  Stock: 'trending-up',
  Fund: 'account-balance',
  ETF: 'bar-chart',
  Cash: 'account-balance-wallet',
  Gold: 'star',
};

type GoalProgressRow = {
  id: string;
  label: string;
  assetName: string;
  current: number;
  target: number;
  currency: string;
  pct: number;
  category: AssetCategory;
  ringColor: string;
  iconTint: string;
};

function buildGoalProgressRows(
  assets: SimpleAsset[],
  goalRingColors: readonly string[],
  primaryFallback: string
): GoalProgressRow[] {
  const rows: GoalProgressRow[] = [];
  let colorIdx = 0;
  for (const a of assets) {
    if (typeof a.purposeTarget !== 'number' || a.purposeTarget <= 0) continue;
    const current = getAssetDisplayValue(a);
    const currency = getAssetCurrency(a);
    const pct = Math.min(
      100,
      Math.round((current / a.purposeTarget) * 100)
    );
    const purposeTrim = a.purpose?.trim() ?? '';
    const label = purposeTrim.length > 0 ? purposeTrim : a.name;
    const ringColor =
      goalRingColors[colorIdx % goalRingColors.length] ?? primaryFallback;
    colorIdx += 1;
    rows.push({
      id: a.id,
      label,
      assetName: a.name,
      current,
      target: a.purposeTarget,
      currency,
      pct,
      category: a.category,
      ringColor,
      iconTint: ringColor,
    });
  }
  rows.sort((x, y) => y.pct - x.pct);
  return rows;
}

function GoalProgressRing({
  pct,
  color,
  trackColor,
  styles,
  size = 56,
}: {
  pct: number;
  color: string;
  trackColor: string;
  styles: InsightsStyles;
  size?: number;
}) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = c * (1 - clamped / 100);
  const half = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={half}
          cy={half}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={half}
          cy={half}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${half} ${half})`}
        />
      </Svg>
      <View style={styles.goalRingCenter}>
        <Text style={styles.goalRingPct}>{pct}%</Text>
      </View>
    </View>
  );
}

function GoalProgressCard({
  row,
  styles,
  textSecondary,
  textMuted,
  primary,
  ringTrackColor,
}: {
  row: GoalProgressRow;
  styles: InsightsStyles;
  textSecondary: string;
  textMuted: string;
  primary: string;
  ringTrackColor: string;
}) {
  const showAssetLine =
    row.label !== row.assetName && row.assetName.trim().length > 0;
  const onOpen = () => {
    setEditingAssetId(row.id);
    router.push({ pathname: '/modal', params: { id: row.id } });
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.goalCard,
        pressed && styles.goalCardPressed,
      ]}
    >
      <View
        style={[
          styles.goalIconWrap,
          { backgroundColor: `${row.iconTint}22` },
        ]}
      >
        <MaterialIcons
          name={CATEGORY_GOAL_ICONS[row.category] ?? 'track-changes'}
          size={24}
          color={row.iconTint}
        />
      </View>
      <View style={styles.goalCardMid}>
        <Text
          style={[styles.goalCardLabel, { color: textSecondary }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {row.label}
        </Text>
        {showAssetLine ? (
          <Text
            style={[styles.goalCardAssetName, { color: textMuted }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {row.assetName}
          </Text>
        ) : null}
        <Text style={[styles.goalCardValues, { color: primary }]}>
          {formatMoney(row.current, row.currency)}
          <Text style={{ color: textSecondary, fontWeight: '600' }}>
            {' '}
            / {formatMoney(row.target, row.currency)}
          </Text>
        </Text>
      </View>
      <GoalProgressRing
        pct={row.pct}
        color={row.ringColor}
        trackColor={ringTrackColor}
        styles={styles}
      />
    </Pressable>
  );
}

const CHART_TABS: { id: ChartTab; label: string }[] = [
  { id: 'trend', label: '资产变动' },
  { id: 'distribution', label: '资产分布' },
];

const DONUT_EXPLODE = 12;
const DONUT_SELECTED_SCALE = 1.08;

/** 与环形图绘制共用，保证质心用于面板左右判断时一致 */
function getDonutPieCurves(
  slices: DonutSlice[],
  width: number,
  ringSize: number
) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const outer = Math.min(ringSize * 0.42, width * 0.38);
  const inner = outer * 0.58;
  const curves =
    total > 0
      ? Pie({
          center: [0, 0],
          r: inner,
          R: outer,
          data: slices,
          accessor: (x: DonutSlice) => x.value,
        }).curves
      : [];
  return { curves, total, outer, inner };
}

/** 扇区质心在环心坐标系中：x < 0 为左半环，明细贴左侧 */
function getCentroidForCategory(
  slices: DonutSlice[],
  category: AssetCategory,
  width: number,
  ringSize: number
): [number, number] | null {
  const { curves } = getDonutPieCurves(slices, width, ringSize);
  const hit = curves.find((c) => c.item.category === category);
  return hit ? hit.sector.centroid : null;
}

function DistributionDonut({
  slices,
  width,
  ringSize,
  selectedCategory,
  onToggleCategory,
}: {
  slices: DonutSlice[];
  width: number;
  ringSize: number;
  selectedCategory: AssetCategory | null;
  onToggleCategory: (category: AssetCategory) => void;
}) {
  const { curves, total, outer } = getDonutPieCurves(slices, width, ringSize);
  const cx = width / 2;
  const cy = ringSize / 2;
  const pctFontSize = Math.max(9, Math.min(13, Math.round(outer * 0.28)));

  return (
    <Svg width={width} height={ringSize}>
      <G x={cx} y={cy}>
        {curves.map((c) => {
          const isSel = selectedCategory === c.item.category;
          const dimOthers = selectedCategory !== null && !isSel;
          const [gx, gy] = c.sector.centroid;
          const len = Math.hypot(gx, gy) || 1;
          const pull = isSel ? DONUT_EXPLODE : 0;
          const tx = (gx / len) * pull;
          const ty = (gy / len) * pull;
          const scale = isSel ? DONUT_SELECTED_SCALE : 1;
          const transform =
            scale !== 1
              ? `translate(${tx},${ty}) translate(${gx},${gy}) scale(${scale}) translate(${-gx},${-gy})`
              : `translate(${tx},${ty})`;

          const pctRaw = total > 0 ? (100 * c.item.value) / total : 0;
          const pctLabel =
            pctRaw > 0 && pctRaw < 1 ? '<1%' : `${Math.round(pctRaw)}%`;

          return (
            <G key={`${c.item.category}-${c.index}`} transform={transform}>
              <Path
                d={c.sector.path.print()}
                fill={c.item.color}
                fillOpacity={dimOthers ? 0.38 : 1}
                stroke={isSel ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
                strokeWidth={isSel ? 2.5 : 1}
                onPress={() => onToggleCategory(c.item.category)}
                accessibilityLabel={`${c.item.name}，占比 ${pctRaw.toFixed(1)}%`}
              />
              <SvgText
                x={gx}
                y={gy}
                textAnchor="middle"
                alignmentBaseline="central"
                fontSize={pctFontSize}
                fontWeight="700"
                fill="rgba(255,255,255,0.96)"
                stroke="rgba(45, 52, 72, 0.35)"
                strokeWidth={0.35}
                fillOpacity={dimOthers ? 0.42 : 1}
                pointerEvents="none"
              >
                {pctLabel}
              </SvgText>
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

function DistributionBreakdown({
  category,
  assets,
  styles,
  primary,
  textSecondary,
}: {
  category: AssetCategory;
  assets: SimpleAsset[];
  styles: InsightsStyles;
  primary: string;
  textSecondary: string;
}) {
  const items = useMemo(() => {
    return assets
      .filter(
        (a) => a.category === category && getAssetDisplayValue(a) > 0
      )
      .sort(
        (a, b) => getAssetDisplayValue(b) - getAssetDisplayValue(a)
      );
  }, [assets, category]);

  return (
    <View style={styles.breakdownCard}>
      <Text
        style={[styles.breakdownTitle, { color: primary }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {CATEGORY_LABEL_ZH[category]} · 明细
      </Text>
      <ScrollView
        nestedScrollEnabled
        style={styles.breakdownScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {items.map((a) => {
          const v = getAssetDisplayValue(a);
          const cur = getAssetCurrency(a);
          return (
            <View key={a.id} style={styles.breakdownRow}>
              <Text
                style={[styles.breakdownName, { color: primary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {a.name}
              </Text>
              <Text
                style={[styles.breakdownValue, { color: textSecondary }]}
                numberOfLines={1}
              >
                {formatMoney(v, cur)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function Insights() {
  const { theme } = useAppPalette();
  const styles = useMemo(() => createInsightsStyles(theme), [theme]);
  const textSecondary = useMemo(
    () => rgbaFromHex(theme.primary, 0.65),
    [theme.primary]
  );
  const textMuted = useMemo(
    () => rgbaFromHex(theme.primary, 0.5),
    [theme.primary]
  );
  const ringTrackColor = useMemo(
    () => rgbaFromHex(theme.primary, 0.14),
    [theme.primary]
  );

  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartTab, setChartTab] = useState<ChartTab>('trend');
  const [chartTabSeeded, setChartTabSeeded] = useState(false);
  const [selectedDistributionCategory, setSelectedDistributionCategory] =
    useState<AssetCategory | null>(null);

  const chartHeight = useMemo(() => {
    const h = Math.round(windowHeight * 0.33);
    return Math.min(320, Math.max(200, h));
  }, [windowHeight]);

  const chartWidth = useMemo(
    () => Math.max(260, windowWidth - 48 - 32),
    [windowWidth]
  );

  /** 环形图 SVG 高度（与折线图区域视觉接近） */
  const donutRingHeight = useMemo(
    () => Math.min(chartHeight, Math.round(chartWidth * 0.52)),
    [chartHeight, chartWidth]
  );

  /** 中间固定槽宽放环形图，两侧等分留白/明细（与 paths-js 质心 x 轴对齐） */
  const donutPainterWidth = useMemo(
    () =>
      Math.max(
        200,
        Math.min(Math.floor(chartWidth * 0.48), Math.floor(chartWidth - 32))
      ),
    [chartWidth]
  );

  const toggleDistributionCategory = useCallback((category: AssetCategory) => {
    setSelectedDistributionCategory((prev) =>
      prev === category ? null : category
    );
  }, []);

  const chartLabelColor = useMemo(
    () => rgbaFromHex(theme.primary, 0.55),
    [theme.primary]
  );

  const chartConfig = useMemo(
    () => ({
      backgroundColor: '#FFFFFF',
      backgroundGradientFrom: '#FFFFFF',
      backgroundGradientTo: '#F4F6FB',
      backgroundGradientFromOpacity: 1,
      backgroundGradientToOpacity: 1,
      color: (_opacity = 1) => theme.chartLine,
      labelColor: () => chartLabelColor,
      strokeWidth: 2.5,
      decimalPlaces: 0,
      fillShadowGradient: theme.chartFillTop,
      fillShadowGradientOpacity: 1,
      fillShadowGradientFrom: theme.chartFillTop,
      fillShadowGradientFromOpacity: 0.55,
      fillShadowGradientTo: theme.chartFillBottom,
      fillShadowGradientToOpacity: 0.08,
      propsForBackgroundLines: {
        stroke: theme.chartGridStroke,
        strokeWidth: 1,
        strokeDasharray: '0',
      },
      propsForLabels: {
        fontSize: 11,
      },
      propsForVerticalLabels: {
        fontSize: 11,
      },
    }),
    [theme, chartLabelColor]
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [localSnaps, localAssets] = await Promise.all([
            getSnapshots(),
            getAssets(),
          ]);
          if (!cancelled) {
            setSnapshots(localSnaps);
            setAssets(localAssets);
            setLoading(false);
          }
        } catch {
          if (!cancelled) {
            setSnapshots([]);
            setAssets([]);
            setLoading(false);
          }
        }
        if (cancelled) return;
        try {
          await syncNetWorthFromMarket();
          const [snaps, ass] = await Promise.all([getSnapshots(), getAssets()]);
          if (!cancelled) {
            setSnapshots(snaps);
            setAssets(ass);
          }
        } catch {
          /* 保留已显示 */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const chartData = toChartData(snapshots);
  const hasSnapshotTrend =
    chartData.labels.length > 0 && chartData.datasets[0].data.length > 0;
  const hasAssets = assets.length > 0;
  const donutSlices = useMemo(
    () => buildDonutSlices(assets, theme.categoryAccents),
    [assets, theme.categoryAccents]
  );
  const donutTotal = donutSlices.reduce((s, x) => s + x.value, 0);
  const goalRows = useMemo(
    () =>
      buildGoalProgressRows(assets, theme.goalRingColors, theme.primary),
    [assets, theme.goalRingColors, theme.primary]
  );

  /** 选中扇区质心在环左侧 → 明细在左，否则在右 */
  /** 展开明细时略缩环宽，把横向空间让给文字（与绘图、左右判断共用同一宽度） */
  const effectiveDonutWidth = useMemo(
    () =>
      selectedDistributionCategory
        ? Math.max(168, donutPainterWidth - 36)
        : donutPainterWidth,
    [selectedDistributionCategory, donutPainterWidth]
  );

  const distributionPanelSide = useMemo<'left' | 'right'>(() => {
    if (!selectedDistributionCategory || donutSlices.length === 0)
      return 'right';
    const c = getCentroidForCategory(
      donutSlices,
      selectedDistributionCategory,
      effectiveDonutWidth,
      donutRingHeight
    );
    if (!c) return 'right';
    return c[0] < 0 ? 'left' : 'right';
  }, [
    selectedDistributionCategory,
    donutSlices,
    effectiveDonutWidth,
    donutRingHeight,
  ]);

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const dailyChange = getDailyChange(snapshots);

  const showChartChrome = hasSnapshotTrend || hasAssets;
  const chartBlockMinHeight = chartHeight + 24;

  const distributionPanelOpen = !!selectedDistributionCategory;

  /** 仅有持仓、无快照时默认打开分布，避免落在不可用的「资产变动」 */
  useEffect(() => {
    if (loading || chartTabSeeded) return;
    if (!hasSnapshotTrend && hasAssets) setChartTab('distribution');
    setChartTabSeeded(true);
  }, [loading, hasSnapshotTrend, hasAssets, chartTabSeeded]);

  useEffect(() => {
    if (chartTab !== 'distribution') setSelectedDistributionCategory(null);
  }, [chartTab]);

  useEffect(() => {
    if (
      selectedDistributionCategory &&
      !donutSlices.some((s) => s.category === selectedDistributionCategory)
    ) {
      setSelectedDistributionCategory(null);
    }
  }, [donutSlices, selectedDistributionCategory]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={[styles.cardKicker, { color: textSecondary }]}>
            未汇率折算合计
          </Text>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.hint, { color: textSecondary }]}>
                加载中…
              </Text>
            </View>
          ) : !hasSnapshotTrend && !hasAssets ? (
            <Text style={[styles.emptyText, { color: textSecondary }]}>
              暂无快照与持仓。在 Dashboard 添加资产并同步行情后会显示走势与分布。
            </Text>
          ) : (
            <>
              {hasSnapshotTrend ? (
                <>
                  <Text style={[styles.currentValue, { color: theme.primary }]}>
                    {latest ? formatUnconvertedTotal(latest.totalValue) : ''}
                  </Text>
                  <Text style={[styles.unconvertedHint, { color: textMuted }]}>
                    各币种数值直接相加，非单一货币
                  </Text>
                  {dailyChange && (
                    <Text
                      style={[
                        styles.changeText,
                        dailyChange.diff > 0 && { color: '#22A06B' },
                        dailyChange.diff < 0 && { color: '#DC2626' },
                        dailyChange.diff === 0 && { color: textSecondary },
                      ]}
                    >
                      较上一快照 {formatChange(dailyChange.diff, dailyChange.pct)}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={[styles.snapshotFallback, { color: textSecondary }]}>
                  暂无净值快照。在 Dashboard 同步行情后可查看资产变动曲线；下方可查看当前持仓分布。
                </Text>
              )}

              {showChartChrome && (
                <View style={styles.chartSection}>
                  <View style={styles.tabRow}>
                    {CHART_TABS.map((tab) => {
                      const disabled =
                        tab.id === 'trend' ? !hasSnapshotTrend : !hasAssets;
                      return (
                        <Pressable
                          key={tab.id}
                          accessibilityRole="button"
                          disabled={disabled}
                          onPress={() => setChartTab(tab.id)}
                          style={({ pressed }) => [
                            styles.tabChip,
                            chartTab === tab.id && styles.tabChipActive,
                            disabled && styles.tabChipDisabled,
                            pressed && !disabled && styles.tabChipPressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.tabChipText,
                              chartTab === tab.id && styles.tabChipTextActive,
                              disabled && styles.tabChipTextDisabled,
                            ]}
                          >
                            {tab.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View
                    style={[
                      styles.chartSurface,
                      {
                        minHeight: chartBlockMinHeight,
                        overflow:
                          chartTab === 'distribution' ? 'visible' : 'hidden',
                      },
                    ]}
                  >
                    {chartTab === 'trend' && hasSnapshotTrend && (
                      <>
                        <View style={styles.inlineLegendRow}>
                          <View
                            style={[
                              styles.legendDot,
                              { backgroundColor: theme.chartLine },
                            ]}
                          />
                          <Text style={[styles.legendLabel, { color: textSecondary }]}>
                            净值走势
                          </Text>
                        </View>
                        <LineChart
                          data={chartData}
                          width={chartWidth}
                          height={chartHeight}
                          chartConfig={chartConfig}
                          bezier
                          withShadow
                          withDots={false}
                          withInnerLines
                          withOuterLines={false}
                          withVerticalLines={false}
                          withHorizontalLines
                          segments={4}
                          style={styles.chart}
                          fromZero={false}
                        />
                      </>
                    )}

                    {chartTab === 'trend' && !hasSnapshotTrend && (
                      <View style={[styles.chartPlaceholder, { minHeight: chartHeight }]}>
                        <Text style={[styles.placeholderText, { color: textMuted }]}>
                          暂无走势数据
                        </Text>
                      </View>
                    )}

                    {chartTab === 'distribution' && donutSlices.length > 0 && (
                      <View style={styles.donutBlock}>
                        <View style={styles.donutInteractiveRow}>
                          <View
                            style={[
                              styles.donutWing,
                              styles.donutWingLeft,
                              !distributionPanelOpen && styles.donutWingBalanced,
                              distributionPanelOpen &&
                                distributionPanelSide === 'left' &&
                                styles.donutWingMajor,
                              distributionPanelOpen &&
                                distributionPanelSide === 'right' &&
                                styles.donutWingMinor,
                            ]}
                          >
                            {selectedDistributionCategory &&
                            distributionPanelSide === 'left' ? (
                              <DistributionBreakdown
                                category={selectedDistributionCategory}
                                assets={assets}
                                styles={styles}
                                primary={theme.primary}
                                textSecondary={textSecondary}
                              />
                            ) : null}
                          </View>
                          <View
                            style={[
                              styles.donutCenter,
                              { width: effectiveDonutWidth },
                            ]}
                          >
                            <DistributionDonut
                              slices={donutSlices}
                              width={effectiveDonutWidth}
                              ringSize={donutRingHeight}
                              selectedCategory={selectedDistributionCategory}
                              onToggleCategory={toggleDistributionCategory}
                            />
                          </View>
                          <View
                            style={[
                              styles.donutWing,
                              styles.donutWingRight,
                              !distributionPanelOpen && styles.donutWingBalanced,
                              distributionPanelOpen &&
                                distributionPanelSide === 'right' &&
                                styles.donutWingMajor,
                              distributionPanelOpen &&
                                distributionPanelSide === 'left' &&
                                styles.donutWingMinor,
                            ]}
                          >
                            {selectedDistributionCategory &&
                            distributionPanelSide === 'right' ? (
                              <DistributionBreakdown
                                category={selectedDistributionCategory}
                                assets={assets}
                                styles={styles}
                                primary={theme.primary}
                                textSecondary={textSecondary}
                              />
                            ) : null}
                          </View>
                        </View>
                        <Text style={[styles.donutHint, { color: textMuted }]}>
                          点击环上色块查看大类明细 · 按展示市值汇总，多币种未折算
                        </Text>
                        <View style={styles.donutLegend}>
                          {donutSlices.map((s) => {
                            const pct =
                              donutTotal > 0 ? (s.value / donutTotal) * 100 : 0;
                            const pctLabel =
                              pct < 0.1 && pct > 0 ? '<0.1%' : `${pct.toFixed(1)}%`;
                            const active =
                              selectedDistributionCategory === s.category;
                            return (
                              <Pressable
                                key={s.category}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                onPress={() => toggleDistributionCategory(s.category)}
                                style={({ pressed }) => [
                                  styles.donutLegendRow,
                                  active && styles.donutLegendRowActive,
                                  pressed && styles.donutLegendRowPressed,
                                ]}
                              >
                                <View
                                  style={[
                                    styles.legendDot,
                                    { backgroundColor: s.color },
                                  ]}
                                />
                                <Text
                                  style={[
                                    styles.donutLegendName,
                                    { color: theme.primary },
                                  ]}
                                >
                                  {s.name}
                                </Text>
                                <Text
                                  style={[
                                    styles.donutLegendPct,
                                    { color: textSecondary },
                                  ]}
                                >
                                  {pctLabel}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {chartTab === 'distribution' && donutSlices.length === 0 && (
                      <View style={[styles.chartPlaceholder, { minHeight: chartHeight }]}>
                        <Text style={[styles.placeholderText, { color: textMuted }]}>
                          暂无持仓或市值均为 0
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {!loading && hasAssets ? (
                <View style={styles.goalsSection}>
                  <Text style={[styles.goalsSectionTitle, { color: theme.primary }]}>
                    目标进度
                  </Text>
                  {goalRows.length === 0 ? (
                    <Text style={[styles.goalsEmpty, { color: textMuted }]}>
                      在资产编辑中展开「用途与目标」并填写目标金额后，将在此显示完成度。
                    </Text>
                  ) : (
                    goalRows.map((row) => (
                      <GoalProgressCard
                        key={row.id}
                        row={row}
                        styles={styles}
                        textSecondary={textSecondary}
                        textMuted={textMuted}
                        primary={theme.primary}
                        ringTrackColor={ringTrackColor}
                      />
                    ))
                  )}
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
