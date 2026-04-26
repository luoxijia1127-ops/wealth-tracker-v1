/**
 * 资金来源 / 资金去向：可选 Modal（编辑页）或内联下拉（添加资产页）。
 */

import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/language-context';
import type { AddModalStyles } from '@/lib/modal-styles';
import type { SimpleAsset } from '@/types/asset';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export function FundingSourcePicker({
  label,
  emptyOptionLabel,
  valueId,
  onSelectId,
  fundingOptions,
  styles,
  omitLabel,
  mode = 'modal',
  menuKey = 'funding',
  openKey,
  setOpenKey,
  primaryColor = '#111',
  mutedColor = '#888',
}: {
  label: string;
  emptyOptionLabel: string;
  valueId: string;
  onSelectId: (id: string) => void;
  fundingOptions: SimpleAsset[];
  styles: AddModalStyles;
  omitLabel?: boolean;
  mode?: 'modal' | 'inline';
  menuKey?: string;
  openKey?: string | null;
  setOpenKey?: (k: string | null) => void;
  primaryColor?: string;
  mutedColor?: string;
}) {
  const { t } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);
  const selectedLabel =
    valueId === ''
      ? emptyOptionLabel
      : (fundingOptions.find((x) => x.id === valueId)?.name ?? emptyOptionLabel);

  const open =
    mode === 'inline'
      ? openKey === menuKey
      : modalOpen;

  const toggle = () => {
    if (mode === 'inline' && setOpenKey) {
      setOpenKey(open ? null : menuKey);
    } else {
      setModalOpen(true);
    }
  };

  const close = () => {
    if (mode === 'inline' && setOpenKey) setOpenKey(null);
    else setModalOpen(false);
  };

  const pick = (id: string) => {
    onSelectId(id);
    close();
  };

  if (mode === 'inline') {
    return (
      <>
        {!omitLabel ? <Text style={styles.label}>{label}</Text> : null}
        <View style={inlineStyles.wrap}>
          <Pressable
            style={[
              inlineStyles.trigger,
              { borderColor: `${primaryColor}22` },
            ]}
            onPress={toggle}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Text
              style={[inlineStyles.triggerText, { color: primaryColor }]}
              numberOfLines={3}
            >
              {selectedLabel}
            </Text>
            <Ionicons name="chevron-down" size={14} color={mutedColor} />
          </Pressable>
          {open ? (
            <View
              style={[
                inlineStyles.menu,
                {
                  borderColor: `${primaryColor}28`,
                  backgroundColor: 'rgba(255,255,255,0.98)',
                },
              ]}
            >
              <ScrollView
                style={inlineStyles.menuScroll}
                contentContainerStyle={{ paddingBottom: 8 }}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator
                bounces
              >
                <Pressable
                  onPress={() => pick('')}
                  style={({ pressed }) => [
                    inlineStyles.row,
                    valueId === '' && { backgroundColor: `${primaryColor}12` },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[inlineStyles.rowText, { color: primaryColor }]}>
                    {emptyOptionLabel}
                  </Text>
                </Pressable>
                {fundingOptions.map((fo) => (
                  <Pressable
                    key={fo.id}
                    onPress={() => pick(fo.id)}
                    style={({ pressed }) => [
                      inlineStyles.row,
                      valueId === fo.id && {
                        backgroundColor: `${primaryColor}12`,
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={[inlineStyles.rowText, { color: primaryColor }]}>
                      {fo.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </>
    );
  }

  return (
    <>
      {!omitLabel ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={styles.selectFieldButton}
        onPress={() => setModalOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.selectFieldButtonText} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Text style={styles.currencyChevron}>▼</Text>
      </Pressable>
      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.currencyModalBackdrop}>
          <Pressable
            style={styles.currencyModalDismiss}
            onPress={() => setModalOpen(false)}
            accessibilityLabel="关闭"
          />
          <View style={styles.currencyModalCard}>
            <Text style={styles.currencyModalTitle}>{label}</Text>
            <Pressable
              style={[
                styles.currencyModalRow,
                valueId === '' && styles.currencyModalRowSelected,
              ]}
              onPress={() => pick('')}
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
                onPress={() => pick(fo.id)}
              >
                <Text style={styles.currencyModalRowLabel} numberOfLines={2}>
                  {fo.name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.currencyModalCancel}
              onPress={() => setModalOpen(false)}
            >
              <Text style={styles.currencyModalCancelText}>
                {t('common.cancel')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const inlineStyles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 20,
    alignSelf: 'stretch',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
  },
  menu: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    marginTop: 4,
    maxHeight: 280,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    zIndex: 100,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  menuScroll: {
    maxHeight: 280,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  rowText: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
});
