/**
 * Dashboard 样式工厂：随配色主题变化，杂志海报风拼贴排版。
 */

import { AppFont } from '@/lib/app-fonts';
import type { AppPaletteTheme } from '@/lib/app-palette';
import { rgbaFromHex } from '@/lib/color-utils';
import { editorialAmbientWash } from '@/lib/editorial-theme';
import { StyleSheet } from 'react-native';

export function createDashboardStyles(t: AppPaletteTheme) {
  const p = t.primary;
  const p65 = rgbaFromHex(p, 0.65);
  const p55 = rgbaFromHex(p, 0.55);
  const p50 = rgbaFromHex(p, 0.5);
  const p40 = rgbaFromHex(p, 0.4);

  return StyleSheet.create({
    screenWrapper: {
      flex: 1,
      backgroundColor: t.pageBg,
    },
    /** 极淡主色氛围层 */
    dashboardAmbient: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: editorialAmbientWash(t),
    },
    container: {
      flex: 1,
      backgroundColor: 'transparent',
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
    /** Hero 舞台层（避免子视图溢出被裁切） */
    heroStage: {
      position: 'relative',
      height: 445,
      width: '100%',
      backgroundColor: 'transparent',
      overflow: 'visible',
    },
    /** 在黄底之上、Dashboard 字之下，避免挡住标题 */
    heroAddHitAbs: {
      position: 'absolute',
      right: 12,
      zIndex: 25,
      padding: 10,
    },
    headerAddFabPressed: {
      opacity: 0.8,
    },
    /**
     * 左上：杂志大标题 — 拆成「黄底 / 文字」两层，便于紫色块压在黄底下面、字永远在最上。
     * 勿用窄 width + 大 padding，否则「Dashboard」会被水平裁切；用 right 为「+」留白。
     */
    heroMastheadYellowBg: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 52,
      height: 200,
      zIndex: 5,
    },
    heroMastheadTextLayer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 52,
      minHeight: 200,
      paddingLeft: 28,
      paddingRight: 12,
      paddingBottom: 12,
      zIndex: 30,
      backgroundColor: 'transparent',
      overflow: 'visible',
    },
    /** 右上：偏紫的色块（压在黄底下面） */
    heroBlueTopBlock: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: '32%',
      height: 240,
      zIndex: 0,
    },
    /** 中右：今日涨跌（在黄底之下或与中层色块一致，低于 Dashboard 字层） */
    heroChangeBlock: {
      position: 'absolute',
      top: 200,
      right: 0,
      width: '68%',
      height: 140,
      paddingHorizontal: 26,
      paddingVertical: 16,
      justifyContent: 'center',
      alignItems: 'flex-end',
      zIndex: 3,
    },
    /** 中左底：总资产 */
    heroTotalBlock: {
      position: 'absolute',
      left: 32,
      right: 0,
      top: 265,
      height: 180,
      paddingHorizontal: 28,
      paddingVertical: 20,
      justifyContent: 'center',
      alignItems: 'flex-end',
      zIndex: 4,
    },
    /** 文案排版 */
    masthead: {
      fontFamily: AppFont.displayBold,
      fontSize: 60,
      /** 必须 ≥ fontSize，否则行盒会裁切上下笔画 */
      lineHeight: 68,
      letterSpacing: -1.6,
      textTransform: 'uppercase',
      color: p,
      width: '100%',
    },
    kicker: {
      fontFamily: AppFont.medium,
      fontSize: 15,
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      color: p,
      marginTop: 8,
    },
    changeValue: {
      fontSize: 48,
      fontWeight: '800',
      letterSpacing: -0.6,
    },
    changeValueSmall: {
      fontSize: 48,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    metricLabel: {
      fontFamily: AppFont.medium,
      fontSize: 11,
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      color: p65,
      marginTop: 8,
    },
    totalValueSplit: {
      flexDirection: 'row',
      alignItems: 'baseline',
      alignSelf: 'flex-end',
    },
    totalValueInt: {
      fontSize: 48,
      fontWeight: '800',
      letterSpacing: -1.2,
      color: p,
    },
    totalValueDec: {
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: p,
      paddingTop: 8,
    },
    totalValueForeign: {
      fontSize: 46,
      fontWeight: '800',
      letterSpacing: -1.0,
      color: p,
      textAlign: 'right',
    },
    /** 总净值下方：分币种横排，中间小圆点；换行不溢出右缘 */
    heroCurrencyBreakdownRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      alignItems: 'center',
      alignSelf: 'stretch',
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      marginTop: 6,
      overflow: 'hidden',
    },
    heroCurrencyBreakdownDot: {
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 16,
    },
    magHeroCurrencyInline: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 16,
      flexShrink: 1,
      textAlign: 'right',
    },

    /** 资产分类列表 */
    groupsContainer: {
      gap: 0,
      paddingHorizontal: 0,
    },
    categoryRowPressable: {
      flexDirection: 'row',
      alignItems: 'stretch',
      minHeight: 110,
    },
    categoryRowPressed: {
      opacity: 0.85,
    },
    categoryIconCell: {
      width: '20%',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 16,
    },
    categoryMainCell: {
      flex: 1,
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 12,
    },
    categoryDeltaCell: {
      width: '30%',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingVertical: 16,
      paddingRight: 24,
      paddingLeft: 10,
    },
    categoryName: {
      fontFamily: AppFont.displayBold,
      fontSize: 28,
      letterSpacing: -0.4,
      textTransform: 'uppercase',
      color: p,
      marginBottom: 6,
    },
    categoryMeta: {
      fontSize: 13,
      color: p55,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      lineHeight: 16,
      marginBottom: 0,
    },
    categoryAmount: {
      fontSize: 24,
      fontWeight: '800',
      color: p,
      letterSpacing: -0.6,
    },
    categoryDelta: {
      fontSize: 14,
      fontWeight: '600',
    },
    emptyCategoryText: {
      fontSize: 14,
      color: p55,
      paddingVertical: 20,
      textAlign: 'center',
    },
    assetListContainer: {
      flex: 1,
      paddingBottom: 16,
      paddingRight: 24,
      paddingLeft: 12,
    },
    assetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
    },
    assetRowPressed: {
      opacity: 0.7,
    },
    assetRowMiddleCol: {
      flex: 1,
      justifyContent: 'center',
      paddingRight: 16,
    },
    assetName: {
      fontFamily: AppFont.semiBold,
      fontSize: 14,
      letterSpacing: 0.2,
      marginBottom: 4,
    },
    assetHoldings: {
      fontFamily: AppFont.medium,
      fontSize: 11,
      letterSpacing: 0.5,
    },
    assetRowRightCol: {
      alignItems: 'flex-end',
    },
    assetValue: {
      fontFamily: AppFont.bold,
      fontSize: 15,
      letterSpacing: -0.2,
    },
    assetQuoteDate: {
      fontFamily: AppFont.medium,
      fontSize: 10,
      marginTop: 4,
      letterSpacing: 0.2,
    },
  });
}

export type DashboardStyles = ReturnType<typeof createDashboardStyles>;
