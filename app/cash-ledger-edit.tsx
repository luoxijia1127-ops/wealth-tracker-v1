/**
 * 编辑或删除单条现金/余额流水（增加、减少，无单价）。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { getAssets, saveAssets, updateAsset } from '@/lib/asset-storage';
import {
  formatMoney,
  getAssetCurrency,
  getAssetDisplayValue,
  isHeldChineseAsset,
} from '@/lib/asset-value';
import {
  deleteCashLedgerEntry,
  updateCashLedgerEntry,
} from '@/lib/cash-ledger';
import { FormRow } from '@/components/add-asset/form-row';
import { FundingSourcePicker } from '@/components/add-asset/funding-source-picker';
import { YmdDateFields } from '@/components/ymd-date-fields';
import { GlassSurface } from '@/components/glass-surface';
import { rgbaFromHex } from '@/lib/color-utils';
import { createAddModalStyles } from '@/lib/modal-styles';
import { deleteListedTradeEntry, updateListedTradeEntry } from '@/lib/trade-ledger';
import type { CashLedgerEntry, SimpleAsset } from '@/types/asset';
import { useFocusEffect } from '@react-navigation/native';
import { useGlobalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CashLedgerEditScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { assetId, entryId } = useGlobalSearchParams<{
    assetId?: string;
    entryId?: string;
  }>();
  const { theme } = useAppPalette();
  const styles = useMemo(() => createAddModalStyles(theme), [theme]);
  const labelMuted = useMemo(
    () => rgbaFromHex(theme.primary, 0.62),
    [theme.primary]
  );
  const placeholderColor = useMemo(
    () => rgbaFromHex(theme.primary, 0.42),
    [theme.primary]
  );
  const iconMuted = useMemo(
    () => rgbaFromHex(theme.primary, 0.5),
    [theme.primary]
  );

  const [asset, setAsset] = useState<SimpleAsset | null>(null);
  const [entry, setEntry] = useState<CashLedgerEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState<'in' | 'out'>('in');
  const [entryDate, setEntryDate] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [relatedListedId, setRelatedListedId] = useState('');
  const [listedRelatedOptions, setListedRelatedOptions] = useState<SimpleAsset[]>(
    []
  );
  const [linkedTradeEditId, setLinkedTradeEditId] = useState<string | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!assetId || !entryId) {
      setAsset(null);
      setEntry(null);
      setListedRelatedOptions([]);
      setLinkedTradeEditId(null);
      setLoading(false);
      return;
    }
    const list = await getAssets();
    const a = list.find((x) => x.id === assetId) ?? null;
    const e = a?.cashLedger?.find((x) => x.id === entryId) ?? null;
    setAsset(a);
    setEntry(e);
    setListedRelatedOptions(
      list.filter((x) => x.id !== assetId && isHeldChineseAsset(x))
    );
    let tradeNav: string | null = null;
    if (e?.transferId && e.relatedAssetId) {
      const ta = list.find((x) => x.id === e.relatedAssetId);
      const lt = ta?.tradeHistory?.find((t) => t.transferId === e.transferId);
      tradeNav = lt?.id ?? null;
    }
    setLinkedTradeEditId(tradeNav);
    if (e) {
      setSide(e.side);
      setEntryDate(e.entryDate);
      setAmount(String(e.amount));
      setNote(e.note ?? '');
      setRelatedListedId(e.relatedAssetId ?? '');
    } else {
      setNote('');
      setRelatedListedId('');
    }
    setLoading(false);
  }, [assetId, entryId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '编辑余额流水',
      headerStyle: { backgroundColor: theme.pageBg },
      headerTintColor: theme.primary,
      headerTitleStyle: {
        color: theme.primary,
        fontWeight: '700',
        fontSize: 17,
      },
    });
  }, [navigation, theme.pageBg, theme.primary]);

  const cur = asset ? getAssetCurrency(asset) : 'CNY';

  const onSave = async () => {
    if (!asset || !entry) return;
    const q = parseFloat(amount);
    if (Number.isNaN(q) || q <= 0) {
      Alert.alert('无法保存', '金额须为正数。');
      return;
    }
    const d = entryDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      Alert.alert('无法保存', '日期请使用 YYYY-MM-DD。');
      return;
    }
    const linkedTradeAssetId = entry.relatedAssetId;
    const linkedTransferId = entry.transferId;
    if (linkedTradeAssetId && linkedTransferId) {
      // 该流水是内部转账联动的一部分，不允许用户把 in/out 颠倒，否则会破坏对账关系
      // （买入对应 out；卖出对应 in）
      // 这里不做强推断，仅禁止改变原 side
      if (side !== entry.side) {
        Alert.alert('无法保存', '该流水为联动转账记录，类型不可修改（增加/减少）。');
        return;
      }
    }
    setSaving(true);
    try {
      const noteTrim = note.trim();
      const patch: Parameters<typeof updateCashLedgerEntry>[2] = {
        side,
        amount: q,
        entryDate: d,
        note: noteTrim.length > 0 ? noteTrim : undefined,
      };
      if (!(linkedTradeAssetId && linkedTransferId)) {
        const rid = relatedListedId.trim();
        if (rid) {
          patch.relatedAssetId = rid;
          patch.relatedAssetName =
            listedRelatedOptions.find((x) => x.id === rid)?.name ??
            entry.relatedAssetName;
        } else {
          patch.relatedAssetId = undefined;
          patch.relatedAssetName = undefined;
        }
      }
      const next = updateCashLedgerEntry(asset, entry.id, patch);
      if (linkedTradeAssetId && linkedTransferId) {
        const all = await getAssets();
        const srcIdx = all.findIndex((x) => x.id === asset.id);
        const tradeAssetIdx = all.findIndex((x) => x.id === linkedTradeAssetId);
        if (srcIdx >= 0 && tradeAssetIdx >= 0) {
          const tradeAsset = all[tradeAssetIdx]!;
          const linkedTrade = (tradeAsset.tradeHistory ?? []).find(
            (t) => t.transferId === linkedTransferId
          );
          if (linkedTrade) {
            if (!(linkedTrade.shares > 0)) {
              Alert.alert('无法保存', '关联交易份额无效，无法按金额回算单价。');
              return;
            }
            const patchedTrade = updateListedTradeEntry(tradeAsset, linkedTrade.id, {
              tradeDate: d,
              unitPriceCny: q / linkedTrade.shares,
            });
            all[srcIdx] = next;
            all[tradeAssetIdx] = patchedTrade;
            await saveAssets(all);
          } else {
            await updateAsset(next);
          }
        } else {
          await updateAsset(next);
        }
      } else {
        await updateAsset(next);
      }
      router.back();
    } catch (e) {
      Alert.alert(
        '无法保存',
        e instanceof Error ? e.message : '流水与余额不一致。'
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!asset || !entry) return;
    Alert.alert('删除流水', '确定删除？将按剩余流水重算余额。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const next = deleteCashLedgerEntry(asset, entry.id);
            if (entry.relatedAssetId && entry.transferId) {
              const all = await getAssets();
              const srcIdx = all.findIndex((x) => x.id === asset.id);
              const tradeAssetIdx = all.findIndex(
                (x) => x.id === entry.relatedAssetId
              );
              if (srcIdx >= 0 && tradeAssetIdx >= 0) {
                const tradeAsset = all[tradeAssetIdx]!;
                const linkedTrade = (tradeAsset.tradeHistory ?? []).find(
                  (t) => t.transferId === entry.transferId
                );
                if (linkedTrade) {
                  all[tradeAssetIdx] = deleteListedTradeEntry(
                    tradeAsset,
                    linkedTrade.id
                  );
                }
                all[srcIdx] = next;
                await saveAssets(all);
              } else {
                await updateAsset(next);
              }
            } else {
              await updateAsset(next);
            }
            router.back();
          } catch (e) {
            Alert.alert(
              '失败',
              e instanceof Error ? e.message : '无法删除'
            );
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  if (!assetId || !entryId) {
    return (
      <View style={[styles.keyboardRoot, { padding: 24 }]}>
        <Text style={styles.headerName}>参数无效</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.keyboardRoot, { paddingTop: 80, alignItems: 'center' }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!asset || !entry) {
    return (
      <View style={[styles.keyboardRoot, { padding: 24 }]}>
        <Text style={styles.headerName}>未找到该流水</Text>
        <Pressable style={[styles.saveButton, { marginTop: 20 }]} onPress={() => router.back()}>
          <Text style={styles.saveButtonText}>返回</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
    >
      <View style={styles.modalAmbient} pointerEvents="none" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 14,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <GlassSurface borderRadius={32} intensity={50} contentStyle={styles.glassFormInner}>
          <FormRow
            first
            styles={styles}
            iconMuted={iconMuted}
            icon="swap-vertical-outline"
            label="类型"
          >
            <View style={styles.optionsRow}>
              <Pressable
                style={[styles.option, side === 'in' && styles.optionSelected]}
                onPress={() => setSide('in')}
              >
                <Text
                  style={[
                    styles.optionText,
                    side === 'in' && styles.optionTextSelected,
                  ]}
                >
                  增加
                </Text>
              </Pressable>
              <Pressable
                style={[styles.option, side === 'out' && styles.optionSelected]}
                onPress={() => setSide('out')}
              >
                <Text
                  style={[
                    styles.optionText,
                    side === 'out' && styles.optionTextSelected,
                  ]}
                >
                  减少
                </Text>
              </Pressable>
            </View>
          </FormRow>

          <FormRow
            styles={styles}
            iconMuted={iconMuted}
            icon="calendar-outline"
            label="日期（年 · 月 · 日）"
          >
            <YmdDateFields
              value={entryDate}
              onChangeText={setEntryDate}
              placeholderColor={placeholderColor}
              inputStyle={styles.input}
              labelColor={labelMuted}
            />
          </FormRow>

          <FormRow
            styles={styles}
            iconMuted={iconMuted}
            icon="cash-outline"
            label={`金额（${cur}）`}
          >
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholderTextColor={placeholderColor}
            />
          </FormRow>

          {entry.transferId && entry.relatedAssetId ? (
            <View style={{ marginTop: 10 }}>
              <Text style={[styles.hintMuted, { lineHeight: 20 }]}>
                本笔与场内成交联动，扣款/入账资金账户请在对应证券的「编辑加减仓流水」中修改。
              </Text>
              {linkedTradeEditId ? (
                <Pressable
                  style={[styles.saveButton, { marginTop: 12 }]}
                  onPress={() =>
                    router.push({
                      pathname: '/trade-edit',
                      params: {
                        assetId: entry.relatedAssetId,
                        tradeId: linkedTradeEditId,
                      },
                    })
                  }
                >
                  <Text style={styles.saveButtonText}>打开场内流水与资金账户</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <FormRow
              styles={styles}
              iconMuted={iconMuted}
              icon="link-outline"
              label="关联证券（选填）"
            >
              <FundingSourcePicker
                label="关联证券（选填）"
                emptyOptionLabel="不关联"
                valueId={relatedListedId}
                onSelectId={setRelatedListedId}
                fundingOptions={listedRelatedOptions}
                styles={styles}
                omitLabel
                mode="modal"
                primaryColor={theme.primary}
                mutedColor={iconMuted}
              />
            </FormRow>
          )}

          <FormRow
            styles={styles}
            iconMuted={iconMuted}
            icon="document-text-outline"
            label="备注"
          >
            <TextInput
              style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
              value={note}
              onChangeText={setNote}
              placeholder="用途、账户说明等"
              placeholderTextColor={placeholderColor}
              multiline
            />
          </FormRow>

          <Text style={[styles.hintMuted, { marginTop: 8 }]}>
            当前余额参考：{' '}
            {formatMoney(getAssetDisplayValue(asset), getAssetCurrency(asset))}
          </Text>

          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={() => void onSave()}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? '保存中…' : '保存'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.saveButton,
              { marginTop: 14, backgroundColor: 'rgba(220, 38, 38, 0.9)' },
              saving && styles.saveButtonDisabled,
            ]}
            onPress={onDelete}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>删除此流水</Text>
          </Pressable>
        </GlassSurface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
