/**
 * 新增资产（Modal）
 *
 * 编辑已有资产、加减仓、改流水请在 Dashboard 点进资产详情页完成，不再使用本弹窗。
 */

import {
  buildCashLikeAsset,
  buildListedAsset,
  buildPurposeFields,
  validateCashLikeForm,
  validateListedForm,
} from '@/lib/add-asset-form';
import { addAsset } from '@/lib/asset-storage';
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
  const showListedFields = isListedCategory || category === 'Gold';
  const showTotalValue = !showListedFields;

  useEffect(() => {
    if (!showListedFields) {
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
  }, [searchText, showListedFields]);

  const handleCategoryChange = useCallback((cat: AssetCategory) => {
    setCategory(cat);
    if (!isListedAssetCategory(cat) && cat !== 'Gold') {
      setInstrumentPick(null);
      setSearchText('');
      setSuggestions([]);
      setSymbol('');
    } else {
      setAssetCurrency('CNY');
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

      if (showListedFields) {
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

      await addAsset(assetToSave);
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

        {showListedFields && (
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

            <Text style={styles.label}>
              {category === 'Gold' ? '克数' : '份额'}
            </Text>
            <TextInput
              placeholder={category === 'Gold' ? '持有克数' : '持有数量'}
              placeholderTextColor={placeholderColor}
              style={styles.input}
              value={shares}
              onChangeText={setShares}
              keyboardType="decimal-pad"
            />
            <Text style={styles.label}>
              {category === 'Gold'
                ? '成本价 / 买价（人民币/克）'
                : '成本价 / 买价（人民币/份）'}
            </Text>
            <Text style={styles.hintMuted}>
              {category === 'Gold'
                ? '记录每克成本；可与下方参考价不同。'
                : '记录真实持仓成本，便于日后算收益率；可与下方参考收盘价不同。'}
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
              {showListedFields
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
