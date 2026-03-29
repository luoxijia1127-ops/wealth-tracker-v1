/**
 * 资金来源 / 资金去向：下拉选择，与编辑资产加减仓、新增资产共用。
 */

import type { AddModalStyles } from '@/lib/modal-styles';
import type { SimpleAsset } from '@/types/asset';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

export function FundingSourcePicker({
  label,
  emptyOptionLabel,
  valueId,
  onSelectId,
  fundingOptions,
  styles,
}: {
  label: string;
  /** 未选具体账户时的选项文案，如「其他外部资金」或「不入账」 */
  emptyOptionLabel: string;
  valueId: string;
  onSelectId: (id: string) => void;
  fundingOptions: SimpleAsset[];
  styles: AddModalStyles;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel =
    valueId === ''
      ? emptyOptionLabel
      : (fundingOptions.find((x) => x.id === valueId)?.name ?? emptyOptionLabel);

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.selectFieldButton}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.selectFieldButtonText} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Text style={styles.currencyChevron}>▼</Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.currencyModalBackdrop}>
          <Pressable
            style={styles.currencyModalDismiss}
            onPress={() => setOpen(false)}
            accessibilityLabel="关闭"
          />
          <View style={styles.currencyModalCard}>
            <Text style={styles.currencyModalTitle}>{label}</Text>
            <Pressable
              style={[
                styles.currencyModalRow,
                valueId === '' && styles.currencyModalRowSelected,
              ]}
              onPress={() => {
                onSelectId('');
                setOpen(false);
              }}
            >
              <Text style={styles.currencyModalRowLabel}>{emptyOptionLabel}</Text>
            </Pressable>
            {fundingOptions.map((fo) => (
              <Pressable
                key={fo.id}
                style={[
                  styles.currencyModalRow,
                  valueId === fo.id && styles.currencyModalRowSelected,
                ]}
                onPress={() => {
                  onSelectId(fo.id);
                  setOpen(false);
                }}
              >
                <Text style={styles.currencyModalRowLabel} numberOfLines={2}>
                  {fo.name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.currencyModalCancel}
              onPress={() => setOpen(false)}
            >
              <Text style={styles.currencyModalCancelText}>取消</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
