/**
 * Dashboard 样式工厂：随配色主题变化。
 */

import type { AppPaletteTheme } from '@/lib/app-palette';
import { rgbaFromHex } from '@/lib/color-utils';
import { Platform, StyleSheet } from 'react-native';

export function createDashboardStyles(t: AppPaletteTheme) {
  const p = t.primary;
  const p65 = rgbaFromHex(p, 0.65);
  const p55 = rgbaFromHex(p, 0.55);
  const p50 = rgbaFromHex(p, 0.5);
  const p48 = rgbaFromHex(p, 0.48);
  const p58 = rgbaFromHex(p, 0.58);
  const p40 = rgbaFromHex(p, 0.4);
  const p08 = rgbaFromHex(p, 0.08);
  const p10 = rgbaFromHex(p, 0.1);

  return StyleSheet.create({
    screenWrapper: {
      flex: 1,
      backgroundColor: t.pageBg,
    },
    /** 轻冷色氛围层（铺在 pageBg 之上，供玻璃卡片折射） */
    dashboardAmbient: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(120, 145, 185, 0.09)',
    },
    decorWrap: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    decorBlob: {
      position: 'absolute',
      borderRadius: 999,
    },
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingBottom: 8,
      backgroundColor: 'transparent',
    },
    headerTitle: {
      fontSize: 30,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: t.primary,
    },
    /** 外层光晕（仅一层阴影，避免与玻璃层叠成「双圆」） */
    headerAddFabOuter: {
      borderRadius: 26,
      backgroundColor: 'transparent',
      ...Platform.select({
        ios: {
          shadowColor: p,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.48,
          shadowRadius: 14,
        },
        android: {
          elevation: 12,
        },
        default: {},
      }),
    },
    /** 横向略扁的椭圆玻璃按钮（宽 > 高） */
    headerAddFabGlass: {
      width: 58,
      height: 48,
      borderRadius: 24,
      overflow: 'hidden',
    },
    headerAddFabPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.97 }],
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 8,
      gap: 16,
    },
    /** 净值卡片内层（外层由 GlassSurface 包裹） */
    netWorthSection: {
      alignItems: 'center',
      paddingVertical: 20,
      paddingHorizontal: 20,
    },
    netWorthLabel: {
      fontSize: 14,
      color: p65,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6,
    },
    netWorthValue: {
      fontSize: 42,
      fontWeight: '800',
      color: t.primary,
      textAlign: 'center',
      letterSpacing: -0.6,
    },
    netWorthValueCompact: {
      fontSize: 22,
      lineHeight: 28,
    },
    netWorthBreakdown: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 10,
      color: p55,
    },
    netWorthFootnote: {
      fontSize: 11,
      color: p50,
      textAlign: 'center',
      marginTop: 10,
      paddingHorizontal: 12,
      lineHeight: 16,
    },
    netWorthHeroInt: {
      fontSize: 48,
      fontWeight: '800',
      letterSpacing: -0.9,
    },
    netWorthHeroDec: {
      fontSize: 24,
      fontWeight: '800',
      paddingTop: 5,
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
      color: rgbaFromHex(p, 0.55),
    },
    assetStructureSection: {
      flex: 1,
    },
    groupsContainer: {
      gap: 12,
    },
    categoryGlassOuter: {
      marginBottom: 0,
    },
    folderCard: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderRadius: 28,
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    folderAccentStrip: {
      width: 8,
      minHeight: 84,
    },
    folderBody: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    folderHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingVertical: 18,
      paddingHorizontal: 16,
      gap: 10,
    },
    folderHeaderTextCol: {
      flex: 1,
      minWidth: 0,
      paddingRight: 6,
    },
    folderTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: t.primary,
      letterSpacing: -0.3,
    },
    folderTitleOnAccent: {
      color: '#FFFFFF',
    },
    folderSubtitle: {
      fontSize: 13,
      color: rgbaFromHex(p, 0.55),
      marginTop: 6,
      lineHeight: 18,
    },
    folderSubtitleOnAccent: {
      color: 'rgba(255, 255, 255, 0.88)',
    },
    folderHeaderRight: {
      alignItems: 'flex-end',
      maxWidth: '54%',
      minWidth: 0,
    },
    folderTotal: {
      fontSize: 18,
      fontWeight: '800',
      color: t.primary,
      textAlign: 'right',
    },
    /** 多币种分行合计时略缩小字号，避免三行及以上顶破布局 */
    folderTotalMultiline: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '800',
    },
    folderTotalOnAccent: {
      color: '#FFFFFF',
    },
    folderFootDate: {
      fontSize: 11,
      color: p48,
      marginTop: 6,
      textAlign: 'right',
    },
    folderChevron: {
      fontSize: 11,
      color: p40,
      marginTop: 8,
      fontWeight: '600',
    },
    folderChevronOnAccent: {
      color: 'rgba(255, 255, 255, 0.75)',
    },
    folderAssetList: {
      paddingHorizontal: 12,
      paddingBottom: 14,
      paddingTop: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.38)',
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    assetIconWrap: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      flexShrink: 0,
    },
    assetRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
      paddingVertical: 15,
      paddingHorizontal: 15,
      backgroundColor: 'rgba(255, 255, 255, 0.42)',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.45)',
      ...Platform.select({
        ios: {
          shadowColor: '#1a2744',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 14,
        },
        android: { elevation: 3 },
        default: {},
      }),
    },
    assetRowPressed: {
      opacity: 0.92,
      backgroundColor: 'rgba(255, 255, 255, 0.58)',
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
      color: p48,
    },
    assetName: {
      fontSize: 17,
      color: t.primary,
      fontWeight: '600',
    },
    assetAccount: {
      fontSize: 12,
      color: p55,
      marginTop: 2,
      fontWeight: '500',
    },
    assetHoldings: {
      fontSize: 13,
      color: p58,
      marginTop: 4,
      lineHeight: 18,
    },
    assetPurpose: {
      fontSize: 13,
      color: t.purposeAccent,
      fontWeight: '500',
      marginTop: 2,
    },
    assetPurposeMeta: {
      fontSize: 12,
      color: p55,
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
    emptyCardInner: {
      padding: 32,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 17,
      color: rgbaFromHex(p, 0.55),
    },
  });
}

export type DashboardStyles = ReturnType<typeof createDashboardStyles>;
