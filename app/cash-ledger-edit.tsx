/**
 * 编辑或删除单条现金/余额流水（增加、减少，无单价）。
 */

import { SettingsEditorialMasthead } from '@/components/settings-editorial-masthead';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
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
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { deleteListedTradeEntry, updateListedTradeEntry } from '@/lib/trade-ledger';
import type { CashLedgerEntry, SimpleAsset } from '@/types/asset';
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

export default function CashLedgerEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { assetId, entryId } = useGlobalSearchParams<{
    assetId?: string;
    entryId?: string;
  }>();
  const { theme } = useAppPalette();
  const { t } = useLanguage();
  const styles = useMemo(() => createAddModalStyles(theme), [theme]);
  const hubStyles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
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

  const cur = asset ? getAssetCurrency(asset) : 'CNY';

  const onSave = async () => {
    if (!asset || !entry) return;
    const q = parseFloat(amount);
    if (Number.isNaN(q) || q <= 0) {
      Alert.alert(
        t('cashLedger.edit.saveFailed'),
        t('cashLedger.edit.amountMustBePositive')
      );
      return;
    }
    const d = entryDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      Alert.alert(
        t('cashLedger.edit.saveFailed'),
        t('cashLedger.edit.invalidDate')
      );
      return;
    }
    const linkedTradeAssetId = entry.relatedAssetId;
    const linkedTransferId = entry.transferId;
    if (linkedTradeAssetId && linkedTransferId) {
      // 该流水是内部转账联动的一部分，不允许用户把 in/out 颠倒，否则会破坏对账关系
      // （买入对应 out；卖出对应 in）
      // 这里不做强推断，仅禁止改变原 side
      if (side !== entry.side) {
        Alert.alert(
          t('cashLedger.edit.saveFailed'),
          t('cashLedger.edit.linkedTypeLocked')
        );
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
              Alert.alert(
                t('cashLedger.edit.saveFailed'),
                t('cashLedger.edit.invalidShares')
              );
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
        t('cashLedger.edit.saveFailed'),
        e instanceof Error ? e.message : t('cashLedger.edit.inconsistent')
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!asset || !entry) return;
    Alert.alert(
      t('cashLedger.edit.deleteTitle'),
      t('cashLedger.edit.deleteBody'),
      [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
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
              t('cashLedger.edit.failedTitle'),
              e instanceof Error ? e.message : t('cashLedger.edit.failedDelete')
            );
          } finally {
            setSaving(false);
          }
        },
      },
      ]
    );
  };

  if (!assetId || !entryId) {
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
            title="CASH LEDGER"
            kicker="BALANCE · IN OR OUT"
          />
          <View style={{ paddingHorizontal: 24 }}>
            <Text style={styles.headerName}>{t('cashLedger.edit.invalidParams')}</Text>
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
            title="CASH LEDGER"
            kicker="BALANCE · IN OR OUT"
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

  if (!asset || !entry) {
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
            title="CASH LEDGER"
            kicker="BALANCE · IN OR OUT"
          />
          <View style={{ paddingHorizontal: 24 }}>
            <Text style={styles.headerName}>{t('cashLedger.edit.notFound')}</Text>
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
          title="CASH LEDGER"
          kicker="BALANCE · IN OR OUT"
        />
        <View style={{ paddingHorizontal: 14 }}>
        <GlassSurface borderRadius={32} intensity={50} contentStyle={styles.glassFormInner}>
          <FormRow
            first
            styles={styles}
            iconMuted={iconMuted}
            icon="swap-vertical-outline"
            label={t('cashLedger.edit.typeLabel')}
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
                  {t('cashLedger.edit.typeIn')}
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
                  {t('cashLedger.edit.typeOut')}
                </Text>
              </Pressable>
            </View>
          </FormRow>

          <FormRow
            styles={styles}
            iconMuted={iconMuted}
            icon="calendar-outline"
            label={t('cashLedger.edit.dateLabel')}
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
            label={t('cashLedger.edit.amountLabel', { currency: cur })}
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
                {t('cashLedger.edit.linkedNote')}
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
                  <Text style={styles.saveButtonText}>
                    {t('cashLedger.edit.openVenueAndSource')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <FormRow
              styles={styles}
              iconMuted={iconMuted}
              icon="link-outline"
              label={t('cashLedger.edit.relatedLabel')}
            >
              <FundingSourcePicker
                label={t('cashLedger.edit.relatedLabel')}
                emptyOptionLabel={t('cashLedger.edit.notLinked')}
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
            label={t('cashLedger.edit.noteLabel')}
          >
            <TextInput
              style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
              value={note}
              onChangeText={setNote}
              placeholder={t('cashLedger.edit.notePlaceholder')}
              placeholderTextColor={placeholderColor}
              multiline
            />
          </FormRow>

          <Text style={[styles.hintMuted, { marginTop: 8 }]}>
            {t('cashLedger.edit.currentBalance', {
              balance: formatMoney(
                getAssetDisplayValue(asset),
                getAssetCurrency(asset)
              ),
            })}
          </Text>

          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={() => void onSave()}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? t('common.saving') : t('common.save')}
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
            <Text style={styles.saveButtonText}>
              {t('cashLedger.edit.deleteThisEntry')}
            </Text>
          </Pressable>
        </GlassSurface>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
