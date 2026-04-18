/**
 * 设置 /「我的」页样式：Editorial Poster 海报风。
 */

import { AppFont } from '@/lib/app-fonts';
import type { AppPaletteTheme } from '@/lib/app-palette';
import { pickTextOnAccent, rgbaFromHex } from '@/lib/color-utils';
import { editorialAmbientWash } from '@/lib/editorial-theme';
import { StyleSheet } from 'react-native';

export function createSettingsScreenStyles(t: AppPaletteTheme) {
  const p = t.primary;
  const p65 = rgbaFromHex(p, 0.65);
  const p50 = rgbaFromHex(p, 0.5);

  const accountSwatch = t.swatches[0] ?? p;
  /** 背景用 rgba；对比色必须用 hex 调用 pickTextOnAccent（勿传 rgba 字符串） */
  const accountBg = rgbaFromHex(accountSwatch, 1);
  const accountInk = pickTextOnAccent(accountSwatch);
  const toolsSwatch = t.swatches[1] ?? p;
  const secondarySwatch = t.swatches[2] ?? p;
  const toolsBg = rgbaFromHex(toolsSwatch, 1);
  const secondaryBg = rgbaFromHex(secondarySwatch, 1);

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.pageBg,
    },
    screenAmbient: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: editorialAmbientWash(t),
    },
    scrollContent: {
      paddingBottom: 40,
    },
    
    /** Masthead (Top) */
    mastheadBlock: {
      paddingHorizontal: 24,
      paddingTop: 64,
      paddingBottom: 24,
      backgroundColor: 'transparent',
    },
    masthead: {
      fontFamily: AppFont.displayBold,
      fontSize: 54,
      lineHeight: 58,
      letterSpacing: -2.0,
      textTransform: 'uppercase',
      color: p,
    },
    kicker: {
      fontFamily: AppFont.medium,
      fontSize: 14,
      letterSpacing: 2.0,
      textTransform: 'uppercase',
      color: p,
      marginTop: 4,
    },

    /** Poster Collage Stage (Middle) */
    posterStage: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      minHeight: 340,
      gap: 12,
    },
    
    /** Left Column: Account */
    accountBlock: {
      flex: 5.8,
      backgroundColor: accountBg,
      paddingHorizontal: 20,
      paddingVertical: 24,
      justifyContent: 'space-between',
    },
    accountTitle: {
      fontFamily: AppFont.displayBold,
      fontSize: 36,
      letterSpacing: -1.0,
      color: accountInk,
      marginBottom: 20,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: rgbaFromHex(p, 0.1),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    profileName: {
      fontFamily: AppFont.bold,
      fontSize: 20,
      color: accountInk,
      marginBottom: 8,
    },
    profileSub: {
      fontFamily: AppFont.medium,
      fontSize: 13,
      lineHeight: 18,
      color: rgbaFromHex(accountInk, 0.8),
      marginBottom: 24,
    },
    profileCta: {
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: t.ctaPillBg,
      borderRadius: 16,
    },
    profileCtaText: {
      fontFamily: AppFont.bold,
      fontSize: 12,
      color: t.ctaPillText,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    /** Right Column: Tools & Secondary */
    rightColumn: {
      flex: 4.2,
      gap: 12,
    },
    toolsBlock: {
      flex: 1,
      backgroundColor: toolsBg,
      paddingHorizontal: 12,
      paddingVertical: 16,
    },
    toolsHeader: {
      fontFamily: AppFont.displayBold,
      fontSize: 28,
      letterSpacing: -0.5,
      color: pickTextOnAccent(toolsSwatch),
      marginBottom: 12,
      textAlign: 'center',
    },
    toolsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
    },
    
    secondaryBlock: {
      backgroundColor: secondaryBg,
      paddingHorizontal: 12,
      paddingVertical: 16,
      minHeight: 120,
      justifyContent: 'center',
    },
    secondaryGrid: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },

    /** Preferences (Bottom Full Width) */
    preferencesBlock: {
      marginTop: 24,
      marginHorizontal: 16,
      backgroundColor: rgbaFromHex(t.surfaceWhite, 0.72),
      paddingTop: 24,
      paddingBottom: 16,
    },
    sectionMasthead: {
      fontFamily: AppFont.displayBold,
      fontSize: 32,
      letterSpacing: -1.0,
      color: p,
      paddingHorizontal: 24,
      marginBottom: 16,
    },
  });
}

export type SettingsScreenStyles = ReturnType<typeof createSettingsScreenStyles>;
