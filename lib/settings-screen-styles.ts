/**
 * 设置 /「我的」页样式：与 design.json 大卡片、暖色画布一致。
 */

import type { AppPaletteTheme } from '@/lib/app-palette';
import { AppFont } from '@/lib/app-fonts';
import { editorialAmbientWash, editorialSurfaceFill } from '@/lib/editorial-theme';
import { rgbaFromHex } from '@/lib/color-utils';
import { Platform, StyleSheet } from 'react-native';

export function createSettingsScreenStyles(t: AppPaletteTheme) {
  const sf = (a: number) => editorialSurfaceFill(t, a);
  const p = t.primary;
  const p65 = rgbaFromHex(p, 0.65);
  const p50 = rgbaFromHex(p, 0.5);

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
      paddingBottom: 32,
    },
    decorWrap: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    decorBlob: {
      position: 'absolute',
      borderRadius: 999,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      marginBottom: 18,
      minHeight: 48,
    },
    headerSideBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: sf(0.62),
      borderWidth: 0,
      ...Platform.select({
        ios: {
          shadowColor: '#1e1b4b',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 18,
        },
        android: { elevation: 2 },
        default: {},
      }),
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontFamily: AppFont.displayBold,
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: -0.5,
      color: p,
    },
    /** 外层 GlassSurface 负责模糊与圆角，此处仅内边距 */
    profileCardInner: {
      paddingVertical: 20,
      paddingHorizontal: 18,
    },
    profileGlassOuter: {
      marginHorizontal: 20,
      marginBottom: 20,
    },
    profileTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 18,
      gap: 12,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: sf(0.85),
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0,
    },
    profileNameBlock: {
      flex: 1,
      minWidth: 0,
    },
    profileName: {
      fontSize: 18,
      fontWeight: '800',
      color: p,
      letterSpacing: -0.3,
    },
    profileSub: {
      fontSize: 12,
      fontWeight: '500',
      color: p65,
      marginTop: 4,
    },
    profileCta: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: t.ctaPillBg,
      borderWidth: 0,
    },
    profileCtaText: {
      fontSize: 13,
      fontWeight: '800',
      color: t.ctaPillText,
    },
    statsRow: {
      flexDirection: 'row',
      borderRadius: 20,
      backgroundColor: sf(0.58),
      paddingVertical: 14,
      paddingHorizontal: 8,
      marginBottom: 14,
      borderWidth: 0,
    },
    statCell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    statValue: {
      fontSize: 17,
      fontWeight: '800',
      color: p,
      letterSpacing: -0.4,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: p50,
      marginTop: 4,
      textAlign: 'center',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 4,
      gap: 12,
    },
    metaLeft: {
      flex: 1,
      minWidth: 0,
    },
    metaMuted: {
      fontSize: 12,
      fontWeight: '500',
      color: p50,
    },
    metaLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    metaLinkText: {
      fontSize: 13,
      fontWeight: '700',
      color: p65,
    },
    sectionGlassOuter: {
      marginHorizontal: 20,
      marginBottom: 14,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: p65,
      marginBottom: 10,
      paddingHorizontal: 18,
      paddingTop: 16,
      letterSpacing: 0.2,
    },
    gridWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 14,
      paddingBottom: 12,
    },
  });
}

export type SettingsScreenStyles = ReturnType<typeof createSettingsScreenStyles>;
