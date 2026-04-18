/**
 * Insights 页样式工厂：随配色主题变化，杂志海报风。
 */

import { AppFont } from '@/lib/app-fonts';
import type { AppPaletteTheme } from '@/lib/app-palette';
import { pickTextOnAccent, rgbaFromHex } from '@/lib/color-utils';
import { editorialAmbientWash, editorialSurfaceFill } from '@/lib/editorial-theme';
import { StyleSheet } from 'react-native';

export function createInsightsStyles(
  t: AppPaletteTheme,
  appearance: 'light' | 'dark' = 'light'
) {
  const sf = (alpha: number) => editorialSurfaceFill(t, alpha);
  const isDark = appearance === 'dark';
  
  const p = t.primary;
  const p06 = rgbaFromHex(p, 0.06);
  const p08 = rgbaFromHex(p, 0.08);
  const p10 = rgbaFromHex(p, 0.1);
  const p14 = rgbaFromHex(p, 0.14);
  const p65 = rgbaFromHex(p, 0.65);

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.pageBg,
    },
    decorWrap: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    decorBlob: {
      position: 'absolute',
      borderRadius: 999,
    },
    dashboardAmbient: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: editorialAmbientWash(t),
    },
    scroll: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    scrollContent: {
      paddingHorizontal: 0,
      paddingTop: 0,
      gap: 0,
    },
    
    /** Hero Poster Stage — 高度由 insights 页按屏高约 25% 传入 */
    heroPoster: {
      position: 'relative',
      width: '100%',
      backgroundColor: 'transparent',
    },
    mastheadBlock: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      paddingHorizontal: 28,
      /** 下移主标题与副标题（DAYBREAK / INSIGHTS & ANALYSIS） */
      paddingTop: 86,
      zIndex: 2,
    },
    supportBlock: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: '32%',
      height: '100%',
      zIndex: 1,
    },
    mastheadTitle: {
      fontFamily: AppFont.displayBold,
      fontSize: 60,
      lineHeight: 60,
      letterSpacing: -1.75,
      textTransform: 'uppercase',
      color: p,
    },
    mastheadSub: {
      fontFamily: AppFont.medium,
      fontSize: 13,
      letterSpacing: 1.65,
      textTransform: 'uppercase',
      color: p,
      marginTop: 6,
    },
    heroNetWorthRow: {
      position: 'absolute',
      bottom: 20,
      left: 28,
      right: 28,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    heroMetricLabel: {
      fontFamily: AppFont.medium,
      fontSize: 14,
      letterSpacing: 1.65,
      textTransform: 'uppercase',
      color: p,
    },
    heroMetricValue: {
      fontFamily: AppFont.displayBold,
      fontSize: 38,
      fontWeight: '800',
      letterSpacing: -0.9,
      color: p,
    },

    /** Segmented Tabs */
    segmentedBar: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      paddingVertical: 16,
      backgroundColor: 'transparent',
      gap: 0,
      justifyContent: 'space-between',
    },
    segmentedTab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
    },
    segmentedActivePill: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 4,
      right: 4,
      borderRadius: 6,
      backgroundColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    segmentedText: {
      fontFamily: AppFont.medium,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      zIndex: 2,
    },
    
    /** Chart Poster */
    chartPoster: {
      position: 'relative',
      marginHorizontal: 16,
      backgroundColor: rgbaFromHex(p, 0.03),
      borderWidth: 1,
      borderColor: rgbaFromHex(p, 0.08),
      /** 与趋势图最小高度对齐，减少主图与下方目标卡片之间的空白 */
      minHeight: 288,
      overflow: 'hidden',
    },
    chartPosterHeader: {
      position: 'absolute',
      top: 16,
      left: 20,
      right: 20,
      zIndex: 10,
      alignItems: 'center',
    },
    chartPosterValue: {
      fontFamily: AppFont.displayBold,
      fontSize: 46,
      lineHeight: 52,
      letterSpacing: -1.2,
      color: p,
      textAlign: 'center',
    },
    chartPosterOverlayTitle: {
      fontFamily: AppFont.displayBold,
      fontSize: 42,
      letterSpacing: -1.0,
      color: p,
      position: 'absolute',
      right: 20,
      bottom: 60,
      zIndex: 10,
      textAlign: 'right',
    },
    chartPosterOverlaySubtitle: {
      fontFamily: AppFont.displayBold,
      fontSize: 48,
      letterSpacing: -1.0,
      color: p,
      position: 'absolute',
      right: 20,
      bottom: 16,
      zIndex: 10,
      textAlign: 'right',
    },

    /** Summary Blocks (Winner/Loser) */
    summaryRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 16,
      minHeight: 72,
    },
    summaryWinnerBlock: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
      justifyContent: 'center',
    },
    summaryLoserBlock: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
      justifyContent: 'center',
    },
    summaryLabel: {
      fontFamily: AppFont.medium,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    summaryValueRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    summaryName: {
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    summaryPct: {
      fontSize: 16,
      fontWeight: '600',
    },

    /** Old styles mapped */
    centered: {
      minHeight: 160,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    hint: {
      fontSize: 15,
    },
    emptyText: {
      fontSize: 15,
      lineHeight: 22,
      paddingHorizontal: 24,
      paddingVertical: 24,
      textAlign: 'center',
    },
    timeframeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      gap: 16,
      position: 'absolute',
      bottom: 12,
      zIndex: 20,
    },
    timeframeChip: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    timeframeChipText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    timeframeChipTextActiveDark: {
      color: p,
      textDecorationLine: 'underline',
    },
    chartPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 24,
      minHeight: 200,
    },
    placeholderText: {
      fontSize: 14,
      fontWeight: '500',
    },
    trendChartWrap: {
      position: 'relative',
      paddingTop: 60,
    },
    trendTooltip: {
      position: 'absolute',
      paddingVertical: 6,
      paddingHorizontal: 8,
      backgroundColor: p,
      zIndex: 30,
    },
    trendTooltipDate: {
      color: t.pageBg,
      fontSize: 10,
      fontWeight: '600',
    },
    trendTooltipValue: {
      color: t.pageBg,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    },

    /** Goals Section */
    goalsGlassInner: {
      paddingVertical: 20,
      paddingHorizontal: 24,
      backgroundColor: 'transparent',
    },
    goalsSectionTitle: {
      fontFamily: AppFont.displayBold,
      fontSize: 22,
      marginBottom: 14,
      letterSpacing: -0.2,
      textTransform: 'uppercase',
    },
    goalsEmpty: {
      fontSize: 13,
      lineHeight: 20,
    },
    goalCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: rgbaFromHex(p, 0.04),
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginBottom: 12,
      gap: 12,
    },
    goalCardPressed: {
      opacity: 0.8,
    },
    goalIconWrap: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    goalCardMid: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    goalCardLabel: {
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    goalCardAssetName: {
      fontSize: 11,
      fontWeight: '500',
      textTransform: 'uppercase',
    },
    goalCardValues: {
      fontSize: 15,
      fontWeight: '800',
      marginTop: 4,
      letterSpacing: -0.2,
    },
    goalRingCenter: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    goalRingPct: {
      fontSize: 12,
      fontWeight: '800',
      color: p,
    },

    /** Distribution Donut specifics */
    donutBlock: {
      paddingBottom: 12,
      paddingTop: 12,
    },
    donutInteractiveRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingVertical: 12,
    },
    donutWing: { minWidth: 0 },
    donutWingBalanced: { flex: 1, maxWidth: '50%' },
    donutWingMajor: { flex: 10 },
    donutWingMinor: { flex: 1 },
    donutWingLeft: { alignItems: 'flex-end', paddingRight: 2 },
    donutWingRight: { alignItems: 'flex-start', paddingLeft: 2 },
    donutCenter: { flexShrink: 0, alignItems: 'center' },
    breakdownCard: {
      backgroundColor: rgbaFromHex(p, 0.04),
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 10,
      maxHeight: 248,
      width: '100%',
    },
    breakdownTitle: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    breakdownScroll: { maxHeight: 196 },
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 9,
    },
    breakdownName: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    breakdownValue: {
      flexShrink: 0,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'right',
    },
    donutHint: {
      fontSize: 10,
      textAlign: 'center',
      marginTop: 2,
      marginBottom: 12,
    },
    donutLegend: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 2,
    },
    donutLegendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: rgbaFromHex(p, 0.02),
      marginBottom: 2,
    },
    donutLegendRowActive: {
      backgroundColor: rgbaFromHex(p, 0.08),
    },
    donutLegendRowPressed: { opacity: 0.8 },
    donutLegendName: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    donutLegendPct: {
      fontSize: 14,
      fontWeight: '800',
      textAlign: 'right',
    },
    legendDot: { width: 12, height: 12 },

    /** ROI specifics - Editorial Poster Redesign */
    returnPanelCard: {
      paddingVertical: 24,
      paddingHorizontal: 24,
    },
    returnMastheadBlock: {
      marginBottom: 28,
    },
    returnKicker: {
      fontFamily: AppFont.displayBold,
      fontSize: 24,
      letterSpacing: -0.4,
      textTransform: 'uppercase',
      color: p,
      marginBottom: -4,
    },
    returnTitle: {
      fontFamily: AppFont.displayBold,
      fontSize: 54,
      lineHeight: 60,
      letterSpacing: -1.8,
      textTransform: 'uppercase',
      color: p,
      marginBottom: 4,
    },
    returnSubTitle: {
      fontFamily: AppFont.medium,
      fontSize: 13,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: p65,
    },
    
    /** Search Input */
    returnFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: rgbaFromHex(p, 0.2),
      borderRadius: 999,
      paddingHorizontal: 14,
      marginBottom: 16,
      minHeight: 36,
    },
    returnSearchIcon: {
      marginRight: 8,
    },
    returnSearchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: AppFont.medium,
      color: p,
      paddingVertical: 6,
      minHeight: 0,
    },
    
    /** Category Filter — 仅用户已有大类，单行均分、与资产分布色块一致 */
    returnCategoryRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      width: '100%',
      marginBottom: 24,
      gap: 6,
    },
    returnChipInRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: 999,
      borderWidth: 1.5,
    },
    returnChipTextInRow: {
      fontSize: 12,
      fontFamily: AppFont.semiBold,
      letterSpacing: 0.1,
      flexShrink: 1,
    },
    
    /** Scatter Chart */
    returnChartWrap: {
      position: 'relative',
      marginBottom: 28,
      paddingTop: 16,
      paddingBottom: 24,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: rgbaFromHex(p, 0.1),
    },
    returnTooltip: {
      position: 'absolute',
      zIndex: 20,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: rgbaFromHex(p, 0.95),
      borderRadius: 8,
      maxWidth: 260,
    },
    returnTooltipLine: {
      color: t.pageBg,
      fontSize: 11,
      marginBottom: 4,
    },
    returnTooltipTitle: {
      color: t.pageBg,
      fontSize: 14,
      fontFamily: AppFont.semiBold,
      textTransform: 'uppercase',
      marginBottom: 6,
    },

    /** Editorial Ranked List (Replaces Data Table) */
    returnListContainer: {
      gap: 0,
      marginTop: 8,
    },
    returnListItem: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: rgbaFromHex(p, 0.14),
    },
    returnListItemLast: {
      borderBottomWidth: 0,
    },
    returnListItemLeft: {
      flex: 1,
      minWidth: 0,
      paddingRight: 0,
      justifyContent: 'center',
      zIndex: 2,
    },
    returnListItemName: {
      fontFamily: AppFont.displayBold,
      fontSize: 32,
      letterSpacing: -0.6,
      color: p,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    returnListItemMeta: {
      fontFamily: AppFont.medium,
      fontSize: 14,
      color: p65,
    },
    /**
     * 色块：宽度由面板传入；绝对定位贴右，左侧可被名称层叠（见 returnListItemLeft paddingRight）
     */
    returnListItemRightBlock: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      paddingVertical: 8,
      paddingLeft: 10,
      paddingRight: 12,
      alignItems: 'flex-end',
      justifyContent: 'center',
      minHeight: 58,
      zIndex: 1,
    },
    returnListItemValue: {
      fontFamily: AppFont.displayBold,
      fontSize: 36,
      letterSpacing: -1.0,
      color: p,
      lineHeight: 38,
      textAlign: 'right',
      alignSelf: 'stretch',
    },
    returnListItemValueLabel: {
      fontFamily: AppFont.medium,
      fontSize: 11,
      color: rgbaFromHex(p, 0.7),
      marginTop: 2,
      textAlign: 'right',
      alignSelf: 'stretch',
    },
    
    /** 底部：hidden 说明（左）+ Hide Invalid 开关（右） */
    returnFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 20,
      gap: 12,
    },
    returnFooterHint: {
      flex: 1,
      minWidth: 0,
      fontSize: 12,
      fontFamily: AppFont.medium,
      textAlign: 'left',
      lineHeight: 18,
    },
    returnFooterSwitchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
      gap: 8,
    },
    returnFooterSwitchLabel: {
      fontSize: 11,
      fontFamily: AppFont.medium,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });
}

export type InsightsStyles = ReturnType<typeof createInsightsStyles>;
