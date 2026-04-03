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
      padding: 14,
    },
    /** 表单行之间的垂直间距（图标行与图标行一致） */
    formRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
      marginTop: 12,
    },
    /** 卡片内首行：与 glass 上内边距衔接，不再额外顶距 */
    formRowFirst: {
      marginTop: 0,
    },
    /** 左侧图标列：与右侧「标签 + 内容」对齐，图标只与内容区垂直居中 */
    formRowIconColumn: {
      width: 28,
      alignItems: 'center',
    },
    /** 与 formRowLabel 占位高度一致（lineHeight + marginBottom） */
    formRowIconLabelSpacer: {
      height: 18,
    },
    formRowIconWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 22,
    },
    formRowBody: {
      flex: 1,
      minWidth: 0,
    },
    formRowLabel: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600',
      color: p55,
      marginBottom: 4,
    },
    /** 标签下方的整块内容；高度由子元素决定，左侧图标列 stretch 后与之对齐 */
    formRowChildren: {
      minWidth: 0,
    },
    /** 带右侧控件（箭头、单位）时与主输入同一行 */
    formRowContentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    formRowContentMain: {
      flex: 1,
      minWidth: 0,
    },
    categoryRowWrap: {
      marginTop: 0,
      flexDirection: 'row',
      gap: 10,
      alignItems: 'stretch',
    },
    categoryRowOneLine: {
      flexDirection: 'row',
      gap: 4,
      alignItems: 'stretch',
    },
    optionMini: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 8,
      paddingHorizontal: 3,
      borderRadius: 11,
      backgroundColor: 'rgba(255,255,255,0.42)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.45)',
    },
    optionTextMini: {
      fontSize: 12,
      color: p58,
      fontWeight: '700',
      textAlign: 'center',
    },
    /** 单价/金额与币种同一外框：左输入 | 竖线 | 右币种 */
    inputCurrencyShell: {
      flexDirection: 'row',
      alignItems: 'stretch',
      flex: 1,
      minWidth: 0,
      minHeight: 38,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.45)',
      backgroundColor: 'rgba(255,255,255,0.42)',
      overflow: 'visible',
    },
    inputCurrencyField: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 8,
      paddingHorizontal: 10,
      fontSize: 15,
      fontWeight: '600',
      color: p,
      borderWidth: 0,
    },
    inputCurrencyDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: p14,
    },
    inputCompact: {
      backgroundColor: 'rgba(255,255,255,0.42)',
      color: p,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      fontSize: 15,
      fontWeight: '600',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.45)',
      minHeight: 36,
    },
    listedTwoCol: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    listedColFlex: {
      flex: 1,
      minWidth: 0,
    },
    formRowInput: {
      backgroundColor: 'rgba(255,255,255,0.42)',
      color: p,
      paddingVertical: 12,
      paddingHorizontal: 0,
      fontSize: 17,
      fontWeight: '600',
      borderWidth: 0,
      minHeight: 24,
    },
    formRowValuePressable: {
      paddingVertical: 4,
    },
    formRowValue: {
      fontSize: 17,
      fontWeight: '600',
      color: p,
    },
    formRowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingLeft: 4,
    },
    formRowRightText: {
      fontSize: 15,
      fontWeight: '700',
      color: p,
    },
    categoryBlock: {
      marginTop: 12,
      flexDirection: 'row',
      gap: 10,
      alignItems: 'stretch',
    },
    categoryChipsWrap: {
      flex: 1,
      minWidth: 0,
    },
    unitPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    moreOptionsLink: {
      marginTop: 6,
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    moreOptionsLinkText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#2563EB',
    },
    discardButton: {
      marginTop: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    discardButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#E53935',
    },
    saveButtonPill: {
      marginTop: 8,
      backgroundColor: '#111318',
      paddingVertical: 16,
      borderRadius: 999,
      alignItems: 'center',
      borderWidth: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 4,
    },
    saveButtonPillText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
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
      marginTop: 12,
      paddingVertical: 8,
      paddingHorizontal: 4,
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
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 12,
      fontSize: 15,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.45)',
      minHeight: 36,
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
      marginTop: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.4)',
      backgroundColor: 'rgba(255,255,255,0.55)',
      overflow: 'hidden',
      maxHeight: 160,
    },
    suggestRow: {
      paddingVertical: 8,
      paddingHorizontal: 10,
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
      marginTop: 8,
      padding: 10,
      borderRadius: 14,
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
    /** 资产详情 · 交易明细表 */
    tradeDetailSection: {
      marginTop: 8,
    },
    tradeDetailTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    tradeDetailTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: p,
      letterSpacing: -0.35,
    },
    tradeDetailTitleActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    tradeTableScroll: {
      marginHorizontal: -6,
    },
    tradeTableInner: {
      minWidth: 336,
      paddingBottom: 4,
    },
    tradeTableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p12,
    },
    tradeTh: {
      fontSize: 11,
      fontWeight: '700',
      color: p55,
    },
    tradeTableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p08,
    },
    tradeTypeCol: {
      flexDirection: 'row',
      alignItems: 'center',
      width: 130,
      gap: 8,
      paddingRight: 4,
    },
    tradeIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(186, 202, 224, 0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tradeTypeLabel: {
      fontSize: 15,
      fontWeight: '700',
    },
    tradeTypeDate: {
      fontSize: 11,
      fontWeight: '500',
      color: p55,
      marginTop: 2,
    },
    tradeQtyCol: {
      width: 36,
      alignItems: 'flex-end',
    },
    tradeTdNum: {
      fontSize: 14,
      fontWeight: '600',
      color: p,
    },
    tradePriceCol: {
      width: 96,
      alignItems: 'flex-end',
    },
    tradeFundCol: {
      width: 86,
      paddingLeft: 2,
    },
    tradeTdFund: {
      fontSize: 12,
      fontWeight: '600',
      color: p65,
    },
    tradePnlCol: {
      width: 102,
      alignItems: 'flex-end',
    },
    tradeTdPnl: {
      fontSize: 13,
      fontWeight: '700',
    },
    tradeEditHint: {
      fontSize: 11,
      color: p55,
      marginTop: 10,
      textAlign: 'center',
    },
  });
}

export type AddModalStyles = ReturnType<typeof createAddModalStyles>;
