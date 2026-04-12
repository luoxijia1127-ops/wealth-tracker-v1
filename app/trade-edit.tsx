/**
 * 编辑或删除单条加减仓流水。
 */

import { FormRow } from '@/components/add-asset/form-row';
import { FundingSourcePicker } from '@/components/add-asset/funding-source-picker';
import { GlassSurface } from '@/components/glass-surface';
import { YmdDateFields } from '@/components/ymd-date-fields';
import { useAppPalette } from '@/contexts/app-palette-context';
import { normalizeAssetCurrency } from '@/lib/asset-currency';
import { getAssetCurrency } from '@/lib/asset-value';
import { getAssets, saveAssets, updateAsset } from '@/lib/asset-storage';
import {
  appendCashMovement,
  deleteCashLedgerEntry,
  usesCashAmountLedger,
} from '@/lib/cash-ledger';
import { rgbaFromHex } from '@/lib/color-utils';
import { convertListingCostToCnyCashDebit } from '@/lib/fx-rates';
import { createAddModalStyles } from '@/lib/modal-styles';
import {
  deleteListedTradeEntry,
  updateListedTradeEntry,
} from '@/lib/trade-ledger';
import type { SimpleAsset, TradeLedgerEntry } from '@/types/asset';
import { getListedUnitPrice } from '@/types/asset';
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

const FUNDING_ACCOUNT_ROW_LABEL =
  '资金账户（选填，加仓为扣款来源，减仓为入账去向）';

/** 从所有类现金资产中移除指定 transferId 的一条流水（用于重绑资金账户前清理旧联动）。 */
function stripCashEntryByTransferId(
  all: SimpleAsset[],
  transferId: string
): SimpleAsset[] {
  return all.map((a) => {
    const rows = a.cashLedger ?? [];
    const hit = rows.find((e) => e.transferId === transferId);
    if (!hit) return a;
    return deleteCashLedgerEntry(a, hit.id);
  });
}

function buildFundingPatch(
  side: 'buy' | 'sell',
  linkId: string,
  options: SimpleAsset[],
  reuseTransferId: string | undefined
): Partial<TradeLedgerEntry> {
  if (!linkId) {
    return {
      fundingSourceAssetId: undefined,
      fundingSourceAssetName: undefined,
      cashDestinationAssetId: undefined,
      cashDestinationAssetName: undefined,
      transferId: undefined,
    };
  }
  const peerName = options.find((x) => x.id === linkId)?.name;
  const tid =
    reuseTransferId ??
    `xf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (side === 'buy') {
    return {
      fundingSourceAssetId: linkId,
      fundingSourceAssetName: peerName,
      cashDestinationAssetId: undefined,
      cashDestinationAssetName: undefined,
      transferId: tid,
    };
  }
  return {
    fundingSourceAssetId: undefined,
    fundingSourceAssetName: undefined,
    cashDestinationAssetId: linkId,
    cashDestinationAssetName: peerName,
    transferId: tid,
  };
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
  const iconMuted = useMemo(
    () => rgbaFromHex(theme.primary, 0.5),
    [theme.primary]
  );

  const [asset, setAsset] = useState<SimpleAsset | null>(null);
  const [trade, setTrade] = useState<TradeLedgerEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [tradeDate, setTradeDate] = useState('');
  const [shares, setShares] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [linkedCashId, setLinkedCashId] = useState('');
  const [tradeFundingOptions, setTradeFundingOptions] = useState<SimpleAsset[]>(
    []
  );
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!assetId || !tradeId) {
      setAsset(null);
      setTrade(null);
      setTradeFundingOptions([]);
      setLoading(false);
      return;
    }
    const list = await getAssets();
    const a = list.find((x) => x.id === assetId) ?? null;
    const t = a?.tradeHistory?.find((x) => x.id === tradeId) ?? null;
    setAsset(a);
    setTrade(t);
    setTradeFundingOptions(
      list.filter(
        (x) =>
          x.id !== assetId &&
          usesCashAmountLedger(x) &&
          normalizeAssetCurrency(x.currency) === 'CNY'
      )
    );
    if (t) {
      setSide(t.side);
      setTradeDate(t.tradeDate);
      setShares(String(t.shares));
      setUnitPrice(String(t.unitPriceCny));
      const lid =
        t.side === 'buy'
          ? (t.fundingSourceAssetId ?? '')
          : (t.cashDestinationAssetId ?? '');
      setLinkedCashId(lid);
    } else {
      setLinkedCashId('');
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
    const linkId = linkedCashId.trim();
    setSaving(true);
    try {
      let all = await getAssets();
      if (trade.transferId) {
        all = stripCashEntryByTransferId(all, trade.transferId);
      }
      const curIdx = all.findIndex((x) => x.id === asset.id);
      if (curIdx < 0) {
        Alert.alert('无法保存', '资产数据已变化，请返回重试。');
        return;
      }
      const cur = all[curIdx]!;
      const fundingPatch = buildFundingPatch(
        side,
        linkId,
        tradeFundingOptions,
        linkId ? trade.transferId : undefined
      );
      let next = updateListedTradeEntry(cur, trade.id, {
        side,
        shares: q,
        unitPriceCny: p,
        tradeDate: d,
        ...fundingPatch,
      });
      next = preserveQuotes(asset, next);
      next = recalcValue(next);
      all[curIdx] = next;

      if (linkId) {
        const peerIdx = all.findIndex((x) => x.id === linkId);
        if (peerIdx < 0) {
          Alert.alert('无法保存', '所选资金账户不存在或已删除。');
          return;
        }
        const tid = fundingPatch.transferId;
        if (!tid) {
          Alert.alert('无法保存', '联动信息无效，请重试。');
          return;
        }
        const listingCur = getAssetCurrency(next);
        const rawAmount = q * p;
        const conv = await convertListingCostToCnyCashDebit(rawAmount, listingCur);
        if (!conv.ok) {
          Alert.alert('无法保存', conv.message);
          return;
        }
        const amount = conv.cny;
        const note =
          listingCur === 'CNY'
            ? side === 'buy'
              ? '加仓资金划转'
              : '减仓资金划转'
            : side === 'buy'
              ? `加仓资金划转（${listingCur} ${rawAmount.toFixed(2)} 折人民币扣款）`
              : `减仓资金划转（${listingCur} ${rawAmount.toFixed(2)} 折人民币入账）`;
        const peer = all[peerIdx]!;
        try {
          if (side === 'buy') {
            all[peerIdx] = appendCashMovement(peer, 'out', amount, d, {
              relatedAssetId: asset.id,
              relatedAssetName: next.name,
              note,
              transferId: tid,
            });
          } else {
            all[peerIdx] = appendCashMovement(peer, 'in', amount, d, {
              relatedAssetId: asset.id,
              relatedAssetName: next.name,
              note,
              transferId: tid,
            });
          }
        } catch (e) {
          Alert.alert(
            '无法保存',
            e instanceof Error ? e.message : '资金账户余额或流水校验失败。'
          );
          return;
        }
      }

      await saveAssets(all);
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
            let all = await getAssets();
            if (trade.transferId) {
              all = stripCashEntryByTransferId(all, trade.transferId);
            }
            const curIdx = all.findIndex((x) => x.id === asset.id);
            if (curIdx < 0) {
              await updateAsset(
                recalcValue(
                  preserveQuotes(asset, deleteListedTradeEntry(asset, trade.id))
                )
              );
              router.back();
              return;
            }
            const cur = all[curIdx]!;
            let next = deleteListedTradeEntry(cur, trade.id);
            next = preserveQuotes(asset, next);
            next = recalcValue(next);
            all[curIdx] = next;
            await saveAssets(all);
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
            icon="swap-horizontal-outline"
            label="方向"
          >
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
          </FormRow>

          <FormRow
            styles={styles}
            iconMuted={iconMuted}
            icon="calendar-outline"
            label="成交日期（年 · 月 · 日）"
          >
            <YmdDateFields
              value={tradeDate}
              onChangeText={setTradeDate}
              placeholderColor={placeholderColor}
              inputStyle={styles.input}
              labelColor={rgbaFromHex(theme.primary, 0.62)}
            />
          </FormRow>

          <FormRow
            styles={styles}
            iconMuted={iconMuted}
            icon={useGram ? 'fitness-outline' : 'pie-chart-outline'}
            label={useGram ? '克数' : '份额'}
          >
            <TextInput
              style={styles.input}
              value={shares}
              onChangeText={setShares}
              keyboardType="decimal-pad"
              placeholderTextColor={placeholderColor}
            />
          </FormRow>

          <FormRow
            styles={styles}
            iconMuted={iconMuted}
            icon="pricetag-outline"
            label="成交单价"
          >
            <TextInput
              style={styles.input}
              value={unitPrice}
              onChangeText={setUnitPrice}
              keyboardType="decimal-pad"
              placeholderTextColor={placeholderColor}
            />
          </FormRow>

          <FormRow
            styles={styles}
            iconMuted={iconMuted}
            icon="wallet-outline"
            label={FUNDING_ACCOUNT_ROW_LABEL}
          >
            <FundingSourcePicker
              label={FUNDING_ACCOUNT_ROW_LABEL}
              emptyOptionLabel="不关联现金账户"
              valueId={linkedCashId}
              onSelectId={setLinkedCashId}
              fundingOptions={tradeFundingOptions}
              styles={styles}
              omitLabel
              mode="modal"
              primaryColor={theme.primary}
              mutedColor={iconMuted}
            />
          </FormRow>

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
