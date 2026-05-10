/**
 * 编辑或删除单条加减仓流水。
 */

import { FormRow } from '@/components/add-asset/form-row';
import { FundingSourcePicker } from '@/components/add-asset/funding-source-picker';
import { GlassSurface } from '@/components/glass-surface';
import { SettingsEditorialMasthead } from '@/components/settings-editorial-masthead';
import { YmdDateFields } from '@/components/ymd-date-fields';
import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { normalizeAssetCurrency } from '@/lib/asset-currency';
import { getAssetCurrency } from '@/lib/asset-value';
import { getAssets, saveAssets, updateAsset } from '@/lib/asset-storage';
import {
  appendCashMovement,
  stripCashTransferFromAssets,
  usesCashAmountLedger,
} from '@/lib/cash-ledger';
import { rgbaFromHex } from '@/lib/color-utils';
import { convertListingCostToCnyCashDebit } from '@/lib/fx-rates';
import { createAddModalStyles } from '@/lib/modal-styles';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import {
  deleteListedTradeEntry,
  updateListedTradeEntry,
} from '@/lib/trade-ledger';
import type { SimpleAsset, TradeLedgerEntry } from '@/types/asset';
import { getListedUnitPrice } from '@/types/asset';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { useFocusEffect } from '@react-navigation/native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
  const insets = useSafeAreaInsets();
  const { assetId, tradeId } = useGlobalSearchParams<{
    assetId?: string;
    tradeId?: string;
  }>();
  const { theme } = useAppPalette();
  const { t } = useLanguage();
  const styles = useMemo(() => createAddModalStyles(theme), [theme]);
  const hubStyles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
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

  const onSave = async () => {
    if (!asset || !trade) return;
    const q = parseFloat(shares);
    const p = parseFloat(unitPrice);
    if (Number.isNaN(q) || q <= 0) {
      Alert.alert(
        t('asset.form.cannotSave'),
        asset.category === 'Gold'
          ? t('trade.edit.quantityPositiveGram')
          : t('trade.edit.quantityPositiveShares')
      );
      return;
    }
    if (Number.isNaN(p) || p < 0) {
      Alert.alert(t('asset.form.cannotSave'), t('trade.edit.priceNonNegative'));
      return;
    }
    const d = tradeDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      Alert.alert(t('asset.form.cannotSave'), t('trade.edit.dateInvalid'));
      return;
    }
    const linkId = linkedCashId.trim();
    setSaving(true);
    try {
      let all = await getAssets();
      if (trade.transferId) {
        all = stripCashTransferFromAssets(all, trade.transferId);
      }
      const curIdx = all.findIndex((x) => x.id === asset.id);
      if (curIdx < 0) {
        Alert.alert(t('asset.form.cannotSave'), t('trade.edit.assetChanged'));
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
          Alert.alert(t('asset.form.cannotSave'), t('trade.edit.fundingMissing'));
          return;
        }
        const tid = fundingPatch.transferId;
        if (!tid) {
          Alert.alert(t('asset.form.cannotSave'), t('trade.edit.linkInvalid'));
          return;
        }
        const listingCur = getAssetCurrency(next);
        const rawAmount = q * p;
        const conv = await convertListingCostToCnyCashDebit(rawAmount, listingCur);
        if (!conv.ok) {
          Alert.alert(t('asset.form.cannotSave'), conv.message);
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
            t('asset.form.cannotSave'),
            e instanceof Error ? e.message : t('trade.edit.fundingValidationFailed')
          );
          return;
        }
      }

      await saveAssets(all);
      router.back();
    } catch (e) {
      Alert.alert(
        t('asset.form.cannotSave'),
        e instanceof Error ? e.message : t('trade.edit.positionMismatch')
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!asset || !trade) return;
    Alert.alert(t('trade.edit.deleteTitle'), t('trade.edit.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            let all = await getAssets();
            if (trade.transferId) {
              all = stripCashTransferFromAssets(all, trade.transferId);
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
              t('common.failed'),
              e instanceof Error ? e.message : t('trade.edit.deleteFailed')
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
      <View style={hubStyles.screen}>
        <View style={hubStyles.screenAmbient} pointerEvents="none" />
        <SettingsHubBackTopBar />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            hubStyles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <SettingsEditorialMasthead
            styles={hubStyles}
            title={t('masthead.editTrade')}
            kicker={t('masthead.editTradeKickerLot')}
          />
          <View style={{ paddingHorizontal: 24 }}>
            <Text style={styles.headerName}>{t('trade.edit.invalidParams')}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={hubStyles.screen}>
        <View style={hubStyles.screenAmbient} pointerEvents="none" />
        <SettingsHubBackTopBar />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            hubStyles.scrollContent,
            {
              flexGrow: 1,
              paddingBottom: insets.bottom + 24,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <SettingsEditorialMasthead
            styles={hubStyles}
            title={t('masthead.editTrade')}
            kicker={t('masthead.editTradeKickerLot')}
          />
          <View
            style={{
              flex: 1,
              minHeight: 200,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator color={theme.primary} />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!asset || !trade) {
    return (
      <View style={hubStyles.screen}>
        <View style={hubStyles.screenAmbient} pointerEvents="none" />
        <SettingsHubBackTopBar />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            hubStyles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <SettingsEditorialMasthead
            styles={hubStyles}
            title={t('masthead.editTrade')}
            kicker={t('masthead.editTradeKickerLot')}
          />
          <View style={{ paddingHorizontal: 24 }}>
            <Text style={styles.headerName}>{t('trade.edit.notFound')}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={hubStyles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
    >
      <View style={hubStyles.screenAmbient} pointerEvents="none" />
      <SettingsHubBackTopBar />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          hubStyles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <SettingsEditorialMasthead
          styles={hubStyles}
          title={t('masthead.editTrade')}
          kicker={
            useGram
              ? t('masthead.editTradeKickerGram')
              : t('masthead.editTradeKickerShares')
          }
        />
        <View style={{ paddingHorizontal: 14 }}>
        <GlassSurface borderRadius={32} intensity={50} contentStyle={styles.glassFormInner}>
          <FormRow
            first
            styles={styles}
            iconMuted={iconMuted}
            icon="swap-horizontal-outline"
            label={t('trade.edit.direction')}
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
                  {t('asset.detail.buy')}
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
                  {t('asset.detail.sell')}
                </Text>
              </Pressable>
            </View>
          </FormRow>

          <FormRow
            styles={styles}
            iconMuted={iconMuted}
            icon="calendar-outline"
            label={t('trade.edit.tradeDate')}
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
            label={useGram ? t('dashboard.gramUnit') : t('asset.form.shares')}
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
            label={t('asset.detail.price')}
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
            label={t('asset.detail.fundingAccount')}
          >
            <FundingSourcePicker
              label={t('asset.detail.fundingAccount')}
              emptyOptionLabel={t('asset.detail.noCashLink')}
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
              {saving ? t('asset.form.saving') : t('common.save')}
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
            <Text style={styles.saveButtonText}>{t('trade.edit.deleteThis')}</Text>
          </Pressable>
        </GlassSurface>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
