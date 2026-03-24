/**
 * 新增资产（Modal）
 *
 * 编辑已有资产、加减仓、改流水请在 Dashboard 点进资产详情页完成，不再使用本弹窗。
 */

import {
  buildCashLikeAsset,
  buildGoldAsset,
  buildListedAsset,
  buildPurposeFields,
  validateCashLikeForm,
  validateGoldForm,
  validateListedForm,
} from '@/lib/add-asset-form';
import { getAssets, saveAssets } from '@/lib/asset-storage';
import { appendCashMovement, usesCashAmountLedger } from '@/lib/cash-ledger';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import {
  formatExchangeSymbol,
  searchSecurities,
  type SuggestInstrument,
} from '@/lib/eastmoney-suggest';
import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { createAddModalStyles } from '@/lib/modal-styles';
import { useRouter, useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ASSET_CURRENCY_OPTIONS,
  assetCurrencySymbol,
  normalizeAssetCurrency,
} from '@/lib/asset-currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type AssetCategory,
  ASSET_CATEGORY_ORDER,
  CATEGORY_LABEL_ZH,
  isListedAssetCategory,
  type ChinaExchange,
  type SimpleAsset,
  generateAssetId,
} from '@/types/asset';

export default function AddModal() {
  const router = useRouter();
  const navigation = useNavigation();
  const { theme } = useAppPalette();
  const styles = useMemo(() => createAddModalStyles(theme), [theme]);
  const placeholderColor = useMemo(
    () => rgbaFromHex(theme.primary, 0.42),
    [theme.primary]
  );
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState<AssetCategory>('Stock');
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [purposeTarget, setPurposeTarget] = useState('');
  const [value, setValue] = useState('');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [symbol, setSymbol] = useState('');
  const [exchange, setExchange] = useState<ChinaExchange>('SH');
  const [saving, setSaving] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestInstrument[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [instrumentPick, setInstrumentPick] = useState<SuggestInstrument | null>(
    null
  );

  const [assetCurrency, setAssetCurrency] = useState('CNY');
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [purposeExpanded, setPurposeExpanded] = useState(false);

  const [account, setAccount] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [fundingOptions, setFundingOptions] = useState<SimpleAsset[]>([]);
  const [fundingSourceId, setFundingSourceId] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Add Asset',
      headerStyle: { backgroundColor: theme.pageBg },
      headerTintColor: theme.primary,
      headerTitleStyle: {
        color: theme.primary,
        fontWeight: '700',
        fontSize: 17,
      },
    });
  }, [navigation, theme.pageBg, theme.primary]);

  const isListedCategory = isListedAssetCategory(category);
  const showGoldForm = category === 'Gold';
  const showListedSecuritiesForm = isListedCategory;
  /** 用途目标金额与人民币展示：场内或黄金 */
  const purposeYuan = showGoldForm || showListedSecuritiesForm;
  const showTotalValue = !showGoldForm && !showListedSecuritiesForm;
  const canChooseFundingSource = showGoldForm || showListedSecuritiesForm;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getAssets();
        if (cancelled) return;
        setFundingOptions(
          list.filter(
            (a) =>
              usesCashAmountLedger(a) &&
              normalizeAssetCurrency(a.currency) === 'CNY' &&
              typeof a.value === 'number' &&
              a.value > 0
          )
        );
      } catch {
        if (!cancelled) setFundingOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showListedSecuritiesForm) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    const q = searchText.trim();
    if (q.length < 1) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(() => {
      setSuggestLoading(true);
      searchSecurities(q, ac.signal)
        .then((list) => {
          if (!ac.signal.aborted) setSuggestions(list);
        })
        .catch(() => {
          if (!ac.signal.aborted) setSuggestions([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setSuggestLoading(false);
        });
    }, 320);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [searchText, showListedSecuritiesForm]);

  const handleCategoryChange = useCallback((cat: AssetCategory) => {
    setCategory(cat);
    if (!isListedAssetCategory(cat)) {
      setInstrumentPick(null);
      setSearchText('');
      setSuggestions([]);
      setSymbol('');
    }
    if (isListedAssetCategory(cat) || cat === 'Gold') {
      setAssetCurrency('CNY');
    }
    if (!(isListedAssetCategory(cat) || cat === 'Gold')) {
      setFundingSourceId('');
    }
  }, []);

  const clearInstrumentSelection = useCallback(() => {
    setInstrumentPick(null);
    setSymbol('');
    setExchange('SH');
    setName('');
    setSearchText('');
    setSuggestions([]);
  }, []);

  const onPickInstrument = useCallback((item: SuggestInstrument) => {
    setInstrumentPick(item);
    setSymbol(item.code);
    setExchange(item.exchange);
    setName(item.name);
    setSearchText('');
    setSuggestions([]);
  }, []);

  const saveAsset = async () => {
    const purposeFields = buildPurposeFields(purpose, purposeTarget);
    const id = generateAssetId();
    const accountTrim = account.trim();

    setSaving(true);
    try {
      let assetToSave: SimpleAsset;

      const transferId =
        canChooseFundingSource && fundingSourceId.trim().length > 0
          ? `xf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          : undefined;

      if (showGoldForm) {
        const err = validateGoldForm({
          name,
          shares,
          costPrice,
          purpose,
          purposeTarget,
        });
        if (err) {
          Alert.alert('无法保存', err);
          return;
        }
        const grams = parseFloat(shares);
        const costNum = parseFloat(costPrice);
        const src = fundingOptions.find((x) => x.id === fundingSourceId);
        assetToSave = buildGoldAsset({
          id,
          name,
          shares: grams,
          avgCost: costNum,
          purposeFields,
          account: accountTrim || undefined,
          fundingSourceAssetId: src?.id,
          fundingSourceAssetName: src?.name,
          fundingTransferId: transferId,
        });
      } else if (showListedSecuritiesForm) {
        const err = validateListedForm({
          name,
          symbol,
          exchange,
          shares,
          price,
          costPrice,
          category,
          purpose,
          purposeTarget,
          isEditMode: false,
          hasInstrumentPick: !!instrumentPick,
        });
        if (err) {
          Alert.alert('无法保存', err);
          return;
        }

        const priceNum = parseFloat(price);
        const parsedCost = parseFloat(costPrice);
        const finalShares = parseFloat(shares);
        const finalAvg = parsedCost;
        const src = fundingOptions.find((x) => x.id === fundingSourceId);

        assetToSave = buildListedAsset({
          id,
          name,
          category,
          symbol: symbol.trim(),
          exchange: exchange as NonNullable<SimpleAsset['exchange']>,
          shares: finalShares,
          initialLastClose: priceNum,
          avgCost: finalAvg,
          purposeFields,
          emSecid: instrumentPick?.quoteId,
          account: accountTrim || undefined,
          fundingSourceAssetId: src?.id,
          fundingSourceAssetName: src?.name,
          fundingTransferId: transferId,
        });
      } else {
        const err = validateCashLikeForm({
          name,
          value,
          category,
          purpose,
          purposeTarget,
          costBasis,
        });
        if (err) {
          Alert.alert('无法保存', err);
          return;
        }
        const cbTrim = costBasis.trim();
        const costBasisNum =
          cbTrim !== '' ? parseFloat(costBasis) : undefined;
        assetToSave = buildCashLikeAsset({
          id,
          name,
          category,
          value: parseFloat(value),
          currency: normalizeAssetCurrency(assetCurrency),
          purposeFields,
          account: accountTrim || undefined,
          ...(costBasisNum !== undefined &&
          !Number.isNaN(costBasisNum) &&
          costBasisNum >= 0
            ? { costBasis: costBasisNum }
            : {}),
        });
        if (costBasis.trim() === '') {
          delete assetToSave.costBasis;
        }
      }

      if (!accountTrim) {
        delete assetToSave.account;
      }

      if (canChooseFundingSource && fundingSourceId.trim().length > 0) {
        const all = await getAssets();
        const srcIdx = all.findIndex((a) => a.id === fundingSourceId);
        if (srcIdx < 0) {
          Alert.alert('无法保存', '资金来源资产不存在，请重新选择。');
          return;
        }
        const src = all[srcIdx]!;
        if (!usesCashAmountLedger(src)) {
          Alert.alert('无法保存', '所选资金来源不是可扣减余额的现金类资产。');
          return;
        }
        const amount =
          showGoldForm || showListedSecuritiesForm
            ? parseFloat(shares) * parseFloat(costPrice)
            : 0;
        if (!(amount > 0)) {
          Alert.alert('无法保存', '买入金额计算失败，请检查克数/份额与购买单价。');
          return;
        }
        let debited: SimpleAsset;
        try {
          debited = appendCashMovement(
            src,
            'out',
            amount,
            getShanghaiDateString(),
            {
              relatedAssetId: assetToSave.id,
              relatedAssetName: assetToSave.name,
              note: `买入${assetToSave.category === 'Gold' ? '黄金' : '资产'}资金划转`,
              transferId,
            }
          );
        } catch (e) {
          Alert.alert('无法保存', e instanceof Error ? e.message : '资金来源余额不足。');
          return;
        }
        all[srcIdx] = debited;
        all.push(assetToSave);
        await saveAssets(all);
      } else {
        const all = await getAssets();
        all.push(assetToSave);
        await saveAssets(all);
      }
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('错误', '保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  const keyboardOffset = Platform.OS === 'ios' ? insets.top + 56 : 0;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardOffset}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        <Text style={styles.label}>资产类别</Text>
        <View style={styles.optionsRow}>
          {ASSET_CATEGORY_ORDER.map((opt) => (
            <Pressable
              key={opt}
              style={[styles.option, category === opt && styles.optionSelected]}
              onPress={() => handleCategoryChange(opt)}
            >
              <Text
                style={[
                  styles.optionText,
                  category === opt && styles.optionTextSelected,
                ]}
                numberOfLines={1}
              >
                {CATEGORY_LABEL_ZH[opt]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>所在账户（选填）</Text>
        <TextInput
          placeholder="如：支付宝、招商银行储蓄卡、同花顺…"
          placeholderTextColor={placeholderColor}
          style={styles.input}
          value={account}
          onChangeText={setAccount}
        />

        {showGoldForm && (
          <>
            <Text style={styles.label}>名称</Text>
            <TextInput
              placeholder="如：工行如意金、实物金条"
              placeholderTextColor={placeholderColor}
              style={styles.input}
              value={name}
              onChangeText={setName}
            />
            <Text style={styles.label}>持有克数</Text>
            <TextInput
              placeholder="购买或当前记账克数"
              placeholderTextColor={placeholderColor}
              style={styles.input}
              value={shares}
              onChangeText={setShares}
              keyboardType="decimal-pad"
            />
            <Text style={styles.label}>购买单价（CNY/克）</Text>
            <Text style={styles.hintMuted}>
              建仓或加仓时的每克成本。参考市价由 Dashboard 同步行情自动更新，不需要手填。
            </Text>
            <View style={styles.amountRow}>
              <View style={styles.currencyChipStatic}>
                <Text style={styles.currencyChipText}>¥</Text>
              </View>
              <TextInput
                placeholder="如 520"
                placeholderTextColor={placeholderColor}
                style={[styles.input, styles.amountInputFlex]}
                value={costPrice}
                onChangeText={setCostPrice}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.label}>资金来源（选填）</Text>
            <Text style={styles.hintMuted}>
              选择后会自动扣减该现金类资产余额，并写入两边交易记录。
            </Text>
            <View style={styles.optionsRow}>
              <Pressable
                style={[
                  styles.option,
                  fundingSourceId === '' && styles.optionSelected,
                ]}
                onPress={() => setFundingSourceId('')}
              >
                <Text
                  style={[
                    styles.optionText,
                    fundingSourceId === '' && styles.optionTextSelected,
                  ]}
                >
                  不扣减
                </Text>
              </Pressable>
              {fundingOptions.slice(0, 6).map((fo) => (
                <Pressable
                  key={fo.id}
                  style={[
                    styles.option,
                    fundingSourceId === fo.id && styles.optionSelected,
                  ]}
                  onPress={() => setFundingSourceId(fo.id)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      fundingSourceId === fo.id && styles.optionTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {fo.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {showListedSecuritiesForm && (
          <>
            <Text style={styles.label}>搜索证券（代码或简称）</Text>
            <TextInput
              placeholder="输入如 茅台、600519、ETF…"
              placeholderTextColor={placeholderColor}
              style={styles.input}
              value={searchText}
              onChangeText={(t) => {
                setSearchText(t);
                if (instrumentPick && t.trim().length > 0) {
                  setInstrumentPick(null);
                  setSymbol('');
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {suggestLoading && (
              <View style={styles.suggestLoadingRow}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={styles.suggestLoadingText}>搜索中…</Text>
              </View>
            )}
            {!suggestLoading && suggestions.length > 0 && (
              <View style={styles.suggestBox}>
                {suggestions.map((item) => (
                  <Pressable
                    key={`${item.exchange}-${item.code}-${item.quoteId}`}
                    style={({ pressed }) => [
                      styles.suggestRow,
                      pressed && styles.suggestRowPressed,
                    ]}
                    onPress={() => onPickInstrument(item)}
                  >
                    <Text style={styles.suggestCode}>
                      {formatExchangeSymbol(item.exchange, item.code)}
                    </Text>
                    <Text style={styles.suggestName} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {!suggestLoading &&
              searchText.trim().length > 0 &&
              suggestions.length === 0 && (
                <Text style={styles.suggestEmpty}>
                  无匹配标的（含场外基金代码如 012922），请换关键词
                </Text>
              )}

            {instrumentPick && (
              <View style={styles.selectedCard}>
                <Text style={styles.selectedLabel}>已选标的</Text>
                <Text style={styles.selectedMain}>
                  {formatExchangeSymbol(
                    instrumentPick.exchange,
                    instrumentPick.code
                  )}{' '}
                  · {instrumentPick.name}
                </Text>
                <Pressable onPress={clearInstrumentSelection}>
                  <Text style={styles.changeLink}>更换</Text>
                </Pressable>
              </View>
            )}

            <Text style={styles.label}>标的名称</Text>
            <TextInput
              placeholder="可从上方搜索结果带入，也可修改"
              placeholderTextColor={placeholderColor}
              style={styles.input}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>份额</Text>
            <TextInput
              placeholder="持有数量"
              placeholderTextColor={placeholderColor}
              style={styles.input}
              value={shares}
              onChangeText={setShares}
              keyboardType="decimal-pad"
            />
            <Text style={styles.label}>成本价 / 买价（人民币/份）</Text>
            <Text style={styles.hintMuted}>
              记录真实持仓成本，便于日后算收益率；可与下方参考收盘价不同。
            </Text>
            <View style={styles.amountRow}>
              <View style={styles.currencyChipStatic}>
                <Text style={styles.currencyChipText}>¥</Text>
              </View>
              <TextInput
                placeholder="如建仓均价"
                placeholderTextColor={placeholderColor}
                style={[styles.input, styles.amountInputFlex]}
                value={costPrice}
                onChangeText={setCostPrice}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.label}>收盘价 / 参考价（人民币）</Text>
            <Text style={styles.hintMuted}>
              会存为 lastClose（日 K 语义）；同步行情时另用 markPrice
              记盘中现价，市值优先按现价算。
            </Text>
            <View style={styles.amountRow}>
              <View style={styles.currencyChipStatic}>
                <Text style={styles.currencyChipText}>¥</Text>
              </View>
              <TextInput
                placeholder="例如上一交易日收盘价"
                placeholderTextColor={placeholderColor}
                style={[styles.input, styles.amountInputFlex]}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.label}>资金来源（选填）</Text>
            <Text style={styles.hintMuted}>
              选择后会自动扣减该现金类资产余额，并写入两边交易记录。
            </Text>
            <View style={styles.optionsRow}>
              <Pressable
                style={[
                  styles.option,
                  fundingSourceId === '' && styles.optionSelected,
                ]}
                onPress={() => setFundingSourceId('')}
              >
                <Text
                  style={[
                    styles.optionText,
                    fundingSourceId === '' && styles.optionTextSelected,
                  ]}
                >
                  不扣减
                </Text>
              </Pressable>
              {fundingOptions.slice(0, 6).map((fo) => (
                <Pressable
                  key={fo.id}
                  style={[
                    styles.option,
                    fundingSourceId === fo.id && styles.optionSelected,
                  ]}
                  onPress={() => setFundingSourceId(fo.id)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      fundingSourceId === fo.id && styles.optionTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {fo.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {showTotalValue && (
          <>
            <Text style={styles.label}>资产名称</Text>
            <TextInput
              placeholder="如：招行朝朝宝、余额宝、车贷专户"
              placeholderTextColor={placeholderColor}
              style={styles.input}
              value={name}
              onChangeText={setName}
            />
            <Text style={styles.label}>当前金额</Text>
            <View style={styles.amountRow}>
              <Pressable
                style={styles.currencyChip}
                onPress={() => setCurrencyModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="选择币种"
              >
                <Text style={styles.currencyChipText}>
                  {assetCurrencySymbol(assetCurrency)}
                </Text>
                <Text style={styles.currencyChevron}>▼</Text>
              </Pressable>
              <TextInput
                placeholder="如存款、黄金市值等"
                placeholderTextColor={placeholderColor}
                style={[styles.input, styles.amountInputFlex]}
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.label}>本金（选填）</Text>
            <Text style={styles.hintMuted}>
              记录投入本金后可与当前市值对比（收益功能将陆续完善）。
            </Text>
            <TextInput
              placeholder="不填则仅记录当前金额"
              placeholderTextColor={placeholderColor}
              style={styles.input}
              value={costBasis}
              onChangeText={setCostBasis}
              keyboardType="decimal-pad"
            />
          </>
        )}

        <Pressable
          style={styles.purposeSectionHeader}
          onPress={() => setPurposeExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityState={{ expanded: purposeExpanded }}
        >
          <Text style={styles.purposeSectionTitle}>用途与目标（选填）</Text>
          <Text style={styles.purposeCaret}>
            {purposeExpanded ? '▲' : '▼'}
          </Text>
        </Pressable>
        {purposeExpanded ? (
          <View style={styles.purposeSectionBody}>
            <Text style={styles.hintMuted}>
              例如专门用于旅游；填写目标后，列表中会显示完成度。
            </Text>
            <Text style={styles.label}>用途说明</Text>
            <TextInput
              placeholder="如：旅游基金、应急金"
              placeholderTextColor={placeholderColor}
              style={styles.input}
              value={purpose}
              onChangeText={setPurpose}
            />
            <Text style={styles.label}>
              目标金额（
              {purposeYuan
                ? '¥'
                : assetCurrencySymbol(assetCurrency)}{' '}
              与上方面额同币种）
            </Text>
            <TextInput
              placeholder="如 30000，不填则不显示进度"
              placeholderTextColor={placeholderColor}
              style={styles.input}
              value={purposeTarget}
              onChangeText={setPurposeTarget}
              keyboardType="decimal-pad"
            />
          </View>
        ) : null}

        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveAsset}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? '保存中…' : '保存'}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={currencyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <View style={styles.currencyModalBackdrop}>
          <Pressable
            style={styles.currencyModalDismiss}
            onPress={() => setCurrencyModalVisible(false)}
            accessibilityLabel="关闭"
          />
          <View style={styles.currencyModalCard}>
            <Text style={styles.currencyModalTitle}>选择币种</Text>
            {ASSET_CURRENCY_OPTIONS.map((o) => (
              <Pressable
                key={o.code}
                style={[
                  styles.currencyModalRow,
                  assetCurrency === o.code && styles.currencyModalRowSelected,
                ]}
                onPress={() => {
                  setAssetCurrency(o.code);
                  setCurrencyModalVisible(false);
                }}
              >
                <Text style={styles.currencyModalRowSymbol}>{o.symbol}</Text>
                <Text style={styles.currencyModalRowLabel}>
                  {o.code} · {o.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.currencyModalCancel}
              onPress={() => setCurrencyModalVisible(false)}
            >
              <Text style={styles.currencyModalCancelText}>取消</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
