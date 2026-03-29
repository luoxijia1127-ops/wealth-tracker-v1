/**
 * 编辑或删除单条加减仓流水。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { createAddModalStyles } from '@/lib/modal-styles';
import { getAssets, saveAssets, updateAsset } from '@/lib/asset-storage';
import { deleteCashLedgerEntry, updateCashLedgerEntry } from '@/lib/cash-ledger';
import {
  deleteListedTradeEntry,
  updateListedTradeEntry,
} from '@/lib/trade-ledger';
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
import type { SimpleAsset, TradeLedgerEntry } from '@/types/asset';
import { getListedUnitPrice } from '@/types/asset';

function preserveQuotes(from: SimpleAsset, to: SimpleAsset): SimpleAsset {
  return {
    ...to,
    lastClose: from.lastClose,
    lastCloseDate: from.lastCloseDate,
    markPrice: from.markPrice,
    markPriceDate: from.markPriceDate,
  };
}

function recalcValue(a: SimpleAsset): SimpleAsset {
  const sh = a.shares ?? 0;
  if (sh <= 0) return { ...a, value: 0 };
  const u = getListedUnitPrice(a);
  if (u !== null) return { ...a, value: sh * u };
  if (typeof a.lastClose === 'number' && a.lastClose > 0) {
    return { ...a, value: sh * a.lastClose };
  }
  return a;
}

export default function TradeEditScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { assetId, tradeId } = useGlobalSearchParams<{
    assetId?: string;
    tradeId?: string;
  }>();
  const { theme } = useAppPalette();
  const styles = useMemo(() => createAddModalStyles(theme), [theme]);
  const placeholderColor = useMemo(
    () => rgbaFromHex(theme.primary, 0.42),
    [theme.primary]
  );

  const [asset, setAsset] = useState<SimpleAsset | null>(null);
  const [trade, setTrade] = useState<TradeLedgerEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [tradeDate, setTradeDate] = useState('');
  const [shares, setShares] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!assetId || !tradeId) {
      setAsset(null);
      setTrade(null);
      setLoading(false);
      return;
    }
    const list = await getAssets();
    const a = list.find((x) => x.id === assetId) ?? null;
    const t = a?.tradeHistory?.find((x) => x.id === tradeId) ?? null;
    setAsset(a);
    setTrade(t);
    if (t) {
      setSide(t.side);
      setTradeDate(t.tradeDate);
      setShares(String(t.shares));
      setUnitPrice(String(t.unitPriceCny));
    }
    setLoading(false);
  }, [assetId, tradeId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const useGram = asset?.category === 'Gold';

  useLayoutEffect(() => {
    navigation.setOptions({
      title: useGram ? '编辑流水（克）' : '编辑流水',
      headerStyle: { backgroundColor: theme.pageBg },
      headerTintColor: theme.primary,
      headerTitleStyle: {
        color: theme.primary,
        fontWeight: '700',
        fontSize: 17,
      },
    });
  }, [navigation, theme.pageBg, theme.primary, useGram]);

  const onSave = async () => {
    if (!asset || !trade) return;
    const q = parseFloat(shares);
    const p = parseFloat(unitPrice);
    if (Number.isNaN(q) || q <= 0) {
      Alert.alert('无法保存', asset.category === 'Gold' ? '克数须为正数。' : '份额须为正数。');
      return;
    }
    if (Number.isNaN(p) || p < 0) {
      Alert.alert('无法保存', '单价须为非负数。');
      return;
    }
    const d = tradeDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      Alert.alert('无法保存', '日期请使用 YYYY-MM-DD。');
      return;
    }
    setSaving(true);
    try {
      let next = updateListedTradeEntry(asset, trade.id, {
        side,
        shares: q,
        unitPriceCny: p,
        tradeDate: d,
      });
      next = preserveQuotes(asset, next);
      next = recalcValue(next);
      if (trade.transferId && (trade.fundingSourceAssetId || trade.cashDestinationAssetId)) {
        const all = await getAssets();
        const curIdx = all.findIndex((x) => x.id === asset.id);
        const peerId = trade.side === 'buy' ? trade.fundingSourceAssetId : trade.cashDestinationAssetId;
        const peerIdx = peerId ? all.findIndex((x) => x.id === peerId) : -1;
        if (curIdx >= 0 && peerIdx >= 0) {
          const peer = all[peerIdx]!;
          const peerRows = peer.cashLedger ?? [];
          const linked = peerRows.find((e) => e.transferId === trade.transferId);
          if (linked) {
            const wantBuy = side === 'buy';
            const patched = updateCashLedgerEntry(peer, linked.id, {
              side: wantBuy ? 'out' : 'in',
              amount: q * p,
              entryDate: d,
              relatedAssetId: asset.id,
              relatedAssetName: asset.name,
              note: linked.note ?? '资金划转',
              transferId: trade.transferId,
            });
            all[peerIdx] = patched;
          } else if (side === 'buy') {
            const oldAmount = trade.shares * trade.unitPriceCny;
            const fallback = peerRows.find(
              (e) =>
                e.side === (trade.side === 'buy' ? 'out' : 'in') &&
                e.relatedAssetId === asset.id &&
                Math.abs(e.amount - oldAmount) < 1e-6 &&
                e.entryDate === trade.tradeDate
            );
            if (fallback) {
              const patched = updateCashLedgerEntry(peer, fallback.id, {
                side: side === 'buy' ? 'out' : 'in',
                amount: q * p,
                entryDate: d,
                relatedAssetId: asset.id,
                relatedAssetName: asset.name,
                note: fallback.note ?? '资金划转',
                transferId: trade.transferId,
              });
              all[peerIdx] = patched;
            }
          }
          all[curIdx] = next;
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
        '无法保存',
        e instanceof Error ? e.message : '流水与持仓不一致，请检查数值。'
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!asset || !trade) return;
    Alert.alert('删除流水', '确定删除？将按剩余流水重算持仓。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            let next = deleteListedTradeEntry(asset, trade.id);
            next = preserveQuotes(asset, next);
            next = recalcValue(next);
            if (trade.transferId && (trade.fundingSourceAssetId || trade.cashDestinationAssetId)) {
              const all = await getAssets();
              const curIdx = all.findIndex((x) => x.id === asset.id);
              const peerId = trade.side === 'buy' ? trade.fundingSourceAssetId : trade.cashDestinationAssetId;
              const peerIdx = peerId ? all.findIndex((x) => x.id === peerId) : -1;
              if (curIdx >= 0 && peerIdx >= 0) {
                const peer = all[peerIdx]!;
                const linked = (peer.cashLedger ?? []).find(
                  (e) => e.transferId === trade.transferId
                );
                if (linked) {
                  all[peerIdx] = deleteCashLedgerEntry(peer, linked.id);
                }
                all[curIdx] = next;
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

  if (!assetId || !tradeId) {
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

  if (!asset || !trade) {
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
        <Text style={styles.label}>方向</Text>
        <View style={styles.optionsRow}>
          <Pressable
            style={[styles.option, side === 'buy' && styles.optionSelected]}
            onPress={() => setSide('buy')}
          >
            <Text
              style={[
                styles.optionText,
                side === 'buy' && styles.optionTextSelected,
              ]}
            >
              买入
            </Text>
          </Pressable>
          <Pressable
            style={[styles.option, side === 'sell' && styles.optionSelected]}
            onPress={() => setSide('sell')}
          >
            <Text
              style={[
                styles.optionText,
                side === 'sell' && styles.optionTextSelected,
              ]}
            >
              卖出
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>成交日期（YYYY-MM-DD）</Text>
        <TextInput
          style={styles.input}
          value={tradeDate}
          onChangeText={setTradeDate}
          placeholder="2025-03-21"
          placeholderTextColor={placeholderColor}
        />

        <Text style={styles.label}>{useGram ? '克数' : '份额'}</Text>
        <TextInput
          style={styles.input}
          value={shares}
          onChangeText={setShares}
          keyboardType="decimal-pad"
          placeholderTextColor={placeholderColor}
        />

        <Text style={styles.label}>成交单价</Text>
        <TextInput
          style={styles.input}
          value={unitPrice}
          onChangeText={setUnitPrice}
          keyboardType="decimal-pad"
          placeholderTextColor={placeholderColor}
        />

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
