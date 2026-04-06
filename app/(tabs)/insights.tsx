/**
 * Insights：净值曲线、资产分布、投资回报（Tab）+ 目标进度
 */

import { GlassSurface } from '@/components/glass-surface';
import {
  DistributionBreakdown,
  DistributionDonut,
} from '@/components/insights/insights-distribution';
import { GoalProgressCard } from '@/components/insights/insights-goal-cards';
import { InsightsTrendChart } from '@/components/insights/insights-trend-tab';
import { ReturnScatterPanel } from '@/components/return-scatter-panel';
import { useAppPalette } from '@/contexts/app-palette-context';
import { formatMoney } from '@/lib/asset-value';
import { rgbaFromHex } from '@/lib/color-utils';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { loadDisplayCurrency } from '@/lib/display-currency-preference';
import { BALANCE_INK, financeDeltaColor } from '@/lib/finance-colors';
import {
  getCachedFxUsdRates,
  type FxUsdMidRates,
} from '@/lib/fx-rates';
import {
  buildAggregatedGoalRows,
  type GoalProgressDisplayRow,
} from '@/lib/goal-aggregate';
import {
  buildDonutSlices,
  filterSnapshotsByTimeframe,
  formatInsightsPnlParts,
  getCentroidForCategory,
  getDailyChangeInDisplay,
  INSIGHTS_CHART_TABS,
  snapshotDisplayTotalInDisplay,
  toTrendChartModel,
  type InsightsChartTab,
  type TrendCustomRange,
  type TrendTimeframe,
} from '@/lib/insights-model';
import { createInsightsStyles } from '@/lib/insights-styles';
import { syncNetWorthFromMarket } from '@/lib/net-worth-sync';
import { assetRepository } from '@/lib/repositories/asset-repository';
import { getSnapshots, type Snapshot } from '@/lib/snapshots';
import type { AssetCategory, SimpleAsset } from '@/types/asset';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Insights() {
  const { theme, appearance } = useAppPalette();
  const styles = useMemo(
    () => createInsightsStyles(theme, appearance),
    [theme, appearance]
  );
  const textSecondary = useMemo(
    () =>
      appearance === 'dark'
        ? 'rgba(255,255,255,0.74)'
        : rgbaFromHex(theme.primary, 0.65),
    [appearance, theme.primary]
  );
  const textMuted = useMemo(
    () =>
      appearance === 'dark'
        ? 'rgba(255,255,255,0.48)'
        : rgbaFromHex(theme.primary, 0.5),
    [appearance, theme.primary]
  );
  const ringTrackColor = useMemo(
    () => rgbaFromHex(theme.primary, 0.14),
    [theme.primary]
  );
  const decorColors = useMemo(
    () => [
      rgbaFromHex('#8EA8C8', 0.36),
      rgbaFromHex('#9EC4E8', 0.28),
      rgbaFromHex('#B8D6F0', 0.22),
    ],
    []
  );

  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  const [fxRates, setFxRates] = useState<FxUsdMidRates | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<string>('CNY');
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
  const [trendTimeframe, setTrendTimeframe] = useState<TrendTimeframe>('7D');
  const [trendCustomRange, setTrendCustomRange] =
    useState<TrendCustomRange | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const orderedSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => a.date.localeCompare(b.date)),
    [snapshots]
  );
  const trendRangeSnapshots = useMemo(() => {
    const anchor = getShanghaiDateString();
    return filterSnapshotsByTimeframe(
      orderedSnapshots,
      trendTimeframe,
      anchor,
      trendTimeframe === 'CUSTOM' ? trendCustomRange : null
    );
  }, [orderedSnapshots, trendTimeframe, trendCustomRange]);
  const trendModel = useMemo(
    () =>
      toTrendChartModel(trendRangeSnapshots, {
        displayCurrency,
        usdRates: fxRates?.rates ?? null,
      }),
    [trendRangeSnapshots, displayCurrency, fxRates]
  );

  const reloadInsightsData = useCallback(async () => {
    const [snaps, ass, cachedFx, dc] = await Promise.all([
      getSnapshots(),
      assetRepository.getAll(),
      getCachedFxUsdRates(),
      loadDisplayCurrency(),
    ]);
    setSnapshots(snaps);
    setAssets(ass);
    setFxRates(cachedFx);
    setDisplayCurrency(dc);
  }, []);

  const onRefreshInsights = useCallback(async () => {
    setRefreshing(true);
    try {
      try {
        await syncNetWorthFromMarket();
      } catch {
        /* 保留已显示 */
      }
      await reloadInsightsData();
    } finally {
      setRefreshing(false);
    }
  }, [reloadInsightsData]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [localSnaps, localAssets, cachedFx, dc] = await Promise.all([
            getSnapshots(),
            assetRepository.getAll(),
            getCachedFxUsdRates(),
            loadDisplayCurrency(),
          ]);
          if (!cancelled) {
            setSnapshots(localSnaps);
            setAssets(localAssets);
            setFxRates(cachedFx);
            setDisplayCurrency(dc);
            setLoading(false);
          }
        } catch {
          if (!cancelled) {
            setSnapshots([]);
            setAssets([]);
            setFxRates(null);
            setLoading(false);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const hasSnapshotTrend = trendModel.series.length > 0;
  const hasAnySnapshots = orderedSnapshots.length > 0;
  const hasAssets = assets.length > 0;
  const donutSlices = useMemo(
    () =>
      buildDonutSlices(
        assets,
        theme.categoryAccents,
        fxRates?.rates ?? null,
        displayCurrency
      ),
    [assets, theme.categoryAccents, fxRates, displayCurrency]
  );
  const distributionUsesFx =
    fxRates != null && fxRates.rates.CNY > 0;
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
  const dailyChange = useMemo(
    () =>
      getDailyChangeInDisplay(
        orderedSnapshots,
        displayCurrency,
        fxRates?.rates ?? null
      ),
    [orderedSnapshots, displayCurrency, fxRates]
  );

  const showChartChrome = hasAnySnapshots || hasAssets;
  const chartBlockMinHeight = chartHeight + 24;

  const distributionPanelOpen = !!selectedDistributionCategory;

  useEffect(() => {
    if (loading || chartTabSeeded) return;
    if (!hasAnySnapshots && hasAssets) setChartTab('distribution');
    setChartTabSeeded(true);
  }, [loading, hasAnySnapshots, hasAssets, chartTabSeeded]);

  useEffect(() => {
    if (chartTab !== 'distribution') setSelectedDistributionCategory(null);
  }, [chartTab]);

  useEffect(() => {
    if (chartTab !== 'trend') setTrendTip(null);
  }, [chartTab]);

  useEffect(() => {
    setTrendTip(null);
  }, [trendTimeframe, trendCustomRange]);

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
              width: 260,
              height: 280,
              top: 140,
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
              height: 220,
              bottom: 100,
              left: 10,
              backgroundColor: decorColors[2],
            },
          ]}
        />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
            backgroundColor: 'transparent',
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefreshInsights}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <GlassSurface borderRadius={34} intensity={50}>
          <View style={styles.heroCardInner}>
          <Text style={[styles.cardKicker, { color: textSecondary }]}>
            {latest && typeof latest.totalValueCny === 'number'
              ? `净值（${displayCurrency}）`
              : '净值'}
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
              暂无快照与持仓。请先在总览添加资产并同步行情，之后将显示走势与分布。
            </Text>
          ) : hasSnapshotTrend ? (
            <>
              <Text style={[styles.currentValue, { color: BALANCE_INK }]}>
                {latest
                  ? formatMoney(
                      snapshotDisplayTotalInDisplay(
                        latest,
                        displayCurrency,
                        fxRates?.rates ?? null
                      ),
                      displayCurrency
                    )
                  : ''}
              </Text>
              <Text style={[styles.unconvertedHint, { color: textMuted }]}>
                {latest && typeof latest.totalValueCny === 'number'
                  ? typeof latest.fxRateDate === 'string'
                    ? `汇率基准日 ${latest.fxRateDate}`
                    : displayCurrency === 'CNY'
                      ? '已按中间价折算为人民币'
                      : `已按中间价折算为 ${displayCurrency}`
                  : '历史或未同步汇率时为各币种数值直接相加'}
              </Text>
              {dailyChange && latest ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="在净值归因中查看当日盈亏明细"
                  onPress={() => {
                    router.push({
                      pathname: '/settings-attribution',
                      params: { focusDate: latest.date },
                    });
                  }}
                  style={styles.changeRow}
                >
                  <View style={styles.changeRowLeft}>
                    <Text style={[styles.changeLabel, { color: textSecondary }]}>
                      今日盈亏
                    </Text>
                    <View style={styles.changeValues}>
                      {(() => {
                        const pnl = formatInsightsPnlParts(
                          dailyChange.diff,
                          dailyChange.pct,
                          displayCurrency
                        );
                        const deltaC = financeDeltaColor(
                          dailyChange.diff,
                          textSecondary
                        );
                        return (
                          <>
                            <Text style={[styles.changeAmount, { color: deltaC }]}>
                              {pnl.amountText}
                            </Text>
                            <Text style={[styles.changePct, { color: deltaC }]}>
                              {pnl.pctText}
                            </Text>
                          </>
                        );
                      })()}
                    </View>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={22}
                    color={textMuted}
                  />
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text style={[styles.snapshotFallback, { color: textSecondary }]}>
              暂无净值快照。在总览同步行情后可查看资产变动曲线；下方可查看当前持仓分布。
            </Text>
          )}
          </View>
        </GlassSurface>

        {!loading && showChartChrome && (
          <GlassSurface borderRadius={28} intensity={46}>
            <View style={styles.cardGlassInner}>
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
                    {chartTab === 'trend' && (
                      <InsightsTrendChart
                        chartWidth={chartWidth}
                        chartHeight={chartHeight}
                        trendModel={trendModel}
                        styles={styles}
                        textSecondary={textSecondary}
                        textMuted={textMuted}
                        orderedSnapshots={trendRangeSnapshots}
                        trendTip={trendTip}
                        theme={theme}
                        timeframe={trendTimeframe}
                        onTimeframeChange={setTrendTimeframe}
                        customRange={trendCustomRange}
                        onCustomRangeChange={setTrendCustomRange}
                        hasChartData={hasSnapshotTrend}
                        emptyHint={
                          hasAnySnapshots
                            ? '该时间范围内暂无净值快照，可切换区间或更长范围'
                            : '暂无走势数据'
                        }
                        emptyHintColor={textMuted}
                        displayCurrency={displayCurrency}
                        usdRatesForTooltip={fxRates?.rates ?? null}
                        onDataPointClick={({ index, x, y }) => {
                          setTrendTip({ index, x, y });
                        }}
                      />
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
                                usdRates={fxRates?.rates ?? null}
                                displayCurrency={displayCurrency}
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
                                usdRates={fxRates?.rates ?? null}
                                displayCurrency={displayCurrency}
                              />
                            ) : null}
                          </View>
                        </View>
                        <Text style={[styles.donutHint, { color: textMuted }]}>
                          {distributionUsesFx
                            ? '点击环上色块查看大类明细（折合人民币）'
                            : '点击环上色块查看大类明细（各币种直接相加）'}
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
          </GlassSurface>
        )}

        {!loading && hasAssets ? (
          <GlassSurface borderRadius={26} intensity={44}>
            <View style={styles.goalsGlassInner}>
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
          </GlassSurface>
        ) : null}
      </ScrollView>
    </View>
  );
}
