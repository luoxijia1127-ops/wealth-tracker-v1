/**
 * Insights：净值曲线、资产分布、投资回报（Tab）+ 目标进度
 * 重构版：Editorial Poster 风格
 */

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
import { editorialDecorBlobs } from '@/lib/editorial-theme';
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
  getTrendPeriodNavChangeInDisplay,
  INSIGHTS_CHART_TABS,
  snapshotDisplayTotalInDisplay,
  toTrendChartModel,
  type InsightsChartTab,
  type TrendCustomRange,
  type TrendTimeframe,
} from '@/lib/insights-model';
import { computeAllReturnMetrics, isPlottableMetric } from '@/lib/investment-return-metrics';
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
  
  // Dynamic semantic colors for poster layout
  const mastheadBlockColor = useMemo(() => rgbaFromHex(theme.swatches[1] ?? theme.primary, 0.34), [theme]);
  const supportBlockColor = useMemo(() => rgbaFromHex(theme.swatches[2] ?? theme.primary, 0.18), [theme]);
  const inkColor = theme.primary;
  const inkSoft = rgbaFromHex(theme.primary, 0.68);
  const mutedBlock = rgbaFromHex(theme.primary, 0.04);
  const segmentedBarBg = rgbaFromHex(theme.primary, 0.06);

  const textSecondary = useMemo(
    () => appearance === 'dark' ? 'rgba(255,255,255,0.74)' : rgbaFromHex(theme.primary, 0.65),
    [appearance, theme.primary]
  );
  const textMuted = useMemo(
    () => appearance === 'dark' ? 'rgba(255,255,255,0.48)' : rgbaFromHex(theme.primary, 0.5),
    [appearance, theme.primary]
  );

  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  /** 表头（DAYBREAK + 净值）约占整屏高度 27%（与 insights-styles 大字匹配） */
  const heroPosterHeight = useMemo(() => {
    const h = Math.round(windowHeight * 0.27);
    return h > 0 ? h : 196;
  }, [windowHeight]);

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  const [fxRates, setFxRates] = useState<FxUsdMidRates | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<string>('CNY');
  const [loading, setLoading] = useState(true);
  const [chartTab, setChartTab] = useState<InsightsChartTab>('trend');
  const [chartTabSeeded, setChartTabSeeded] = useState(false);
  const [selectedDistributionCategory, setSelectedDistributionCategory] = useState<AssetCategory | null>(null);
  const [trendTip, setTrendTip] = useState<{ index: number; x: number; y: number } | null>(null);
  const [trendTimeframe, setTrendTimeframe] = useState<TrendTimeframe>('ALL');
  const [trendCustomRange, setTrendCustomRange] = useState<TrendCustomRange | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const chartHeight = useMemo(() => {
    const h = Math.round(windowHeight * 0.38);
    return Math.min(380, Math.max(280, h));
  }, [windowHeight]);

  const chartWidth = useMemo(() => {
    return Math.max(260, windowWidth - 32); // marginHorizontal: 16 * 2 = 32
  }, [windowWidth]);

  const donutRingHeight = useMemo(
    () => Math.min(260, Math.round(chartWidth * 0.6)),
    [chartWidth]
  );

  const donutPainterWidth = useMemo(
    () => Math.max(200, Math.min(Math.floor(chartWidth * 0.5), Math.floor(chartWidth - 32))),
    [chartWidth]
  );

  const toggleDistributionCategory = useCallback((category: AssetCategory) => {
    setSelectedDistributionCategory((prev) => prev === category ? null : category);
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
    () => toTrendChartModel(trendRangeSnapshots, { displayCurrency, usdRates: fxRates?.rates ?? null }),
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
        // ignore
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
      return () => { cancelled = true; };
    }, [])
  );

  const hasSnapshotTrend = trendModel.series.length > 0;
  const hasAnySnapshots = orderedSnapshots.length > 0;
  const hasAssets = assets.length > 0;
  
  const donutSlices = useMemo(
    () => buildDonutSlices(assets, theme.categoryAccents, fxRates?.rates ?? null, displayCurrency),
    [assets, theme.categoryAccents, fxRates, displayCurrency]
  );
  const distributionUsesFx = fxRates != null && fxRates.rates.CNY > 0;
  const donutTotal = donutSlices.reduce((s, x) => s + x.value, 0);
  const goalRows = useMemo(
    () => buildAggregatedGoalRows(assets, theme.goalRingColors, theme.primary),
    [assets, theme.goalRingColors, theme.primary]
  );

  const effectiveDonutWidth = useMemo(
    () => selectedDistributionCategory ? Math.max(168, donutPainterWidth - 36) : donutPainterWidth,
    [selectedDistributionCategory, donutPainterWidth]
  );

  const distributionPanelSide = useMemo<'left' | 'right'>(() => {
    if (!selectedDistributionCategory || donutSlices.length === 0) return 'right';
    const c = getCentroidForCategory(donutSlices, selectedDistributionCategory, effectiveDonutWidth, donutRingHeight);
    if (!c) return 'right';
    return c[0] < 0 ? 'left' : 'right';
  }, [selectedDistributionCategory, donutSlices, effectiveDonutWidth, donutRingHeight]);

  const latest = orderedSnapshots.length > 0 ? orderedSnapshots[orderedSnapshots.length - 1] : null;
  const dailyChange = useMemo(
    () => getDailyChangeInDisplay(orderedSnapshots, displayCurrency, fxRates?.rates ?? null),
    [orderedSnapshots, displayCurrency, fxRates]
  );
  
  /**
   * 资产变动图角标：相对「区间起始日历日」的净值变动（期末 − 期初）及比例。
   * 例：锚定今日 4/18、选 7 天则起始日 4/11；期初取 date≤4/11 的最近快照，期末取区间内最后一条。
   */
  const periodChange = useMemo(() => {
    const anchor = getShanghaiDateString();
    return getTrendPeriodNavChangeInDisplay(
      orderedSnapshots,
      trendTimeframe,
      anchor,
      trendTimeframe === 'CUSTOM' ? trendCustomRange : null,
      displayCurrency,
      fxRates?.rates ?? null
    );
  }, [
    orderedSnapshots,
    trendTimeframe,
    trendCustomRange,
    displayCurrency,
    fxRates,
  ]);

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

  // Top gainer and loser placeholder logic (use real logic if available, here using mockup placeholder to fit the layout request)
  const { topGainer, topLoser } = useMemo(() => {
    if (!assets || assets.length === 0) return { topGainer: null, topLoser: null };
    const validMetrics = computeAllReturnMetrics(assets).filter(isPlottableMetric);
    if (validMetrics.length === 0) return { topGainer: null, topLoser: null };
    
    // sort by cumulativeReturn descending
    const sorted = [...validMetrics].sort((a, b) => b.cumulativeReturn - a.cumulativeReturn);
    
    return {
      topGainer: sorted[0],
      topLoser: sorted[sorted.length - 1]
    };
  }, [assets]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.dashboardAmbient} pointerEvents="none" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  const currentNetWorth = latest ? formatMoney(snapshotDisplayTotalInDisplay(latest, displayCurrency, fxRates?.rates ?? null), displayCurrency) : '—';
  
  // Dynamic poster elements based on active tab
  let posterValue = '';
  let posterPct = '';
  if (chartTab === 'trend') {
    if (periodChange) {
      const pnl = formatInsightsPnlParts(periodChange.diff, periodChange.pct, displayCurrency);
      posterValue = pnl.amountText;
      posterPct = pnl.pctText;
    } else {
      posterValue = '—';
    }
  } else if (chartTab === 'distribution') {
    posterValue = currentNetWorth;
  } else {
    posterValue = 'ROI';
  }

  return (
    <View style={styles.screen}>
      <View style={styles.dashboardAmbient} pointerEvents="none" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefreshInsights} tintColor={theme.primary} />
        }
      >
        {/* Editorial Masthead */}
        <View style={[styles.heroPoster, { height: heroPosterHeight }]}>
          <View style={[styles.supportBlock, { backgroundColor: supportBlockColor }]} />
          <View style={[styles.mastheadBlock, { backgroundColor: mastheadBlockColor }]}>
            <Text style={styles.mastheadTitle}>DAYBREAK</Text>
            <Text style={styles.mastheadSub}>INSIGHTS & ANALYSIS</Text>

            <View style={styles.heroNetWorthRow}>
              <Text style={styles.heroMetricLabel}>TOTAL VALUE</Text>
              <Text style={styles.heroMetricValue}>{currentNetWorth}</Text>
            </View>
          </View>
        </View>

        {/* Segmented Tabs */}
        <View style={[styles.segmentedBar, { backgroundColor: segmentedBarBg }]}>
          {INSIGHTS_CHART_TABS.map((tab) => {
            const disabled = tab.id === 'trend' ? !hasAnySnapshots : !hasAssets;
            const active = chartTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                disabled={disabled}
                onPress={() => setChartTab(tab.id)}
                style={styles.segmentedTab}
              >
                {active && <View style={styles.segmentedActivePill} />}
                <Text style={[
                  styles.segmentedText,
                  { color: active ? inkColor : (disabled ? rgbaFromHex(inkColor, 0.3) : inkSoft) }
                ]}>
                  {tab.id === 'trend' ? '资产变动' : tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Poster Chart Area */}
        <View style={styles.chartPoster}>

          {chartTab === 'trend' && (
             <View style={{ flex: 1, justifyContent: 'flex-end', paddingTop: 10 }}>
                {periodChange && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 52,
                      right: 24,
                      alignItems: 'flex-end',
                      zIndex: 0,
                      opacity: 0.85,
                    }}
                    pointerEvents="none"
                  >
                    <Text style={[styles.chartPosterValue, { fontSize: 32, width: 'auto', textAlign: 'right', lineHeight: 36 }]}>
                      {posterValue}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: inkColor, letterSpacing: 0, textAlign: 'right' }}>
                      {posterPct}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '500',
                        color: inkSoft,
                        textAlign: 'right',
                        marginTop: 6,
                        maxWidth: 220,
                        lineHeight: 14,
                      }}
                    >
                      区间内最新净值 vs 起点日（或该日前最近快照）
                    </Text>
                  </View>
                )}
                <InsightsTrendChart
                  chartWidth={chartWidth}
                  chartHeight={chartHeight - 10} // leave space for top value
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
                  emptyHint={hasAnySnapshots ? '当前时间段无记录' : '暂无走势数据'}
                  emptyHintColor={inkSoft}
                  displayCurrency={displayCurrency}
                  usdRatesForTooltip={fxRates?.rates ?? null}
                  onDataPointClick={({ index, x, y }) => setTrendTip({ index, x, y })}
                />
             </View>
          )}

          {chartTab === 'distribution' && donutSlices.length > 0 && (
            <View style={styles.donutBlock}>
              <View style={styles.donutInteractiveRow}>
                <View style={[styles.donutWing, styles.donutWingLeft, !distributionPanelOpen && styles.donutWingBalanced, distributionPanelOpen && distributionPanelSide === 'left' && styles.donutWingMajor, distributionPanelOpen && distributionPanelSide === 'right' && styles.donutWingMinor]}>
                  {selectedDistributionCategory && distributionPanelSide === 'left' && (
                    <DistributionBreakdown category={selectedDistributionCategory} assets={assets} styles={styles} primary={inkColor} textSecondary={inkSoft} usdRates={fxRates?.rates ?? null} displayCurrency={displayCurrency} />
                  )}
                </View>
                <View style={[styles.donutCenter, { width: effectiveDonutWidth }]}>
                  <DistributionDonut slices={donutSlices} width={effectiveDonutWidth} ringSize={donutRingHeight} selectedCategory={selectedDistributionCategory} onToggleCategory={toggleDistributionCategory} />
                </View>
                <View style={[styles.donutWing, styles.donutWingRight, !distributionPanelOpen && styles.donutWingBalanced, distributionPanelOpen && distributionPanelSide === 'right' && styles.donutWingMajor, distributionPanelOpen && distributionPanelSide === 'left' && styles.donutWingMinor]}>
                  {selectedDistributionCategory && distributionPanelSide === 'right' && (
                    <DistributionBreakdown category={selectedDistributionCategory} assets={assets} styles={styles} primary={inkColor} textSecondary={inkSoft} usdRates={fxRates?.rates ?? null} displayCurrency={displayCurrency} />
                  )}
                </View>
              </View>
              <View style={styles.donutLegend}>
                {donutSlices.map((s) => {
                  const pct = donutTotal > 0 ? (s.value / donutTotal) * 100 : 0;
                  const active = selectedDistributionCategory === s.category;
                  return (
                    <Pressable key={s.category} onPress={() => toggleDistributionCategory(s.category)} style={[styles.donutLegendRow, active && styles.donutLegendRowActive]}>
                      <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                      <Text style={[styles.donutLegendName, { color: inkColor }]}>{s.name}</Text>
                      <Text style={[styles.donutLegendPct, { color: inkColor }]}>{pct.toFixed(1)}%</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {chartTab === 'returns' && hasAssets && (
             <ReturnScatterPanel
                assets={assets}
                theme={theme}
                styles={styles}
                textSecondary={inkSoft}
                textMuted={rgbaFromHex(inkColor, 0.4)}
             />
          )}

          {!hasAssets && chartTab !== 'trend' && (
             <View style={styles.chartPlaceholder}>
               <Text style={[styles.placeholderText, { color: inkSoft }]}>暂无数据</Text>
             </View>
          )}
        </View>

        {chartTab !== 'returns' && (
          <View style={{ marginHorizontal: 16, marginTop: 8, gap: 0, paddingBottom: 16 }}>
             {goalRows.map((row) => (
                <GoalProgressCard
                  key={row.id}
                  row={row}
                  styles={styles}
                  textSecondary={textSecondary}
                  textMuted={textMuted}
                  primary={inkColor}
                  ringTrackColor={rgbaFromHex(inkColor, 0.08)}
                />
             ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}
