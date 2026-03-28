/**
 * Insights：净值曲线、资产分布、投资回报（Tab）+ 目标进度
 */

import { ReturnScatterPanel } from '@/components/return-scatter-panel';
import {
  DistributionBreakdown,
  DistributionDonut,
} from '@/components/insights/insights-distribution';
import { GoalProgressCard } from '@/components/insights/insights-goal-cards';
import { InsightsTrendChart } from '@/components/insights/insights-trend-tab';
import { useAppPalette } from '@/contexts/app-palette-context';
import { formatMoney } from '@/lib/asset-value';
import {
  buildAggregatedGoalRows,
  type GoalProgressDisplayRow,
} from '@/lib/goal-aggregate';
import {
  buildDonutSlices,
  formatChange,
  getCentroidForCategory,
  getDailyChange,
  INSIGHTS_CHART_TABS,
  toTrendChartModel,
  type InsightsChartTab,
} from '@/lib/insights-model';
import { createInsightsStyles } from '@/lib/insights-styles';
import { syncNetWorthFromMarket } from '@/lib/net-worth-sync';
import { assetRepository } from '@/lib/repositories/asset-repository';
import {
  getSnapshots,
  snapshotDisplayTotal,
  type Snapshot,
} from '@/lib/snapshots';
import { rgbaFromHex } from '@/lib/color-utils';
import type { AssetCategory, SimpleAsset } from '@/types/asset';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const [chartTab, setChartTab] = useState<InsightsChartTab>('trend');
  const [chartTabSeeded, setChartTabSeeded] = useState(false);
  const [selectedDistributionCategory, setSelectedDistributionCategory] =
    useState<AssetCategory | null>(null);
  const [trendTip, setTrendTip] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);

  const chartHeight = useMemo(() => {
    const h = Math.round(windowHeight * 0.33);
    return Math.min(320, Math.max(200, h));
  }, [windowHeight]);

  const chartWidth = useMemo(() => {
    const outerPad = 24 * 2;
    const cardPad = 20 * 2;
    return Math.max(260, windowWidth - outerPad - cardPad);
  }, [windowWidth]);

  const donutRingHeight = useMemo(
    () => Math.min(chartHeight, Math.round(chartWidth * 0.52)),
    [chartHeight, chartWidth]
  );

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

  const orderedSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => a.date.localeCompare(b.date)),
    [snapshots]
  );
  const trendModel = useMemo(
    () => toTrendChartModel(orderedSnapshots),
    [orderedSnapshots]
  );
  const chartData = trendModel.data;

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
      formatYLabel: trendModel.formatYLabel,
    }),
    [theme, chartLabelColor, trendModel]
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [localSnaps, localAssets] = await Promise.all([
            getSnapshots(),
            assetRepository.getAll(),
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
          const [snaps, ass] = await Promise.all([
            getSnapshots(),
            assetRepository.getAll(),
          ]);
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
      buildAggregatedGoalRows(assets, theme.goalRingColors, theme.primary),
    [assets, theme.goalRingColors, theme.primary]
  );

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

  const latest =
    orderedSnapshots.length > 0
      ? orderedSnapshots[orderedSnapshots.length - 1]
      : null;
  const dailyChange = getDailyChange(orderedSnapshots);

  const showChartChrome = hasSnapshotTrend || hasAssets;
  const chartBlockMinHeight = chartHeight + 24;

  const distributionPanelOpen = !!selectedDistributionCategory;

  useEffect(() => {
    if (loading || chartTabSeeded) return;
    if (!hasSnapshotTrend && hasAssets) setChartTab('distribution');
    setChartTabSeeded(true);
  }, [loading, hasSnapshotTrend, hasAssets, chartTabSeeded]);

  useEffect(() => {
    if (chartTab !== 'distribution') setSelectedDistributionCategory(null);
  }, [chartTab]);

  useEffect(() => {
    if (chartTab !== 'trend') setTrendTip(null);
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
            {latest && typeof latest.totalValueCny === 'number'
              ? '折合人民币（快照）'
              : '净值快照'}
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
                    {latest
                      ? formatMoney(snapshotDisplayTotal(latest), 'CNY')
                      : ''}
                  </Text>
                  <Text style={[styles.unconvertedHint, { color: textMuted }]}>
                    {latest && typeof latest.totalValueCny === 'number'
                      ? typeof latest.fxRateDate === 'string'
                        ? `汇率基准日 ${latest.fxRateDate}（经 USD 串联）`
                        : '已按中间价折算为人民币'
                      : '历史或未同步汇率时为各币种数值直接相加'}
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
                    {INSIGHTS_CHART_TABS.map((tab) => {
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
                        minHeight:
                          chartTab === 'returns'
                            ? undefined
                            : chartBlockMinHeight,
                        overflow: 'hidden',
                      },
                    ]}
                  >
                    {chartTab === 'trend' && hasSnapshotTrend && (
                      <InsightsTrendChart
                        chartData={chartData}
                        chartWidth={chartWidth}
                        chartHeight={chartHeight}
                        chartConfig={chartConfig}
                        trendModel={trendModel}
                        styles={styles}
                        textSecondary={textSecondary}
                        orderedSnapshots={orderedSnapshots}
                        trendTip={trendTip}
                        theme={theme}
                        onDataPointClick={({ index, x, y }) => {
                          setTrendTip({ index, x, y });
                        }}
                      />
                    )}

                    {chartTab === 'trend' && !hasSnapshotTrend && (
                      <View
                        style={[styles.chartPlaceholder, { minHeight: chartHeight }]}
                      >
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
                              pct < 0.1 && pct > 0
                                ? '<0.1%'
                                : `${pct.toFixed(1)}%`;
                            const active =
                              selectedDistributionCategory === s.category;
                            return (
                              <Pressable
                                key={s.category}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                onPress={() =>
                                  toggleDistributionCategory(s.category)
                                }
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
                      <View
                        style={[styles.chartPlaceholder, { minHeight: chartHeight }]}
                      >
                        <Text style={[styles.placeholderText, { color: textMuted }]}>
                          暂无持仓或市值均为 0
                        </Text>
                      </View>
                    )}

                    {chartTab === 'returns' && hasAssets && (
                      <View style={{ paddingTop: 4, paddingBottom: 6 }}>
                        <ReturnScatterPanel
                          assets={assets}
                          theme={theme}
                          styles={styles}
                          textSecondary={textSecondary}
                          textMuted={textMuted}
                        />
                      </View>
                    )}

                    {chartTab === 'returns' && !hasAssets && (
                      <View
                        style={[styles.chartPlaceholder, { minHeight: chartHeight }]}
                      >
                        <Text style={[styles.placeholderText, { color: textMuted }]}>
                          暂无资产数据
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {!loading && hasAssets ? (
                <View style={styles.goalsSection}>
                  <Text
                    style={[styles.goalsSectionTitle, { color: theme.primary }]}
                  >
                    目标进度
                  </Text>
                  {goalRows.length === 0 ? (
                    <Text style={[styles.goalsEmpty, { color: textMuted }]}>
                      在资产编辑中展开「用途与目标」并填写目标金额后，将在此显示完成度。
                    </Text>
                  ) : (
                    goalRows.map((row: GoalProgressDisplayRow) => (
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
