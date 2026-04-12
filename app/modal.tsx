/**
 * 新增资产（Modal）
 *
 * 编辑已有资产、加减仓、改流水请在 Dashboard 点进资产详情页完成，不再使用本弹窗。
 * 股票/基金/ETF：同一套表单，支持 A 股（东财）与美股/港股（OpenFIGI 联想）；收盘价仅由 Dashboard 同步写入。
 */

import { FormRow } from '@/components/add-asset/form-row';
import { FundingSourcePicker } from '@/components/add-asset/funding-source-picker';
import { InlineSelect } from '@/components/add-asset/inline-select';
import { GlassSurface } from '@/components/glass-surface';
import { TradingDateCalendarModal } from '@/components/trading-date-calendar-modal';
import { formatYmdChineseLine, YmdDateFields } from '@/components/ymd-date-fields';
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
import { fetchAddAssetReferencePrice } from '@/lib/add-asset-reference-price';
import {
  ASSET_CURRENCY_OPTIONS,
  assetCurrencySymbol,
  normalizeAssetCurrency,
} from '@/lib/asset-currency';
import { canAddAnotherAsset } from '@/lib/asset-limit';
import { saveAssets } from '@/lib/asset-storage';
import { appendCashMovement, usesCashAmountLedger } from '@/lib/cash-ledger';
import { rgbaFromHex } from '@/lib/color-utils';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import {
  formatExchangeSymbol,
  searchSgeSecuritiesMerged,
} from '@/lib/eastmoney-suggest';
import { convertListingCostToCnyCashDebit } from '@/lib/fx-rates';
import { syncNetWorthFromMarket } from '@/lib/net-worth-sync';
import {
  searchUnifiedInstruments,
  type UnifiedSuggestItem,
} from '@/lib/instrument-search';
import { createAddModalStyles } from '@/lib/modal-styles';
import { assetRepository } from '@/lib/repositories/asset-repository';
import { preciousMetalSpotFromSgeContractCode } from '@/lib/sge-eastmoney-quote';
import {
  FREE_ASSET_LIMIT,
} from '@/lib/subscription-constants';
import {
  ASSET_CATEGORY_ORDER,
  CATEGORY_LABEL_ZH,
  generateAssetId,
  isListedAssetCategory,
  PRECIOUS_METAL_LABEL_ZH,
  PRECIOUS_METAL_SPOT_ORDER,
  type AssetCategory,
  type ListingExchange,
  type PreciousMetalSpot,
  type SimpleAsset,
} from '@/types/asset';
import { Ionicons } from '@expo/vector-icons';
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
  const [tradeDateCalendarOpen, setTradeDateCalendarOpen] = useState(false);

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
  const [listedQuoteLoading, setListedQuoteLoading] = useState(false);
  const [listedQuoteHint, setListedQuoteHint] = useState<string | null>(null);
  const [goldQuoteLoading, setGoldQuoteLoading] = useState(false);
  const [goldQuoteHint, setGoldQuoteHint] = useState<string | null>(null);
  const [purposeExpanded, setPurposeExpanded] = useState(false);

  const [account, setAccount] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [fundingOptions, setFundingOptions] = useState<SimpleAsset[]>([]);
  const [fundingSourceId, setFundingSourceId] = useState('');
  const [preciousMetalSpot, setPreciousMetalSpot] =
    useState<PreciousMetalSpot>('XAU');
  const [goldSearchText, setGoldSearchText] = useState('');
  const [goldSuggestions, setGoldSuggestions] = useState<UnifiedSuggestItem[]>(
    []
  );
  const [goldSuggestLoading, setGoldSuggestLoading] = useState(false);
  const [goldInstrumentPick, setGoldInstrumentPick] =
    useState<UnifiedSuggestItem | null>(null);

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
  /** 用途目标与 A 股/贵金属同为人民币展示；美股/港股标的与报价币种一致 */
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
    if (!showGoldForm) {
      setGoldSuggestions([]);
      setGoldSuggestLoading(false);
      return;
    }
    const q = goldSearchText.trim();
    if (q.length < 1) {
      setGoldSuggestions([]);
      setGoldSuggestLoading(false);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(() => {
      setGoldSuggestLoading(true);
      searchSgeSecuritiesMerged(q, ac.signal)
        .then((list) => {
          if (!ac.signal.aborted) {
            setGoldSuggestions(
              list.map((x) => ({
                code: x.code,
                name: x.name,
                exchange: x.exchange,
                quoteId: x.quoteId,
              }))
            );
          }
        })
        .catch(() => {
          if (!ac.signal.aborted) setGoldSuggestions([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setGoldSuggestLoading(false);
        });
    }, 320);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [goldSearchText, showGoldForm]);

  useEffect(() => {
    if (!showListedSecuritiesForm) {
      setListedQuoteHint(null);
      setListedQuoteLoading(false);
      return;
    }
    if (!instrumentPick) {
      setListedQuoteHint(null);
      setListedQuoteLoading(false);
      return;
    }
    let cancelled = false;
    setListedQuoteLoading(true);
    setListedQuoteHint(null);
    fetchAddAssetReferencePrice(instrumentPick, tradeDate)
      .then((r) => {
        if (cancelled || !r) return;
        setCostPrice(String(r.price));
        setListedQuoteHint(r.hint);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setListedQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showListedSecuritiesForm, tradeDate, instrumentPick]);

  useEffect(() => {
    if (!showGoldForm) {
      setGoldQuoteHint(null);
      setGoldQuoteLoading(false);
      return;
    }
    if (!goldInstrumentPick?.quoteId) {
      setGoldQuoteHint(null);
      setGoldQuoteLoading(false);
      return;
    }
    let cancelled = false;
    setGoldQuoteLoading(true);
    setGoldQuoteHint(null);
    fetchAddAssetReferencePrice(goldInstrumentPick, tradeDate)
      .then((r) => {
        if (cancelled) return;
        if (r) {
          setCostPrice(String(r.price));
          setGoldQuoteHint(r.hint);
        } else {
          setGoldQuoteHint('参考价暂不可用，请手填单价');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGoldQuoteHint('参考价获取失败，请手填单价');
        }
      })
      .finally(() => {
        if (!cancelled) setGoldQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showGoldForm, tradeDate, goldInstrumentPick]);

  /** 类现金等表单不展示证券/上金参考价 */
  useEffect(() => {
    if (showGoldForm || showListedSecuritiesForm) return;
    setListedQuoteLoading(false);
    setListedQuoteHint(null);
    setGoldQuoteLoading(false);
    setGoldQuoteHint(null);
  }, [showGoldForm, showListedSecuritiesForm]);

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
    if (cat === 'Gold') {
      setPreciousMetalSpot('XAU');
    }
    if (cat !== 'Gold') {
      setGoldInstrumentPick(null);
      setGoldSearchText('');
      setGoldSuggestions([]);
    }
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

  const onPickGoldInstrument = useCallback((item: UnifiedSuggestItem) => {
    if (item.exchange !== 'SGE' || !item.quoteId) return;
    setGoldInstrumentPick(item);
    setGoldSearchText(formatExchangeSymbol('SGE', item.code));
    setGoldSuggestions([]);
    const spot = preciousMetalSpotFromSgeContractCode(item.code);
    if (spot) setPreciousMetalSpot(spot);
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
      const gate = await canAddAnotherAsset();
      if (!gate.allowed) {
        Alert.alert(
          '已达免费上限',
          `免费版最多添加 ${FREE_ASSET_LIMIT} 个资产。订阅后可继续添加。`,
          [
            { text: '取消', style: 'cancel' },
            { text: '了解订阅', onPress: () => router.push('/paywall') },
          ]
        );
        return;
      }

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
        const quoteName = goldInstrumentPick?.name?.trim() ?? '';
        const err = validateGoldForm({
          name: quoteName,
          shares,
          costPrice,
          purpose,
          purposeTarget,
        });
        if (err) {
          Alert.alert('无法保存', err);
          return;
        }
        if (!goldInstrumentPick?.quoteId) {
          Alert.alert('无法保存', '请搜索并选择上金现货代码。');
          return;
        }
        const grams = parseFloat(shares);
        const costNum = parseFloat(costPrice);
        const src = fundingOptions.find((x) => x.id === fundingSourceId);
        assetToSave = buildGoldAsset({
          id,
          name: quoteName,
          shares: grams,
          avgCost: costNum,
          tradeDate: tradeDay,
          preciousMetalSpot,
          emSecid: goldInstrumentPick?.quoteId,
          symbol:
            goldInstrumentPick?.exchange === 'SGE'
              ? goldInstrumentPick.code
              : undefined,
          exchange:
            goldInstrumentPick?.exchange === 'SGE' ? 'SGE' : undefined,
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
        });
        if (err) {
          Alert.alert('无法保存', err);
          return;
        }
        assetToSave = buildCashLikeAsset({
          id,
          name,
          category,
          value: parseFloat(value),
          currency: normalizeAssetCurrency(assetCurrency),
          purposeFields,
          account: accountTrim || undefined,
        });
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
          Alert.alert('无法保存', '所选资金来源不是可扣减余额的类现金资产。');
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
                  ? `买入${assetToSave.category === 'Gold' ? '贵金属' : '资产'}资金划转`
                  : `买入${assetToSave.category === 'Gold' ? '贵金属' : '资产'}（${listingCur} ${rawCost.toFixed(2)} 折人民币扣款）`,
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
      try {
        await syncNetWorthFromMarket();
      } catch {
        /* 净值可稍后在首页下拉刷新 */
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
    setTradeDateCalendarOpen(true);
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
        <GlassSurface
          borderRadius={36}
          intensity={54}
          variant="editorial"
          contentStyle={styles.glassFormInner}
        >
        <View style={styles.categoryRowWrap}>
          <View style={styles.formRowIconColumn}>
            <View style={styles.formRowIconLabelSpacer} />
            <View style={styles.formRowIconWrap}>
              <Ionicons name="grid-outline" size={20} color={iconMuted} />
            </View>
          </View>
          <View style={styles.categoryChipsWrap}>
            <Text style={styles.formRowLabel}>资产类别</Text>
            {[0, 1].map((row) => (
              <View
                key={row}
                style={[
                  styles.categoryRowOneLine,
                  row === 1 ? { marginTop: 4 } : null,
                ]}
              >
                {ASSET_CATEGORY_ORDER.slice(row * 3, row * 3 + 3).map(
                  (opt) => (
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
                  )
                )}
              </View>
            ))}
          </View>
        </View>

        <FormRow
          styles={styles}
          iconMuted={iconMuted}
          icon="calendar-outline"
          label="交易时间"
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
              icon="diamond-outline"
              label="贵金属品种"
            >
              <View style={styles.optionsRow}>
                {PRECIOUS_METAL_SPOT_ORDER.map((spot) => (
                  <Pressable
                    key={spot}
                    style={[
                      styles.option,
                      preciousMetalSpot === spot && styles.optionSelected,
                    ]}
                    onPress={() => setPreciousMetalSpot(spot)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        preciousMetalSpot === spot && styles.optionTextSelected,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                    >
                      {PRECIOUS_METAL_LABEL_ZH[spot]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </FormRow>
            <View style={styles.categoryBlock}>
              <View style={styles.formRowIconColumn}>
                <View style={styles.formRowIconLabelSpacer} />
                <View style={styles.formRowIconWrap}>
                  <Ionicons name="search-outline" size={18} color={iconMuted} />
                </View>
              </View>
              <View style={styles.categoryChipsWrap}>
                <Text style={styles.formRowLabel}>上金现货代码</Text>
                <TextInput
                  placeholder="代码或简称，支持小写、模糊（如 au99、白银）"
                  placeholderTextColor={placeholderColor}
                  style={styles.input}
                  value={goldSearchText}
                  onChangeText={(t) => {
                    setGoldSearchText(t);
                    if (goldInstrumentPick && t.trim().length > 0) {
                      setGoldInstrumentPick(null);
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
            {goldSuggestLoading && (
              <View style={styles.suggestLoadingRow}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={styles.suggestLoadingText}>搜索中…</Text>
              </View>
            )}
            {!goldSuggestLoading && goldSuggestions.length > 0 && (
              <View style={styles.suggestBox}>
                {goldSuggestions.map((item) => (
                  <Pressable
                    key={`${item.exchange}-${item.code}-${item.quoteId ?? ''}`}
                    style={({ pressed }) => [
                      styles.suggestRow,
                      pressed && styles.suggestRowPressed,
                    ]}
                    onPress={() => onPickGoldInstrument(item)}
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
            {!goldSuggestLoading &&
              goldSearchText.trim().length > 0 &&
              goldSuggestions.length === 0 && (
                <Text style={styles.suggestEmpty}>无匹配结果</Text>
              )}
            {goldInstrumentPick?.exchange === 'SGE' && (
              <View style={styles.selectedCard}>
                <Text style={styles.selectedLabel}>资产名称（行情）</Text>
                <Text style={styles.selectedMain}>
                  {goldInstrumentPick.name}
                </Text>
                <Text style={[styles.selectedMain, { marginTop: 6, opacity: 0.85 }]}>
                  {formatExchangeSymbol('SGE', goldInstrumentPick.code)}
                </Text>
                <Pressable
                  onPress={() => {
                    setGoldInstrumentPick(null);
                    setGoldSearchText('');
                  }}
                >
                  <Text style={styles.changeLink}>清除</Text>
                </Pressable>
              </View>
            )}
            <FormRow styles={styles} iconMuted={iconMuted} icon="pie-chart-outline">
              <View style={[styles.listedTwoCol, { alignItems: 'flex-start' }]}>
                <View style={[styles.listedColFlex, { maxWidth: '36%' }]}>
                  <Text style={styles.formRowLabel}>数量（克）</Text>
                  <TextInput
                    placeholder="克"
                    placeholderTextColor={placeholderColor}
                    style={styles.inputCompact}
                    value={shares}
                    onChangeText={setShares}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.listedColFlex, { flex: 1.4, minWidth: 0 }]}>
                  <Text style={styles.formRowLabel}>单价（CNY/克）</Text>
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
              {goldQuoteLoading && goldInstrumentPick?.quoteId ? (
                <View style={styles.suggestLoadingRow}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={styles.suggestLoadingText}>
                    同步参考价…
                  </Text>
                </View>
              ) : goldQuoteHint && goldInstrumentPick?.quoteId ? (
                <Text style={styles.hint}>参考：{goldQuoteHint}</Text>
              ) : null}
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
              {listedQuoteLoading ? (
                <View style={styles.suggestLoadingRow}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={styles.suggestLoadingText}>同步参考价…</Text>
                </View>
              ) : listedQuoteHint ? (
                <Text style={styles.hint}>参考：{listedQuoteHint}</Text>
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
                placeholder={
                  category === 'Custom'
                    ? '如：数字货币、期货、保险等'
                    : '如：招行朝朝宝、余额宝、车贷专户'
                }
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

      {Platform.OS !== 'web' ? (
        <TradingDateCalendarModal
          visible={tradeDateCalendarOpen}
          onClose={() => setTradeDateCalendarOpen(false)}
          value={tradeDate}
          onSelect={setTradeDate}
          themePrimary={theme.primary}
          maxDate={getShanghaiDateString()}
        />
      ) : null}

    </KeyboardAvoidingView>
  );
}
