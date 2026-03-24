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

  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 24,
    },
    card: {
      borderRadius: 22,
      padding: 20,
      backgroundColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 4,
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
      fontSize: 34,
      fontWeight: '700',
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    unconvertedHint: {
      fontSize: 12,
      marginBottom: 6,
      lineHeight: 17,
    },
    changeText: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 20,
    },
    chartSection: {
      marginTop: 4,
    },
    goalsSection: {
      marginTop: 22,
      paddingTop: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: p14,
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
      backgroundColor: p06,
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginBottom: 10,
      gap: 12,
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
      marginBottom: 14,
    },
    tabChip: {
      flex: 1,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p08,
    },
    tabChipActive: {
      backgroundColor: t.primary,
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
    chartSurface: {
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: '#FFFFFF',
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
      marginLeft: 14,
      marginRight: 0,
      paddingTop: 28,
      paddingRight: 16,
      paddingBottom: 4,
      borderRadius: 18,
    },
    trendChartWrap: {
      position: 'relative',
      paddingLeft: 10,
      paddingRight: 4,
      paddingBottom: 6,
    },
    trendTooltip: {
      position: 'absolute',
      borderRadius: 10,
      paddingVertical: 6,
      paddingHorizontal: 8,
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
      borderRadius: 14,
      backgroundColor: p07,
      paddingHorizontal: 10,
      paddingTop: 10,
      paddingBottom: 8,
      maxHeight: 248,
      width: '100%',
      alignSelf: 'stretch',
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
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 12,
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
  });
}

export type InsightsStyles = ReturnType<typeof createInsightsStyles>;
