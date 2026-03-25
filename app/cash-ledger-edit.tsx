/**
 * 编辑或删除单条现金/余额流水（入金、出金，无单价）。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { createAddModalStyles } from '@/lib/modal-styles';
import { getAssets, saveAssets, updateAsset } from '@/lib/asset-storage';
import {
  deleteCashLedgerEntry,
  updateCashLedgerEntry,
} from '@/lib/cash-ledger';
import { deleteListedTradeEntry, updateListedTradeEntry } from '@/lib/trade-ledger';
import { useGlobalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
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
import {
  formatMoney,
  getAssetCurrency,
  getAssetDisplayValue,
} from '@/lib/asset-value';
import type { CashLedgerEntry, SimpleAsset } from '@/types/asset';

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
  const placeholderColor = useMemo(
    () => rgbaFromHex(theme.primary, 0.42),
    [theme.primary]
  );

  const [asset, setAsset] = useState<SimpleAsset | null>(null);
  const [entry, setEntry] = useState<CashLedgerEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState<'in' | 'out'>('in');
  const [entryDate, setEntryDate] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!assetId || !entryId) {
      setAsset(null);
      setEntry(null);
      setLoading(false);
      return;
    }
    const list = await getAssets();
    const a = list.find((x) => x.id === assetId) ?? null;
    const e = a?.cashLedger?.find((x) => x.id === entryId) ?? null;
    setAsset(a);
    setEntry(e);
    if (e) {
      setSide(e.side);
      setEntryDate(e.entryDate);
      setAmount(String(e.amount));
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
        Alert.alert('无法保存', '该流水为联动转账记录，类型不可修改（入金/出金）。');
        return;
      }
    }
    setSaving(true);
    try {
      const next = updateCashLedgerEntry(asset, entry.id, {
        side,
        amount: q,
        entryDate: d,
      });
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>类型</Text>
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
              入金
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
              出金
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>日期（YYYY-MM-DD）</Text>
        <TextInput
          style={styles.input}
          value={entryDate}
          onChangeText={setEntryDate}
          placeholder="2025-03-21"
          placeholderTextColor={placeholderColor}
        />

        <Text style={styles.label}>金额（{cur}）</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholderTextColor={placeholderColor}
        />
        <Text style={[styles.hintMuted, { marginTop: 6 }]}>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
