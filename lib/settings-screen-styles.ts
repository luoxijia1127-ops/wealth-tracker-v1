/**
 * 设置 /「我的」页样式：与 design.json 大卡片、暖色画布一致。
 */

import type { AppPaletteTheme } from '@/lib/app-palette';
import { rgbaFromHex } from '@/lib/color-utils';
import { Platform, StyleSheet } from 'react-native';

export function createSettingsScreenStyles(t: AppPaletteTheme) {
  const p = t.primary;
  const p65 = rgbaFromHex(p, 0.65);
  const p50 = rgbaFromHex(p, 0.5);
  const p12 = rgbaFromHex(p, 0.12);

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.pageBg,
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
      backgroundColor: 'rgba(255,255,255,0.72)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.95)',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
        },
        android: { elevation: 2 },
        default: {},
      }),
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: p,
    },
    profileCard: {
      borderRadius: 28,
      paddingVertical: 20,
      paddingHorizontal: 18,
      marginHorizontal: 20,
      marginBottom: 22,
      backgroundColor: 'rgba(255,255,255,0.88)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.95)',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.07,
          shadowRadius: 22,
        },
        android: { elevation: 4 },
        default: {},
      }),
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
      backgroundColor: 'rgba(255,255,255,0.95)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: p12,
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
      borderRadius: 14,
      backgroundColor: '#F6DB62',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.06)',
    },
    profileCtaText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#2D2A22',
    },
    statsRow: {
      flexDirection: 'row',
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.92)',
      paddingVertical: 14,
      paddingHorizontal: 8,
      marginBottom: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.98)',
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
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: p65,
      marginBottom: 12,
      paddingHorizontal: 22,
      letterSpacing: 0.2,
    },
    gridWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 14,
    },
  });
}

export type SettingsScreenStyles = ReturnType<typeof createSettingsScreenStyles>;
