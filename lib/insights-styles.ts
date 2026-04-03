/**
 * Insights 页样式工厂：随配色主题变化。
 */

import type { AppPaletteTheme } from '@/lib/app-palette';
import { rgbaFromHex } from '@/lib/color-utils';
import { StyleSheet } from 'react-native';

export function createInsightsStyles(t: AppPaletteTheme) {
  const p = t.primary;
  const p06 = rgbaFromHex(p, 0.06);
  const p07 = rgbaFromHex(p, 0.07);
  const p08 = rgbaFromHex(p, 0.08);
  const p10 = rgbaFromHex(p, 0.1);
  const p14 = rgbaFromHex(p, 0.14);
  const p18 = rgbaFromHex(p, 0.18);

  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    decorWrap: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    decorBlob: {
      position: 'absolute',
      borderRadius: 999,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 20,
      gap: 20,
    },
    /** 外层由 GlassSurface 承担圆角与模糊，内层仅留白 */
    heroCardInner: {
      paddingVertical: 26,
      paddingHorizontal: 22,
      backgroundColor: 'transparent',
    },
    /** 外层由 GlassSurface 承担模糊与描边，此处仅内边距 */
    cardGlassInner: {
      padding: 22,
      backgroundColor: 'transparent',
    },
    cardKicker: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.4,
      marginBottom: 8,
    },
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
    },
    snapshotFallback: {
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 16,
    },
    currentValue: {
      fontSize: 40,
      fontWeight: '800',
      letterSpacing: -0.85,
      marginBottom: 6,
    },
    unconvertedHint: {
      fontSize: 12,
      marginBottom: 6,
      lineHeight: 17,
    },
    changeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 12,
      marginBottom: 4,
    },
    changeRowLeft: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
    },
    changeLabel: {
      fontSize: 14,
      fontWeight: '500',
    },
    changeValues: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      gap: 8,
    },
    changeAmount: {
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.25,
    },
    changePct: {
      fontSize: 14,
      fontWeight: '600',
    },
    chartSection: {
      marginTop: 0,
    },
    goalsGlassInner: {
      paddingVertical: 20,
      paddingHorizontal: 20,
      backgroundColor: 'transparent',
    },
    goalsSectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 14,
      letterSpacing: -0.2,
    },
    goalsEmpty: {
      fontSize: 13,
      lineHeight: 20,
    },
    goalCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderRadius: 20,
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginBottom: 12,
      gap: 12,
      borderWidth: 1,
      borderColor: p10,
    },
    goalCardPressed: {
      opacity: 0.92,
    },
    goalIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    goalCardMid: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    goalCardLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
    goalCardAssetName: {
      fontSize: 11,
      fontWeight: '500',
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
      color: t.primary,
    },
    tabRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    tabChip: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.38)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.42)',
    },
    tabChipActive: {
      backgroundColor: t.primary,
      borderColor: t.primary,
    },
    tabChipPressed: {
      opacity: 0.88,
    },
    tabChipDisabled: {
      opacity: 0.4,
    },
    tabChipText: {
      fontSize: 14,
      fontWeight: '700',
      color: rgbaFromHex(p, 0.65),
    },
    tabChipTextActive: {
      color: '#FFFFFF',
    },
    tabChipTextDisabled: {
      color: rgbaFromHex(p, 0.5),
    },
    /** 已落在外层 GlassSurface 内，仅轻量衬底以区分图表区 */
    chartSurface: {
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.32)',
    },
    /** 五个区间等分整行，视觉居中对称 */
    timeframeRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'center',
      width: '100%',
      gap: 6,
      marginBottom: 12,
      paddingHorizontal: 0,
    },
    timeframeChip: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: p14,
      backgroundColor: 'rgba(255,255,255,0.82)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    timeframeChipActive: {
      borderColor: t.primary,
      backgroundColor: p08,
    },
    /** 净值曲线区间：选中为当前主题主色 + 白字 */
    timeframeChipActiveDark: {
      borderColor: t.primary,
      backgroundColor: t.primary,
    },
    timeframeChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: rgbaFromHex(p, 0.55),
    },
    timeframeChipTextActive: {
      color: t.primary,
    },
    timeframeChipTextActiveDark: {
      color: '#FFFFFF',
    },
    inlineLegendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 6,
      marginBottom: 6,
    },
    legendDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
    },
    legendLabel: {
      fontSize: 13,
      fontWeight: '500',
    },
    chart: {
      marginLeft: 0,
      marginRight: 0,
      paddingTop: 28,
      paddingRight: 0,
      paddingBottom: 4,
      borderRadius: 18,
    },
    trendChartWrap: {
      position: 'relative',
      paddingLeft: 0,
      paddingRight: 0,
      paddingBottom: 6,
    },
    trendTooltip: {
      position: 'absolute',
      borderRadius: 14,
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: 'rgba(17,24,39,0.92)',
      maxWidth: 180,
    },
    trendTooltipDate: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
    },
    trendTooltipValue: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },
    chartPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 24,
    },
    placeholderText: {
      fontSize: 14,
      fontWeight: '500',
    },
    donutBlock: {
      paddingBottom: 4,
    },
    donutInteractiveRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 0,
    },
    donutWing: {
      minWidth: 0,
    },
    donutWingBalanced: {
      flex: 1,
      maxWidth: '50%',
    },
    donutWingMajor: {
      flex: 10,
    },
    donutWingMinor: {
      flex: 1,
    },
    donutWingLeft: {
      alignItems: 'flex-end',
      paddingRight: 2,
    },
    donutWingRight: {
      alignItems: 'flex-start',
      paddingLeft: 2,
    },
    donutCenter: {
      flexShrink: 0,
      alignItems: 'center',
    },
    breakdownCard: {
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.76)',
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 10,
      maxHeight: 248,
      width: '100%',
      alignSelf: 'stretch',
      borderWidth: 1,
      borderColor: p10,
    },
    breakdownTitle: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 8,
    },
    breakdownScroll: {
      maxHeight: 196,
    },
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 7,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p14,
    },
    breakdownName: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 17,
      paddingRight: 4,
    },
    breakdownValue: {
      flexShrink: 0,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'right',
    },
    donutHint: {
      fontSize: 11,
      textAlign: 'center',
      marginTop: 2,
      marginBottom: 12,
      paddingHorizontal: 8,
    },
    donutLegend: {
      paddingHorizontal: 8,
      paddingBottom: 12,
      gap: 6,
    },
    donutLegendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: 14,
    },
    donutLegendRowActive: {
      backgroundColor: p10,
    },
    donutLegendRowPressed: {
      opacity: 0.88,
    },
    donutLegendName: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
    },
    donutLegendPct: {
      fontSize: 13,
      fontWeight: '600',
      minWidth: 48,
      textAlign: 'right',
    },
    /** 投资回报面板 */
    returnPanelCard: {
      borderRadius: 24,
      paddingVertical: 18,
      paddingHorizontal: 16,
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderWidth: 1,
      borderColor: p14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 18,
      elevation: 3,
    },
    returnKicker: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.35,
      textTransform: 'uppercase' as const,
      marginBottom: 6,
    },
    returnTitle: {
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.3,
      marginBottom: 14,
    },
    returnFilterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
      alignItems: 'center',
    },
    returnSearchInput: {
      flex: 1,
      minWidth: 140,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      fontSize: 14,
      fontWeight: '500',
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderWidth: 1,
      borderColor: p10,
    },
    returnChip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: p08,
    },
    returnChipText: {
      fontSize: 12,
      fontWeight: '700',
    },
    returnToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    returnChartWrap: {
      position: 'relative',
      marginBottom: 8,
    },
    returnTooltip: {
      position: 'absolute',
      zIndex: 20,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: 'rgba(17,24,39,0.94)',
      maxWidth: 260,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
    },
    returnTooltipLine: {
      color: '#F9FAFB',
      fontSize: 11,
      lineHeight: 16,
      marginBottom: 2,
    },
    returnTooltipTitle: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 6,
    },
    returnAxisLabel: {
      fontSize: 10,
      fontWeight: '600',
    },
    returnTableScroll: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p14,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.88)',
    },
    /** 表体默认约 4 行可见高度，其余纵向滚动查看 */
    returnTableBodyScroll: {
      maxHeight: 130,
    },
    returnTableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p14,
      backgroundColor: rgbaFromHex(p, 0.05),
      minWidth: 720,
    },
    returnTableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p14,
      minWidth: 720,
    },
    returnTh: {
      fontSize: 11,
      fontWeight: '800',
    },
    returnTd: {
      fontSize: 12,
      fontWeight: '600',
    },
    returnFooterHint: {
      fontSize: 11,
      lineHeight: 17,
      marginTop: 10,
      color: rgbaFromHex(p, 0.48),
    },
  });
}

export type InsightsStyles = ReturnType<typeof createInsightsStyles>;
