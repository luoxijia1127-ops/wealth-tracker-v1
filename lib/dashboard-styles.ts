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
    container: {
      flex: 1,
      backgroundColor: t.pageBg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingBottom: 16,
      backgroundColor: t.pageBg,
    },
    headerTitle: {
      fontSize: 30,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: t.primary,
    },
    headerAddFab: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: t.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.6)',
      ...Platform.select({
        ios: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.12,
          shadowRadius: 20,
        },
        android: {
          elevation: 7,
        },
        default: {},
      }),
    },
    headerAddFabPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.96 }],
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 24,
      gap: 24,
    },
    netWorthSection: {
      alignItems: 'center',
      paddingVertical: 26,
      paddingHorizontal: 20,
      borderRadius: 32,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255, 255, 255, 0.95)',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.07,
          shadowRadius: 24,
        },
        android: { elevation: 4 },
        default: {},
      }),
    },
    netWorthLabel: {
      fontSize: 12,
      color: p65,
      textTransform: 'uppercase',
      letterSpacing: 1,
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
      gap: 20,
    },
    categoryCardShadow: {
      borderRadius: 28,
      backgroundColor: 'transparent',
    },
    categoryCardShadowIOS: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.07,
      shadowRadius: 22,
    },
    categoryCardShadowAndroid: {
      elevation: 5,
    },
    folderCard: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderRadius: 28,
      backgroundColor: 'rgba(255, 255, 255, 0.94)',
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255, 255, 255, 0.95)',
    },
    folderAccentStrip: {
      width: 8,
      minHeight: 84,
    },
    folderBody: {
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
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
      maxWidth: '46%',
    },
    folderTotal: {
      fontSize: 18,
      fontWeight: '800',
      color: t.primary,
      textAlign: 'right',
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
      backgroundColor: t.folderListBg,
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
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: p08,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
        },
        android: { elevation: 2 },
        default: {},
      }),
    },
    assetRowPressed: {
      opacity: 0.94,
      backgroundColor: '#FFFEFC',
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
    emptyCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.82)',
      borderRadius: 28,
      padding: 32,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255, 255, 255, 0.95)',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.06,
          shadowRadius: 20,
        },
        android: { elevation: 4 },
      }),
    },
    emptyText: {
      fontSize: 17,
      color: rgbaFromHex(p, 0.55),
    },
  });
}

export type DashboardStyles = ReturnType<typeof createDashboardStyles>;
