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
import { useLanguage } from '@/contexts/language-context';
import { formatMoney, formatMoneyDisplayParts } from '@/lib/asset-value';
import { pickTextOnAccent, rgbaFromHex } from '@/lib/color-utils';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { themeFinanceDeltaColor } from '@/lib/finance-colors';
import {
  hasUsdAnchoredFxTable,
} from '@/lib/fx-rates';
import {
  buildAggregatedGoalRows
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
import { createInsightsStyles } from '@/lib/insights-styles';
import { computeAllReturnMetrics, isPlottableMetric } from '@/lib/investment-return-metrics';
import type { TranslationKey } from '@/lib/language';
import { numberSingleLineTextProps } from '@/lib/numeric-display-one-line';
import { useAppStore } from '@/lib/store/app-store';
import {
  useAssets,
  useDisplayCurrency,
  useFxUsdRates,
  useHydrated,
  useSnapshots,
  useSyncing,
} from '@/lib/store/selectors';
import type { AssetCategory } from '@/types/asset';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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
  const { t } = useLanguage();
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

  /** 资产变动下「盈利最多 / 亏损最多」：底随主题主色，边随涨跌语义色 */
  const summaryWinnerSurface = useMemo(
    () => ({
      backgroundColor:
        appearance === 'dark'
          ? rgbaFromHex(theme.primary, 0.22)
          : rgbaFromHex(theme.primary, 0.07),
      borderWidth: 1,
      borderColor: rgbaFromHex(theme.statusPositive, 0.42),
    }),
    [appearance, theme.primary, theme.statusPositive]
  );
  const summaryLoserSurface = useMemo(
    () => ({
      backgroundColor:
        appearance === 'dark'
          ? rgbaFromHex(theme.primary, 0.22)
          : rgbaFromHex(theme.primary, 0.07),
      borderWidth: 1,
      borderColor: rgbaFromHex(theme.statusNegative, 0.42),
    }),
    [appearance, theme.primary, theme.statusNegative]
  );

  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  /** 表头区域总高 = 屏高 25%；铺进刘海后色块主体高 = 25% − insets.top */
  const heroPosterHeight = useMemo(() => {
    const band = Math.round(windowHeight * 0.25);
    if (band <= 0) return 160;
    return Math.max(band - insets.top, 1);
  }, [windowHeight, insets.top]);

  const hydrated = useHydrated();
  const snapshots = useSnapshots();
  const assets = useAssets();
  const fxRates = useFxUsdRates();
  const displayCurrency = useDisplayCurrency();
  const refreshing = useSyncing();

  const [chartTab, setChartTab] = useState<InsightsChartTab>('trend');
  const [chartTabSeeded, setChartTabSeeded] = useState(false);
  const [selectedDistributionCategory, setSelectedDistributionCategory] = useState<AssetCategory | null>(null);
  const [trendTip, setTrendTip] = useState<{ index: number; x: number; y: number } | null>(null);
  const [trendTimeframe, setTrendTimeframe] = useState<TrendTimeframe>('ALL');
  const [trendCustomRange, setTrendCustomRange] = useState<TrendCustomRange | null>(null);

  const chartHeight = useMemo(() => {
    const h = Math.round(windowHeight * 0.38);
    return Math.min(380, Math.max(280, h));
  }, [windowHeight]);

  /**
   * 走势区高度：masthead 占位 + 与 `insights-trend-tab` 内期间行/图间距压缩后，
   * 把省下的纵向往 Svg 高度回收（见 trendChartWrap paddingTop、期间行 padding）。
   */
  const trendChartPlotHeight = useMemo(
    () => Math.max(235, chartHeight - 68),
    [chartHeight]
  );

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

  const onRefreshInsights = useCallback(async () => {
    /** 强制刷新（绕节流）；store 自动同步 snapshots / assets / fxRates */
    await useAppStore.getState().syncNetWorthFromMarket();
  }, []);

  const hasSnapshotTrend = trendModel.series.length > 0;
  const hasAnySnapshots = orderedSnapshots.length > 0;
  const hasAssets = assets.length > 0;
  
  const donutSlices = useMemo(
    () => buildDonutSlices(assets, theme.categoryAccents, fxRates?.rates ?? null, displayCurrency),
    [assets, theme.categoryAccents, fxRates, displayCurrency]
  );
  const distributionUsesFx =
    fxRates != null && hasUsdAnchoredFxTable(fxRates.rates);
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
    if (!hydrated || chartTabSeeded) return;
    if (!hasAnySnapshots && hasAssets) setChartTab('distribution');
    setChartTabSeeded(true);
  }, [hydrated, hasAnySnapshots, hasAssets, chartTabSeeded]);

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

  const currentNetWorth = latest
    ? formatMoney(
        snapshotDisplayTotalInDisplay(
          latest,
          displayCurrency,
          fxRates?.rates ?? null
        ),
        displayCurrency
      )
    : '—';

  const heroNetWorthParts = useMemo(() => {
    if (!latest) return null;
    const n = snapshotDisplayTotalInDisplay(
      latest,
      displayCurrency,
      fxRates?.rates ?? null
    );
    if (!Number.isFinite(n)) return null;
    return formatMoneyDisplayParts(n, displayCurrency);
  }, [latest, displayCurrency, fxRates]);

  if (!hydrated) {
    return (
      <View style={styles.screen}>
        <View style={styles.dashboardAmbient} pointerEvents="none" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

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
          {
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefreshInsights()}
            tintColor={theme.primary}
            title={Platform.OS === 'ios' ? t('common.loading') : undefined}
            titleColor={textMuted}
            colors={[theme.primary]}
            progressBackgroundColor={
              appearance === 'dark' ? 'rgba(32,32,38,0.98)' : '#ffffff'
            }
          />
        }
      >
        {/* Editorial Masthead：背景铺满至状态栏/刘海，文案用 paddingTop 避让 */}
        <View style={[styles.heroPoster, { height: heroPosterHeight + insets.top }]}>
          <View style={[styles.supportBlock, { backgroundColor: supportBlockColor }]} />
          <View
            style={[
              styles.mastheadBlock,
              {
                backgroundColor: mastheadBlockColor,
                /** 单行全宽大标题占位（约一行 display + 与副标题间距） */
                paddingTop: insets.top + 70,
              },
            ]}
          >
            <Text style={styles.mastheadSub}>INSIGHTS & ANALYSIS</Text>
          </View>
          <Text
            style={[
              styles.mastheadTitle,
              styles.mastheadTitleOverBlocks,
              { top: insets.top + 8 },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.35}
          >
            ASSETUP
          </Text>
          <View style={styles.heroNetWorthFooter}>
            <Text style={styles.heroMetricLabel}>{t('insights.totalValue')}</Text>
            <View style={styles.heroNetWorthValueWrap}>
              {heroNetWorthParts ? (
                <Text
                  {...numberSingleLineTextProps}
                  minimumFontScale={displayCurrency === 'CNY' ? 0.24 : 0.48}
                  style={{ textAlign: 'right', width: '100%' }}
                >
                  <Text style={styles.heroMetricValue}>
                    {heroNetWorthParts.leading}
                    {heroNetWorthParts.integer}
                  </Text>
                  <Text style={styles.heroMetricFraction}>
                    {heroNetWorthParts.fraction}
                  </Text>
                </Text>
              ) : (
                <Text
                  numberOfLines={1}
                  style={[styles.heroMetricValue, { textAlign: 'right', width: '100%' }]}
                >
                  —
                </Text>
              )}
            </View>
          </View>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 8,
              backgroundColor: mutedBlock,
              zIndex: 3,
            }}
          />
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
                <Text
                  style={[
                    styles.segmentedText,
                    {
                      /** 选中态药丸为白底，字色须按白底对比（深色模式 primary 常为浅色） */
                      color: active
                        ? pickTextOnAccent('#FFFFFF')
                        : disabled
                          ? rgbaFromHex(inkColor, 0.3)
                          : inkSoft,
                    },
                  ]}
                >
                  {tab.id === 'trend'
                    ? t('insights.tab.trend')
                    : tab.id === 'distribution'
                      ? t('insights.tab.distribution')
                      : t('insights.tab.returns')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Poster Chart Area */}
        <View style={styles.chartPoster}>

          {chartTab === 'trend' && (
            <View style={{ flex: 1, paddingTop: 10 }}>
              <View
                style={[
                  styles.returnMastheadBlock,
                  {
                    marginBottom: 14,
                    alignSelf: 'stretch',
                    alignItems: 'flex-end',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.returnKicker,
                    { color: textSecondary, width: '100%', textAlign: 'right' },
                  ]}
                >
                  NET WORTH
                </Text>
                <Text
                  style={[
                    styles.returnTitle,
                    { color: theme.primary, width: '100%', textAlign: 'right' },
                  ]}
                >
                  ASSET CHANGE
                </Text>
                <Text
                  style={[
                    styles.returnSubTitle,
                    { color: textSecondary, width: '100%', textAlign: 'right' },
                  ]}
                >
                  SNAPSHOTS & RANGE
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  minHeight: 0,
                  justifyContent: 'flex-end',
                  position: 'relative',
                }}
              >
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
                    <Text
                      {...numberSingleLineTextProps}
                      minimumFontScale={0.35}
                      style={[
                        styles.chartPosterValue,
                        { fontSize: 32, width: 'auto', textAlign: 'right', lineHeight: 36 },
                      ]}
                    >
                      {posterValue}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: inkColor,
                        letterSpacing: 0,
                        textAlign: 'right',
                      }}
                    >
                      {posterPct}
                    </Text>
                  </View>
                )}
                <InsightsTrendChart
                  chartWidth={chartWidth}
                  chartHeight={trendChartPlotHeight}
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
                      ? t('insights.empty.trendRange')
                      : t('insights.empty.trend')
                  }
                  emptyHintColor={inkSoft}
                  displayCurrency={displayCurrency}
                  usdRatesForTooltip={fxRates?.rates ?? null}
                  onDataPointClick={({ index, x, y }) => setTrendTip({ index, x, y })}
                />
              </View>
            </View>
          )}

          {chartTab === 'distribution' && donutSlices.length > 0 && (
            <View style={styles.donutBlock}>
              <View style={styles.donutInteractiveRowWrap}>
                <View style={styles.donutInteractiveRow}>
                  <View style={[styles.donutWing, styles.donutWingLeft, !distributionPanelOpen && styles.donutWingBalanced, distributionPanelOpen && distributionPanelSide === 'left' && styles.donutWingMajor, distributionPanelOpen && distributionPanelSide === 'right' && styles.donutWingMinor]}>
                    {selectedDistributionCategory && distributionPanelSide === 'left' && (
                      <DistributionBreakdown category={selectedDistributionCategory} assets={assets} styles={styles} primary={inkColor} textSecondary={inkSoft} usdRates={fxRates?.rates ?? null} displayCurrency={displayCurrency} />
                    )}
                  </View>
                  <View
                    style={[
                      styles.donutCenter,
                      {
                        width: effectiveDonutWidth,
                        position: 'relative',
                        marginTop: 24,
                      },
                    ]}
                  >
                    <DistributionDonut
                      slices={donutSlices}
                      width={effectiveDonutWidth}
                      ringSize={donutRingHeight}
                      selectedCategory={selectedDistributionCategory}
                      onToggleCategory={toggleDistributionCategory}
                      labelInk={inkColor}
                    />
                    <View
                      pointerEvents="none"
                      style={[
                        styles.donutPosterCornerBR,
                        { opacity: 0.34, right: -70 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.returnKicker,
                          {
                            color: textSecondary,
                            textAlign: 'right',
                            fontSize: 35,
                            lineHeight: 32,
                            letterSpacing: -0.45,
                          },
                        ]}
                      >
                        BY CATEGORY
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.donutWing, styles.donutWingRight, !distributionPanelOpen && styles.donutWingBalanced, distributionPanelOpen && distributionPanelSide === 'right' && styles.donutWingMajor, distributionPanelOpen && distributionPanelSide === 'left' && styles.donutWingMinor]}>
                    {selectedDistributionCategory && distributionPanelSide === 'right' && (
                      <DistributionBreakdown category={selectedDistributionCategory} assets={assets} styles={styles} primary={inkColor} textSecondary={inkSoft} usdRates={fxRates?.rates ?? null} displayCurrency={displayCurrency} />
                    )}
                  </View>
                </View>
                <View pointerEvents="none" style={styles.donutPosterCornerTL}>
                  <View style={{ opacity: 0.60 }}>
                    <Text style={[styles.returnKicker, { color: textSecondary }]}>
                      PORTFOLIO
                    </Text>
                  </View>
                  <View style={{ opacity: 0.12 }}>
                    <Text style={[styles.returnTitle, { color: theme.primary }]}>
                      ASSET MIX
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.donutLegend}>
                {donutSlices.map((s) => {
                  const pct = donutTotal > 0 ? (s.value / donutTotal) * 100 : 0;
                  const active = selectedDistributionCategory === s.category;
                  return (
                    <Pressable key={s.category} onPress={() => toggleDistributionCategory(s.category)} style={[styles.donutLegendRow, active && styles.donutLegendRowActive]}>
                      <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                      <Text style={[styles.donutLegendName, { color: inkColor }]}>
                        {t(`asset.category.${s.category}` as TranslationKey)}
                      </Text>
                      <Text
                        {...numberSingleLineTextProps}
                        minimumFontScale={0.82}
                        style={[styles.donutLegendPct, { color: inkColor }]}
                      >
                        {pct > 0 && pct < 0.1 ? '<0.1%' : `${pct.toFixed(1)}%`}
                      </Text>
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
               <Text style={[styles.placeholderText, { color: inkSoft }]}>
                 {t('insights.empty.assets')}
               </Text>
             </View>
          )}
        </View>

        {chartTab === 'trend' && (
          <View style={{ marginHorizontal: 16, marginTop: 8, paddingBottom: 16 }}>
            {topGainer || topLoser ? (
              <View style={styles.summaryRow}>
                <View style={[styles.summaryWinnerBlock, summaryWinnerSurface]}>
                  <Text style={[styles.summaryLabel, { color: inkSoft }]}>
                    {t('insights.summary.topGainer')}
                  </Text>
                  {topGainer ? (
                    <View style={styles.summaryValueRow}>
                      <Text
                        style={[styles.summaryName, { color: inkColor, flex: 1, marginRight: 8 }]}
                        numberOfLines={2}
                      >
                        {topGainer.name}
                      </Text>
                      <Text
                        style={[
                          styles.summaryPct,
                          {
                            color: themeFinanceDeltaColor(
                              topGainer.cumulativeReturn,
                              theme.statusPositive,
                              theme.statusNegative,
                              inkSoft
                            ),
                          },
                        ]}
                      >
                        {topGainer.cumulativeReturn >= 0 ? '+' : ''}
                        {(topGainer.cumulativeReturn * 100).toFixed(2)}%
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.summaryName, { color: inkSoft }]}>—</Text>
                  )}
                </View>
                <View style={[styles.summaryLoserBlock, summaryLoserSurface]}>
                  <Text style={[styles.summaryLabel, { color: inkSoft }]}>
                    {t('insights.summary.topLoser')}
                  </Text>
                  {topLoser ? (
                    <View style={styles.summaryValueRow}>
                      <Text
                        style={[styles.summaryName, { color: inkColor, flex: 1, marginRight: 8 }]}
                        numberOfLines={2}
                      >
                        {topLoser.name}
                      </Text>
                      <Text
                        style={[
                          styles.summaryPct,
                          {
                            color: themeFinanceDeltaColor(
                              topLoser.cumulativeReturn,
                              theme.statusPositive,
                              theme.statusNegative,
                              inkSoft
                            ),
                          },
                        ]}
                      >
                        {topLoser.cumulativeReturn >= 0 ? '+' : ''}
                        {(topLoser.cumulativeReturn * 100).toFixed(2)}%
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.summaryName, { color: inkSoft }]}>—</Text>
                  )}
                </View>
              </View>
            ) : hasAssets ? (
              <Text style={{ fontSize: 13, fontWeight: '600', color: inkSoft }}>
                {t('returns.emptyValid')}
              </Text>
            ) : null}
          </View>
        )}

        {chartTab !== 'returns' && chartTab !== 'trend' && (
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
