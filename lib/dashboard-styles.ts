/**
 * Dashboard 样式工厂：随配色主题变化。
 */

import { AppFont } from '@/lib/app-fonts';
import type { AppPaletteTheme } from '@/lib/app-palette';
import { rgbaFromHex } from '@/lib/color-utils';
import { editorialAmbientWash, editorialSurfaceFill } from '@/lib/editorial-theme';
import { Platform, StyleSheet } from 'react-native';

export function createDashboardStyles(t: AppPaletteTheme) {
  const p = t.primary;
  const p65 = rgbaFromHex(p, 0.65);
  const p55 = rgbaFromHex(p, 0.55);
  const p50 = rgbaFromHex(p, 0.5);
  const p48 = rgbaFromHex(p, 0.48);
  const p58 = rgbaFromHex(p, 0.58);
  const p40 = rgbaFromHex(p, 0.4);

  return StyleSheet.create({
    screenWrapper: {
      flex: 1,
      backgroundColor: t.pageBg,
    },
    /** 极淡主色氛围层（铺在 pageBg 之上；随主题 palette 变化） */
    dashboardAmbient: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: editorialAmbientWash(t),
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
    /** design.json：分屏顶栏与主指标 — 直角色块 */
    magHeaderSplit: {
      flexDirection: 'row',
      alignItems: 'stretch',
      minHeight: 56,
    },
    magHeaderCell: {
      flex: 1,
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    magHeaderTitle: {
      fontFamily: AppFont.displayBold,
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: -0.8,
    },
    magHeaderAddHit: {
      flex: 1,
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingRight: 4,
    },
    magHeroSplit: {
      flexDirection: 'row',
      alignItems: 'stretch',
      minHeight: 148,
    },
    magHeroLeft: {
      flex: 3,
      paddingHorizontal: 18,
      paddingVertical: 22,
      justifyContent: 'center',
    },
    magHeroRight: {
      flex: 2,
      paddingHorizontal: 14,
      paddingVertical: 22,
      justifyContent: 'center',
    },
    magHeroKicker: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    magCategoryFrame: {
      marginBottom: 3,
      overflow: 'hidden',
    },
    /** 上半屏：dashboard.png — 奶油底布 + 三块矩形叠压（无旋转，直角） */
    magHeroHalfRoot: {
      width: '100%',
      overflow: 'hidden',
    },
    magHeroCollagePad: {
      flex: 1,
      paddingHorizontal: 0,
      paddingBottom: 0,
    },
    magHeroCollageStage: {
      flex: 1,
      position: 'relative',
    },
    magHeroPaperBase: {
      borderRadius: 0,
      ...Platform.select({
        ios: {
          shadowColor: '#141414',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 6,
        },
        default: {},
      }),
    },
    /** 左上横条：CLAUDIA / Dashboard（约 3/4 屏宽） */
    magHeroPaperDashboard: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '74%',
      height: '36%',
      paddingVertical: 14,
      paddingHorizontal: 16,
      zIndex: 2,
    },
    /** 右上竖条：参考图浅蓝块（今日涨跌位）— 各币种原值 */
    magHeroPaperSideBlue: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: '49%',
      height: '62%',
      paddingVertical: 10,
      paddingHorizontal: 8,
      zIndex: 1,
    },
    /** 下方横条：参考图最大数字 + TOTAL VALUE — 默认币种合计净值 */
    magHeroPaperTotalOrange: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: '85%',
      height: '38%',
      paddingVertical: 14,
      paddingHorizontal: 16,
      zIndex: 3,
      justifyContent: 'flex-end',
    },
    /** 多币种明细在橙块内展开时略增高底部橙区，避免与右下角今日涨跌重叠 */
    magHeroPaperTotalOrangeWithDetail: {
      height: '48%',
    },
    /** 单币种：仅左上标题 + 下方整块净值 */
    magHeroPaperTotalOrangeWide: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      width: '100%',
      height: '58%',
      paddingVertical: 16,
      paddingHorizontal: 16,
      zIndex: 2,
      justifyContent: 'flex-end',
    },
    magDashboardTitleCollage: {
      fontFamily: AppFont.displayBold,
      fontSize: 66,
      fontWeight: '700',
      letterSpacing: -2.8,
      lineHeight: 68,
    },
    magHeroHalfInner: {
      flex: 1,
      flexDirection: 'column',
    },
    magHeroMastheadBand: {
      flex: 2.25,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 14,
      justifyContent: 'flex-start',
    },
    magDashboardTitle: {
      fontFamily: AppFont.displayBold,
      fontSize: 58,
      fontWeight: '700',
      letterSpacing: -2.6,
      lineHeight: 62,
    },
    magDashboardSubtitle: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.85,
      textTransform: 'uppercase',
      marginTop: 10,
    },
    magHeroMetricBand: {
      flex: 1.4,
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    magHeroMetricInner: {
      width: '100%',
      alignItems: 'flex-end',
    },
    magHeroMetricLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      marginBottom: 8,
      textAlign: 'right',
    },
    /** 右上蓝条内多行原币种（略小于底部主数字） */
    magHeroCurrencyLine: {
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.35,
      textAlign: 'right',
      lineHeight: 22,
    },
    /** 底部橙条：全页最大净值数字（参考 TOTAL VALUE 一行） */
    magHeroNetInt: {
      fontSize: 60,
      fontWeight: '800',
      letterSpacing: -1.2,
    },
    magHeroNetDec: {
      fontSize: 32,
      fontWeight: '800',
      paddingTop: 8,
    },
    magHeroNetForeign: {
      fontSize: 50,
      fontWeight: '800',
      letterSpacing: -0.85,
      textAlign: 'right',
    },
    /** 主数字下方小标题（对齐参考 TOTAL VALUE） */
    magHeroMetricCaptionBelow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      marginTop: 10,
      textAlign: 'right',
    },
    magHeroAddHitAbs: {
      position: 'absolute',
      right: 12,
      zIndex: 20,
      padding: 10,
    },
    /** 今日盈亏比例：叠在拼贴层，位于右下角净值橙块「上方」（bottom 与橙块高度对齐） */
    magHeroDailyAboveCard: {
      position: 'absolute',
      right: 14,
      zIndex: 4,
      alignItems: 'flex-end',
    },
    magHeroDailyPctOnly: {
      fontSize: 50,
      fontWeight: '800',
      letterSpacing: -0.35,
      textAlign: 'right',
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
      fontFamily: AppFont.displayBold,
      fontSize: 34,
      fontWeight: '700',
      letterSpacing: -1.1,
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
      paddingHorizontal: 0,
      paddingTop: 0,
      gap: 0,
    },
    /** 净值卡片内层（外层由 GlassSurface 包裹） */
    netWorthSection: {
      alignItems: 'center',
      paddingVertical: 20,
      paddingHorizontal: 20,
    },
    netWorthLabel: {
      fontFamily: AppFont.displaySemiBold,
      fontSize: 13,
      color: p65,
      textTransform: 'uppercase',
      letterSpacing: 1.4,
      marginBottom: 8,
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
      gap: 0,
      paddingTop: 4,
      paddingHorizontal: 0,
    },
    categoryGlassOuter: {
      marginBottom: 0,
    },
    folderCard: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderRadius: 0,
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
    /** 左 20% 图标 | 中间名称与摘要 | 右列金额；整行单色，无列缝 */
    folderHeader: {
      flexDirection: 'row',
      alignItems: 'stretch',
      alignSelf: 'stretch',
      width: '100%',
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 0,
    },
    folderHeaderIconCol: {
      width: '20%',
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 6,
    },
    folderHeaderMiddleCol: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 10,
    },
    folderTitle: {
      fontFamily: AppFont.displaySemiBold,
      fontSize: 21,
      fontWeight: '600',
      color: t.primary,
      letterSpacing: -0.35,
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
      width: '30%',
      flexShrink: 0,
      minWidth: 0,
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingLeft: 6,
      paddingRight: 6,
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
      backgroundColor: editorialSurfaceFill(t, 0.45),
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    assetRow: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      alignItems: 'stretch',
      width: '100%',
      marginBottom: 8,
      paddingVertical: 0,
      paddingHorizontal: 0,
      gap: 0,
      borderRadius: 0,
      borderWidth: 0,
    },
    assetRowPressed: {
      opacity: 0.9,
    },
    assetRowIconCol: {
      width: '20%',
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 6,
    },
    assetRowMiddleCol: {
      flex: 1,
      minWidth: 0,
      gap: 2,
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
    },
    assetRowRightCol: {
      width: '30%',
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 2,
      paddingVertical: 12,
      paddingLeft: 4,
      paddingRight: 10,
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
