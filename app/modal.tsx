/**
 * 新增资产（Modal）
 *
 * 编辑已有资产、加减仓、改流水请在 Dashboard 点进资产详情页完成，不再使用本弹窗。
 * 股票/基金/ETF：同一套表单，支持 A 股（东财）与美股/港股（OpenFIGI 联想）；收盘价仅由 Dashboard 同步写入。
 */

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FormRow } from '@/components/add-asset/form-row';
import { formatYmdChineseLine, YmdDateFields } from '@/components/ymd-date-fields';
import { FundingSourcePicker } from '@/components/add-asset/funding-source-picker';
import { InlineSelect } from '@/components/add-asset/inline-select';
import { GlassSurface } from '@/components/glass-surface';
import { useAppPalette } from '@/contexts/app-palette-context';
import {
    buildCashLikeAsset,
    buildGoldAsset,
    buildListedAsset,
    buildPurposeFields,
    validateCashLikeForm,
    validateGoldForm,
    validateListedForm,
} from '@/lib/add-asset-form';
import {
    ASSET_CURRENCY_OPTIONS,
    assetCurrencySymbol,
    normalizeAssetCurrency,
} from '@/lib/asset-currency';
import { saveAssets } from '@/lib/asset-storage';
import { appendCashMovement, usesCashAmountLedger } from '@/lib/cash-ledger';
import { rgbaFromHex } from '@/lib/color-utils';
import {
  formatInstantToShanghaiDateString,
  getShanghaiDateString,
  shanghaiYmdToLocalNoon,
} from '@/lib/date-shanghai';
import { formatExchangeSymbol } from '@/lib/eastmoney-suggest';
import { fetchAddAssetReferencePrice } from '@/lib/add-asset-reference-price';
import { convertListingCostToCnyCashDebit } from '@/lib/fx-rates';
import {
    searchUnifiedInstruments,
    type UnifiedSuggestItem,
} from '@/lib/instrument-search';
import { createAddModalStyles } from '@/lib/modal-styles';
import { assetRepository } from '@/lib/repositories/asset-repository';
import {
    ASSET_CATEGORY_ORDER,
    CATEGORY_LABEL_ZH,
    generateAssetId,
    isListedAssetCategory,
    type AssetCategory,
    type ListingExchange,
    type SimpleAsset,
} from '@/types/asset';
import { useNavigation, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AddModal() {
  const router = useRouter();
  const navigation = useNavigation();
  const { theme } = useAppPalette();
  const styles = useMemo(() => createAddModalStyles(theme), [theme]);
  const placeholderColor = useMemo(
    () => rgbaFromHex(theme.primary, 0.42),
    [theme.primary]
  );
  const iconMuted = useMemo(() => rgbaFromHex(theme.primary, 0.5), [theme.primary]);
  const insets = useSafeAreaInsets();

  const [tradeDate, setTradeDate] = useState(() => getShanghaiDateString());
  const [iosDateOpen, setIosDateOpen] = useState(false);
  const [androidDateOpen, setAndroidDateOpen] = useState(false);

  const [category, setCategory] = useState<AssetCategory>('Stock');
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [purposeTarget, setPurposeTarget] = useState('');
  const [value, setValue] = useState('');
  const [shares, setShares] = useState('');
  const [symbol, setSymbol] = useState('');
  const [exchange, setExchange] = useState<ListingExchange>('SH');
  const [saving, setSaving] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<UnifiedSuggestItem[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [instrumentPick, setInstrumentPick] = useState<UnifiedSuggestItem | null>(
    null
  );

  const [assetCurrency, setAssetCurrency] = useState('CNY');
  /** 内联下拉互斥：ccy | fund */
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteHint, setQuoteHint] = useState<string | null>(null);
  const [purposeExpanded, setPurposeExpanded] = useState(false);

  const [account, setAccount] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [fundingOptions, setFundingOptions] = useState<SimpleAsset[]>([]);
  const [fundingSourceId, setFundingSourceId] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '添加资产',
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
  /** 用途目标与 A 股/黄金同为人民币展示；美股/港股标的与报价币种一致 */
  const purposeYuan =
    showGoldForm ||
    (showListedSecuritiesForm && !instrumentPick?.intlQuoteSymbol);
  const showSimpleBalanceForm = !showGoldForm && !showListedSecuritiesForm;
  const canChooseFundingSource =
    showGoldForm || showListedSecuritiesForm;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await assetRepository.getAll();
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
      searchUnifiedInstruments(q, ac.signal)
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

  useEffect(() => {
    if (!showListedSecuritiesForm || !instrumentPick) {
      setQuoteHint(null);
      setQuoteLoading(false);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    setQuoteHint(null);
    fetchAddAssetReferencePrice(instrumentPick, tradeDate)
      .then((r) => {
        if (cancelled || !r) return;
        setCostPrice(String(r.price));
        setQuoteHint(r.hint);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    showListedSecuritiesForm,
    tradeDate,
    instrumentPick?.code,
    instrumentPick?.quoteId,
    instrumentPick?.intlQuoteSymbol,
  ]);

  const amountDisplay = useMemo(() => {
    const s = parseFloat(shares);
    const c = parseFloat(costPrice);
    if (!Number.isFinite(s) || !Number.isFinite(c) || s <= 0 || c <= 0) return '';
    return (s * c).toFixed(2);
  }, [shares, costPrice]);

  const onAmountChange = useCallback(
    (t: string) => {
      const raw = t.replace(/,/g, '').trim();
      if (raw === '') {
        setCostPrice('');
        return;
      }
      const a = parseFloat(raw);
      const s = parseFloat(shares);
      if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(s) || s <= 0) return;
      const next = a / s;
      const rounded = Math.round(next * 1e8) / 1e8;
      setCostPrice(String(rounded));
    },
    [shares]
  );

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

  const onPickInstrument = useCallback((item: UnifiedSuggestItem) => {
    setInstrumentPick(item);
    setSymbol(item.code);
    setExchange(item.exchange);
    setName(item.name);
    if (item.intlQuoteSymbol) {
      setAssetCurrency(item.exchange === 'HK' ? 'HKD' : 'USD');
    } else {
      setAssetCurrency('CNY');
    }
    setSearchText('');
    setSuggestions([]);
  }, []);

  const saveAsset = async () => {
    const purposeFields = buildPurposeFields(purpose, purposeTarget);
    const id = generateAssetId();
    const accountTrim = account.trim();

    setSaving(true);
    try {
      const tradeDay = tradeDate.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDay)) {
        Alert.alert('无法保存', '请选择有效的交易日期。');
        return;
      }

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
          tradeDate: tradeDay,
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
          costPrice,
          category,
          purpose,
          purposeTarget,
          isEditMode: false,
          hasInstrumentPick: !!instrumentPick,
          intlQuoteSymbol: instrumentPick?.intlQuoteSymbol,
        });
        if (err) {
          Alert.alert('无法保存', err);
          return;
        }

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
          avgCost: finalAvg,
          tradeDate: tradeDay,
          purposeFields,
          listingCurrency: normalizeAssetCurrency(assetCurrency),
          emSecid: instrumentPick?.intlQuoteSymbol
            ? undefined
            : instrumentPick?.quoteId,
          intlQuoteSymbol: instrumentPick?.intlQuoteSymbol,
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
        const all = await assetRepository.getAll();
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
        const rawCost =
          showGoldForm || showListedSecuritiesForm
            ? parseFloat(shares) * parseFloat(costPrice)
            : 0;
        if (!(rawCost > 0)) {
          Alert.alert('无法保存', '买入金额计算失败，请检查克数/份额与购买单价。');
          return;
        }
        const listingCur = normalizeAssetCurrency(assetCurrency);
        const conv = await convertListingCostToCnyCashDebit(rawCost, listingCur);
        if (!conv.ok) {
          Alert.alert('无法保存', conv.message);
          return;
        }
        const amount = conv.cny;
        let debited: SimpleAsset;
        try {
          debited = appendCashMovement(
            src,
            'out',
            amount,
            tradeDay,
            {
              relatedAssetId: assetToSave.id,
              relatedAssetName: assetToSave.name,
              note:
                listingCur === 'CNY'
                  ? `买入${assetToSave.category === 'Gold' ? '黄金' : '资产'}资金划转`
                  : `买入${assetToSave.category === 'Gold' ? '黄金' : '资产'}（${listingCur} ${rawCost.toFixed(2)} 折人民币扣款）`,
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
        const all = await assetRepository.getAll();
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

  const openTradeDatePicker = () => {
    if (Platform.OS === 'web') return;
    if (Platform.OS === 'android') {
      setAndroidDateOpen(true);
    } else {
      setIosDateOpen(true);
    }
  };

  const currencyModalOptions =
    category === 'Gold'
      ? ASSET_CURRENCY_OPTIONS.filter((o) => o.code === 'CNY')
      : ASSET_CURRENCY_OPTIONS;

  const currencySelectOptions = useMemo(
    () =>
      currencyModalOptions.map((o) => ({
        value: o.code,
        label: o.code,
      })),
    [currencyModalOptions]
  );

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardOffset}
    >
      <View style={styles.modalAmbient} pointerEvents="none" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: 14,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        nestedScrollEnabled
        onScrollBeginDrag={() => setMenuOpen(null)}
      >
        <GlassSurface borderRadius={32} intensity={50} contentStyle={styles.glassFormInner}>
        <View style={styles.categoryRowWrap}>
          <View style={styles.formRowIconColumn}>
            <View style={styles.formRowIconLabelSpacer} />
            <View style={styles.formRowIconWrap}>
              <Ionicons name="grid-outline" size={20} color={iconMuted} />
            </View>
          </View>
          <View style={styles.categoryChipsWrap}>
            <Text style={styles.formRowLabel}>资产类别</Text>
            <View style={styles.categoryRowOneLine}>
              {ASSET_CATEGORY_ORDER.map((opt) => (
                <Pressable
                  key={opt}
                  style={[
                    styles.optionMini,
                    category === opt && styles.optionSelected,
                  ]}
                  onPress={() => handleCategoryChange(opt)}
                >
                  <Text
                    style={[
                      styles.optionTextMini,
                      category === opt && styles.optionTextSelected,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.88}
                  >
                    {CATEGORY_LABEL_ZH[opt]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <FormRow
          styles={styles}
          iconMuted={iconMuted}
          icon="calendar-outline"
          label="交易时间（年 · 月 · 日）"
          right={
            Platform.OS !== 'web' ? (
              <Ionicons name="chevron-forward" size={18} color={iconMuted} />
            ) : undefined
          }
        >
          {Platform.OS === 'web' ? (
            <YmdDateFields
              value={tradeDate}
              onChangeText={setTradeDate}
              placeholderColor={placeholderColor}
              inputStyle={styles.input}
              labelColor={rgbaFromHex(theme.primary, 0.62)}
            />
          ) : (
            <Pressable
              onPress={openTradeDatePicker}
              style={styles.formRowValuePressable}
              accessibilityRole="button"
              accessibilityLabel="选择交易日期"
            >
              <Text style={styles.formRowValue}>
                {formatYmdChineseLine(tradeDate)}
              </Text>
            </Pressable>
          )}
        </FormRow>

        {showGoldForm && (
          <>
            <FormRow
              styles={styles}
              iconMuted={iconMuted}
              icon="text-outline"
              label="名称"
            >
              <TextInput
                placeholder="如：工行如意金、实物金条"
                placeholderTextColor={placeholderColor}
                style={styles.input}
                value={name}
                onChangeText={setName}
              />
            </FormRow>
            <FormRow
              styles={styles}
              iconMuted={iconMuted}
              icon="fitness-outline"
              label="数量"
              right={
                <View style={styles.unitPill}>
                  <Text style={styles.formRowRightText}>克</Text>
                </View>
              }
            >
              <TextInput
                placeholder="克数"
                placeholderTextColor={placeholderColor}
                style={styles.input}
                value={shares}
                onChangeText={setShares}
                keyboardType="decimal-pad"
              />
            </FormRow>
            <FormRow
              styles={styles}
              iconMuted={iconMuted}
              icon="pricetag-outline"
              label="购买单价（CNY/克）"
            >
              <View style={styles.inputCurrencyShell}>
                <TextInput
                  placeholder="单价"
                  placeholderTextColor={placeholderColor}
                  style={styles.inputCurrencyField}
                  value={costPrice}
                  onChangeText={setCostPrice}
                  keyboardType="decimal-pad"
                />
                <View style={styles.inputCurrencyDivider} />
                <InlineSelect
                  menuKey="ccy"
                  openKey={menuOpen}
                  setOpenKey={setMenuOpen}
                  value={assetCurrency}
                  options={currencySelectOptions}
                  onChange={(v) => setAssetCurrency(v)}
                  embedded
                  primaryColor={theme.primary}
                  mutedColor={iconMuted}
                />
              </View>
            </FormRow>
            <View style={[styles.formRow, { zIndex: 25 }]}>
              <View style={styles.formRowIconColumn}>
                <View style={styles.formRowIconLabelSpacer} />
                <View style={styles.formRowIconWrap}>
                  <Ionicons name="wallet-outline" size={18} color={iconMuted} />
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.formRowLabel}>资金来源（选填）</Text>
                <FundingSourcePicker
                  label="资金来源（选填）"
                  emptyOptionLabel="其他外部资金"
                  valueId={fundingSourceId}
                  onSelectId={setFundingSourceId}
                  fundingOptions={fundingOptions}
                  styles={styles}
                  omitLabel
                  mode="inline"
                  menuKey="fund"
                  openKey={menuOpen}
                  setOpenKey={setMenuOpen}
                  primaryColor={theme.primary}
                  mutedColor={iconMuted}
                />
              </View>
            </View>
          </>
        )}

        {showListedSecuritiesForm && (
          <>
            <View style={styles.categoryBlock}>
              <View style={styles.formRowIconColumn}>
                <View style={styles.formRowIconLabelSpacer} />
                <View style={styles.formRowIconWrap}>
                  <Ionicons name="search-outline" size={18} color={iconMuted} />
                </View>
              </View>
              <View style={styles.categoryChipsWrap}>
                <Text style={styles.formRowLabel}>搜索证券（代码或简称）</Text>
                <TextInput
                  placeholder="如 茅台、012922、AAPL、腾讯、700…"
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
              </View>
            </View>
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
                    key={`${item.exchange}-${item.code}-${
                      item.quoteId ?? item.intlQuoteSymbol ?? ''
                    }`}
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
                <Text style={styles.suggestEmpty}>无匹配结果</Text>
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

            <FormRow styles={styles} iconMuted={iconMuted} icon="pie-chart-outline">
              <View style={[styles.listedTwoCol, { alignItems: 'flex-start' }]}>
                <View style={[styles.listedColFlex, { maxWidth: '36%' }]}>
                  <Text style={styles.formRowLabel}>份额</Text>
                  <TextInput
                    placeholder="份"
                    placeholderTextColor={placeholderColor}
                    style={styles.inputCompact}
                    value={shares}
                    onChangeText={setShares}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.listedColFlex, { flex: 1.4, minWidth: 0 }]}>
                  <Text style={styles.formRowLabel}>单价</Text>
                  <View style={styles.inputCurrencyShell}>
                    <TextInput
                      placeholder="单价"
                      placeholderTextColor={placeholderColor}
                      style={styles.inputCurrencyField}
                      value={costPrice}
                      onChangeText={setCostPrice}
                      keyboardType="decimal-pad"
                    />
                    <View style={styles.inputCurrencyDivider} />
                    <InlineSelect
                      menuKey="ccy"
                      openKey={menuOpen}
                      setOpenKey={setMenuOpen}
                      value={assetCurrency}
                      options={currencySelectOptions}
                      onChange={(v) => setAssetCurrency(v)}
                      embedded
                      primaryColor={theme.primary}
                      mutedColor={iconMuted}
                    />
                  </View>
                </View>
              </View>
              {quoteLoading ? (
                <View style={styles.suggestLoadingRow}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={styles.suggestLoadingText}>同步参考价…</Text>
                </View>
              ) : quoteHint ? (
                <Text style={styles.hint}>参考：{quoteHint}</Text>
              ) : null}
            </FormRow>

            <FormRow
              styles={styles}
              iconMuted={iconMuted}
              icon="calculator-outline"
              label="金额（份额×单价，改金额反算单价）"
            >
              <TextInput
                placeholder="自动计算，可改"
                placeholderTextColor={placeholderColor}
                style={styles.input}
                value={amountDisplay}
                onChangeText={onAmountChange}
                keyboardType="decimal-pad"
              />
            </FormRow>

            <View style={[styles.formRow, { zIndex: 25 }]}>
              <View style={styles.formRowIconColumn}>
                <View style={styles.formRowIconLabelSpacer} />
                <View style={styles.formRowIconWrap}>
                  <Ionicons name="wallet-outline" size={18} color={iconMuted} />
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.formRowLabel}>资金来源（选填）</Text>
                <FundingSourcePicker
                  label="资金来源（选填）"
                  emptyOptionLabel="其他外部资金"
                  valueId={fundingSourceId}
                  onSelectId={setFundingSourceId}
                  fundingOptions={fundingOptions}
                  styles={styles}
                  omitLabel
                  mode="inline"
                  menuKey="fund"
                  openKey={menuOpen}
                  setOpenKey={setMenuOpen}
                  primaryColor={theme.primary}
                  mutedColor={iconMuted}
                />
              </View>
            </View>
          </>
        )}

        {showSimpleBalanceForm && (
          <>
            <FormRow
              styles={styles}
              iconMuted={iconMuted}
              icon="albums-outline"
              label="资产名称"
            >
              <TextInput
                placeholder="如：招行朝朝宝、余额宝、车贷专户"
                placeholderTextColor={placeholderColor}
                style={styles.input}
                value={name}
                onChangeText={setName}
              />
            </FormRow>
            <FormRow
              styles={styles}
              iconMuted={iconMuted}
              icon="cash-outline"
              label="当前金额"
            >
              <View style={styles.inputCurrencyShell}>
                <TextInput
                  placeholder="金额"
                  placeholderTextColor={placeholderColor}
                  style={styles.inputCurrencyField}
                  value={value}
                  onChangeText={setValue}
                  keyboardType="decimal-pad"
                />
                <View style={styles.inputCurrencyDivider} />
                <InlineSelect
                  menuKey="ccy"
                  openKey={menuOpen}
                  setOpenKey={setMenuOpen}
                  value={assetCurrency}
                  options={currencySelectOptions}
                  onChange={(v) => setAssetCurrency(v)}
                  embedded
                  primaryColor={theme.primary}
                  mutedColor={iconMuted}
                />
              </View>
            </FormRow>
            <FormRow
              styles={styles}
              iconMuted={iconMuted}
              icon="trending-up-outline"
              label="本金（选填）"
            >
              <TextInput
                placeholder="不填则仅记录当前金额"
                placeholderTextColor={placeholderColor}
                style={styles.input}
                value={costBasis}
                onChangeText={setCostBasis}
                keyboardType="decimal-pad"
              />
            </FormRow>
          </>
        )}

        {!purposeExpanded ? (
          <Pressable
            style={styles.moreOptionsLink}
            onPress={() => setPurposeExpanded(true)}
            accessibilityRole="button"
          >
            <Text style={styles.moreOptionsLinkText}>+ 更多选项</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={styles.purposeSectionHeader}
              onPress={() => setPurposeExpanded(false)}
              accessibilityRole="button"
              accessibilityState={{ expanded: true }}
            >
              <Text style={styles.purposeSectionTitle}>更多选项</Text>
              <Text style={styles.purposeCaret}>▲</Text>
            </Pressable>
            <View style={styles.purposeSectionBody}>
              <Text style={styles.label}>所在账户（选填）</Text>
              <TextInput
                placeholder="如：支付宝、招商银行储蓄卡、同花顺…"
                placeholderTextColor={placeholderColor}
                style={styles.input}
                value={account}
                onChangeText={setAccount}
              />
              <Text style={styles.label}>用途说明</Text>
              <TextInput
                placeholder="如：旅游基金、应急金"
                placeholderTextColor={placeholderColor}
                style={styles.input}
                value={purpose}
                onChangeText={setPurpose}
              />
              <Text style={styles.label}>
                目标金额（{purposeYuan ? '¥' : assetCurrencySymbol(assetCurrency)}）
              </Text>
              <TextInput
                placeholder="不填则不显示进度"
                placeholderTextColor={placeholderColor}
                style={styles.input}
                value={purposeTarget}
                onChangeText={setPurposeTarget}
                keyboardType="decimal-pad"
              />
            </View>
          </>
        )}

        <Pressable
          style={[styles.saveButtonPill, saving && styles.saveButtonDisabled]}
          onPress={saveAsset}
          disabled={saving}
        >
          <Text style={styles.saveButtonPillText}>
            {saving ? '保存中…' : '添加'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.discardButton}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.discardButtonText}>放弃</Text>
        </Pressable>
        </GlassSurface>
      </ScrollView>

      {Platform.OS === 'ios' ? (
        <Modal
          visible={iosDateOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIosDateOpen(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: 'flex-end',
              backgroundColor: 'rgba(0,0,0,0.45)',
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={() => setIosDateOpen(false)} />
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                paddingBottom: insets.bottom + 10,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                }}
              >
                <Pressable onPress={() => setIosDateOpen(false)}>
                  <Text style={{ fontSize: 16, color: theme.primary }}>取消</Text>
                </Pressable>
                <Pressable onPress={() => setIosDateOpen(false)}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.primary }}>
                    完成
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={shanghaiYmdToLocalNoon(tradeDate)}
                mode="date"
                display="spinner"
                themeVariant="light"
                locale="zh_CN"
                onChange={(_, date) => {
                  if (date) setTradeDate(formatInstantToShanghaiDateString(date));
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}

      {Platform.OS === 'android' && androidDateOpen ? (
        <DateTimePicker
          value={shanghaiYmdToLocalNoon(tradeDate)}
          mode="date"
          display="default"
          locale="zh-CN"
          onChange={(_, date) => {
            setAndroidDateOpen(false);
            if (date) setTradeDate(formatInstantToShanghaiDateString(date));
          }}
        />
      ) : null}

    </KeyboardAvoidingView>
  );
}
