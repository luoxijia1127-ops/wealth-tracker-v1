/**
 * 添加资产 Modal 样式：随设置中的配色主题变化。
 */

import type { AppPaletteTheme } from '@/lib/app-palette';
import { rgbaFromHex } from '@/lib/color-utils';
import { Platform, StyleSheet } from 'react-native';

export function createAddModalStyles(t: AppPaletteTheme) {
  const p = t.primary;
  const p12 = rgbaFromHex(p, 0.12);
  const p14 = rgbaFromHex(p, 0.14);
  const p55 = rgbaFromHex(p, 0.55);
  const p58 = rgbaFromHex(p, 0.58);
  const p65 = rgbaFromHex(p, 0.65);
  const p10 = rgbaFromHex(p, 0.1);
  const p08 = rgbaFromHex(p, 0.08);
  const p06 = rgbaFromHex(p, 0.06);

  return StyleSheet.create({
    keyboardRoot: {
      flex: 1,
      backgroundColor: t.pageBg,
    },
    modalAmbient: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(120, 145, 185, 0.08)',
    },
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    glassFormInner: {
      padding: 18,
    },
    headerCard: {
      marginTop: 4,
      marginBottom: 10,
      padding: 18,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.38)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.42)',
      ...Platform.select({
        ios: {
          shadowColor: '#1a2744',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 18,
        },
        android: { elevation: 4 },
        default: {},
      }),
    },
    headerCode: {
      fontSize: 15,
      fontWeight: '800',
      color: p,
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    headerName: {
      fontSize: 20,
      fontWeight: '700',
      color: p,
      letterSpacing: -0.3,
      marginBottom: 8,
    },
    headerMeta: {
      fontSize: 13,
      color: p58,
      lineHeight: 18,
    },
    purposeSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 28,
      paddingVertical: 12,
      paddingHorizontal: 6,
    },
    purposeSectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: p65,
    },
    purposeCaret: {
      fontSize: 14,
      color: p55,
      marginLeft: 8,
    },
    purposeSectionBody: {
      marginBottom: 4,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    currencyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minWidth: 56,
      paddingVertical: 13,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.4)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.45)',
    },
    currencyChipStatic: {
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.4)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.45)',
    },
    currencyChipText: {
      fontSize: 17,
      fontWeight: '700',
      color: p,
    },
    currencyChevron: {
      fontSize: 10,
      color: p55,
      marginTop: 2,
    },
    amountInputFlex: {
      flex: 1,
      marginTop: 0,
    },
    selectFieldButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      backgroundColor: 'rgba(255,255,255,0.4)',
      paddingVertical: 15,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.42)',
    },
    selectFieldButtonText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: p,
    },
    currencyModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    currencyModalDismiss: {
      ...StyleSheet.absoluteFillObject,
    },
    currencyModalCard: {
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderRadius: 24,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: p12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 6,
    },
    currencyModalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: p,
      paddingHorizontal: 18,
      paddingBottom: 14,
    },
    currencyModalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 15,
      paddingHorizontal: 18,
    },
    currencyModalRowSelected: {
      backgroundColor: p10,
    },
    currencyModalRowSymbol: {
      fontSize: 18,
      fontWeight: '700',
      color: p,
      width: 40,
    },
    currencyModalRowLabel: {
      fontSize: 16,
      color: p,
    },
    currencyModalCancel: {
      marginTop: 8,
      paddingVertical: 14,
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: p12,
    },
    currencyModalCancelText: {
      fontSize: 16,
      color: p55,
    },
    label: {
      fontSize: 14,
      color: p65,
      marginBottom: 8,
      marginTop: 18,
      fontWeight: '600',
    },
    optionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    option: {
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.38)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.42)',
    },
    optionSelected: {
      backgroundColor: p06,
      borderColor: p,
    },
    optionText: {
      fontSize: 14,
      color: p58,
      fontWeight: '500',
    },
    optionTextSelected: {
      color: p,
      fontWeight: '600',
    },
    input: {
      backgroundColor: 'rgba(255,255,255,0.42)',
      color: p,
      padding: 15,
      borderRadius: 16,
      fontSize: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.45)',
    },
    valueInputHighlight: {
      borderColor: p,
      borderWidth: 2,
      backgroundColor: p08,
    },
    previousValue: {
      fontSize: 13,
      color: p55,
      marginBottom: 6,
    },
    hint: {
      fontSize: 12,
      color: p55,
      marginTop: 6,
    },
    hintMuted: {
      fontSize: 12,
      color: p55,
      marginBottom: 8,
      lineHeight: 18,
    },
    suggestLoadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    suggestLoadingText: {
      fontSize: 13,
      color: p58,
    },
    suggestBox: {
      marginTop: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.4)',
      backgroundColor: 'rgba(255,255,255,0.55)',
      overflow: 'hidden',
      maxHeight: 220,
    },
    suggestRow: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p12,
    },
    suggestRowPressed: {
      backgroundColor: p08,
    },
    suggestCode: {
      fontSize: 15,
      fontWeight: '700',
      color: p,
      marginBottom: 4,
      letterSpacing: 0.3,
    },
    suggestName: {
      fontSize: 14,
      color: p65,
    },
    suggestEmpty: {
      fontSize: 13,
      color: p55,
      marginTop: 8,
    },
    selectedCard: {
      marginTop: 14,
      padding: 14,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.4)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.45)',
    },
    selectedLabel: {
      fontSize: 12,
      color: p58,
      marginBottom: 6,
    },
    selectedMain: {
      fontSize: 16,
      fontWeight: '600',
      color: p,
      lineHeight: 22,
    },
    changeLink: {
      marginTop: 10,
      fontSize: 14,
      color: p,
      fontWeight: '600',
    },
    saveButton: {
      marginTop: 32,
      backgroundColor: p,
      paddingVertical: 16,
      borderRadius: 22,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      shadowColor: '#1a2744',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 20,
      elevation: 6,
    },
    saveButtonDisabled: {
      opacity: 0.55,
    },
    saveButtonText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
}

export type AddModalStyles = ReturnType<typeof createAddModalStyles>;
