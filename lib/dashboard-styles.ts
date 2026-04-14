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
    /** Hero 舞台层 */
    heroStage: {
      position: 'relative',
      height: 445,
      width: '100%',
      backgroundColor: 'transparent',
    },
    heroAddHitAbs: {
      position: 'absolute',
      right: 12,
      zIndex: 20,
      padding: 10,
    },
    headerAddFabPressed: {
      opacity: 0.8,
    },
    /** 左上：杂志大标题 */
    heroPeachBlock: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '74%',
      height: 165,
      paddingHorizontal: 28,
      paddingTop: 56,
      zIndex: 3,
    },
    /** 右上：背景遮挡块 */
    heroBlueTopBlock: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: '32%',
      height: 240,
      zIndex: 1,
    },
    /** 中右：今日涨跌 */
    heroChangeBlock: {
      position: 'absolute',
      top: 165,
      right: 0,
      width: '68%',
      height: 140,
      paddingHorizontal: 26,
      paddingVertical: 16,
      justifyContent: 'center',
      alignItems: 'flex-end',
      zIndex: 2,
    },
    /** 中左底：总资产 */
    heroTotalBlock: {
      position: 'absolute',
      left: 32,
      right: 0,
      top: 305,
      height: 140,
      paddingHorizontal: 28,
      paddingVertical: 20,
      justifyContent: 'center',
      alignItems: 'flex-end',
      zIndex: 4,
    },
    /** 文案排版 */
    masthead: {
      fontFamily: AppFont.displayBold,
      fontSize: 48,
      lineHeight: 52,
      letterSpacing: -1.6,
      textTransform: 'uppercase',
      color: p,
    },
    kicker: {
      fontFamily: AppFont.medium,
      fontSize: 11,
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
      fontSize: 32,
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
      fontSize: 54,
      fontWeight: '800',
      letterSpacing: -1.2,
      color: p,
    },
    totalValueDec: {
      fontSize: 28,
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
    /** 杂志底色单行拆解 */
    magHeroCurrencyLine: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0,
      textAlign: 'right',
      color: p55,
      marginTop: 4,
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
      paddingVertical: 6,
      paddingHorizontal: 24,
      backgroundColor: rgbaFromHex(p, 0.03),
    },
    assetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: rgbaFromHex(p, 0.06),
    },
    assetRowPressed: {
      opacity: 0.7,
    },
    assetRowMiddleCol: {
      flex: 1,
      justifyContent: 'center',
    },
    assetName: {
      fontSize: 15,
      fontWeight: '600',
      color: p,
      marginBottom: 2,
    },
    assetHoldings: {
      fontSize: 12,
      color: p55,
    },
    assetRowRightCol: {
      alignItems: 'flex-end',
    },
    assetValue: {
      fontSize: 15,
      fontWeight: '700',
      color: p,
    },
    assetQuoteDate: {
      fontSize: 11,
      color: p40,
      marginTop: 2,
    },
  });
}

export type DashboardStyles = ReturnType<typeof createDashboardStyles>;
