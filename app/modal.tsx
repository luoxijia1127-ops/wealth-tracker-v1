/**
 * 添加 / 编辑资产 —— 全屏表单（Modal）
 *
 * 【流程说明】
 * 1) 先选「资产类别」：股票、基金、ETF 要走场内流程；现金类、黄金填「资产名称」与金额。
 * 2) 场内：用搜索框联想股票/基金 → 点选后自动带上代码、交易所、名称 → 再填份额与
 *    「参考收盘价」—— 会存成 lastClose；App 同步行情时会把 push2 现价写入 markPrice。
 * 3) 「用途与目标」默认折叠，点开后再填；现金/黄金金额左侧可选币种（场内标的计价固定 CNY）。
 */

import {
  buildCashLikeAsset,
  buildListedAsset,
  buildPurposeFields,
  resolveAssetId,
  validateCashLikeForm,
  validateListedForm,
} from '@/lib/add-asset-form';
import { addAsset, getAssets, updateAsset } from '@/lib/asset-storage';
import {
  formatExchangeSymbol,
  searchSecurities,
  type SuggestInstrument,
} from '@/lib/eastmoney-suggest';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { getEditingAssetId, clearEditingAssetId } from '@/lib/edit-asset-store';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
  formatMoney,
  getAssetCurrency,
  getAssetDisplayValue,
  isListedChineseAsset,
} from '@/lib/asset-value';
import {
  type AssetCategory,
  ASSET_CATEGORY_ORDER,
  CATEGORY_LABEL_ZH,
  isListedAssetCategory,
  type ChinaExchange,
  type SimpleAsset,
} from '@/types/asset';

export default function AddModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useGlobalSearchParams<{ id?: string }>();
  const editingId = (getEditingAssetId() ?? params.id) ?? undefined;

  useFocusEffect(
    useCallback(() => () => clearEditingAssetId(), [])
  );

  const [editingAsset, setEditingAsset] = useState<SimpleAsset | null>(null);
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
  /** 新增场内：必须从联想选中一次，保证交易所与代码一致 */
  const [instrumentPick, setInstrumentPick] = useState<SuggestInstrument | null>(
    null
  );

  /** 现金 / 黄金资产币种；场内标的固定 CNY */
  const [assetCurrency, setAssetCurrency] = useState('CNY');
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [purposeExpanded, setPurposeExpanded] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    (async () => {
      const assets = await getAssets();
      const asset = assets.find((a) => a.id === editingId);
      if (!cancelled && asset) {
        setEditingAsset(asset);
        setName(asset.name);
        setCategory(asset.category as AssetCategory);
        setPurpose(asset.purpose ?? '');
        setPurposeTarget(
          typeof asset.purposeTarget === 'number' && asset.purposeTarget > 0
            ? String(asset.purposeTarget)
            : ''
        );
        setAssetCurrency(normalizeAssetCurrency(asset.currency));
        setPurposeExpanded(
          !!(
            (asset.purpose && asset.purpose.trim().length > 0) ||
            (typeof asset.purposeTarget === 'number' && asset.purposeTarget > 0)
          )
        );
        if (isListedChineseAsset(asset)) {
          setSymbol(asset.symbol ?? '');
          setExchange(asset.exchange ?? 'SH');
          setShares(String(asset.shares ?? ''));
          setPrice(
            typeof asset.lastClose === 'number' ? String(asset.lastClose) : ''
          );
          setValue('');
          setInstrumentPick(null);
          setSearchText('');
          setSuggestions([]);
        } else {
          setSymbol('');
          setExchange('SH');
          setShares('');
          setPrice('');
          setValue(String(asset.value));
          setInstrumentPick(null);
          setSearchText('');
          setSuggestions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId]);

  const isEditMode = !!editingId;
  /** 当前选的类别是否属于「场内证券」三类 */
  const isListedCategory = isListedAssetCategory(category);
  const editingListed =
    !!editingAsset && isListedChineseAsset(editingAsset);
  const showListedFields =
    isListedCategory && (!isEditMode || editingListed);
  const showTotalValue = !isListedCategory || (isEditMode && !editingListed);

  useEffect(() => {
    if (!showListedFields || isEditMode) {
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
  }, [searchText, showListedFields, isEditMode]);

  const handleCategoryChange = useCallback((cat: AssetCategory) => {
    setCategory(cat);
    if (!isListedAssetCategory(cat)) {
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

  /**
   * 点击保存：先做校验，再组 SimpleAsset，最后走 update / add。
   * 校验与组装细节在 lib/add-asset-form.ts，这里只负责弹窗与导航。
   */
  const saveAsset = async () => {
    const purposeFields = buildPurposeFields(purpose, purposeTarget);
    const id = resolveAssetId(isEditMode, editingId, editingAsset?.id);

    let assetToSave: SimpleAsset;

    if (showListedFields) {
      const err = validateListedForm({
        name,
        symbol,
        exchange,
        shares,
        price,
        category,
        purpose,
        purposeTarget,
        isEditMode,
        hasInstrumentPick: !!instrumentPick,
      });
      if (err) {
        Alert.alert('无法保存', err);
        return;
      }
      const sharesNum = parseFloat(shares);
      const priceNum = parseFloat(price);
      assetToSave = buildListedAsset({
        id,
        name,
        category,
        symbol: symbol.trim(),
        exchange: exchange as NonNullable<SimpleAsset['exchange']>,
        shares: sharesNum,
        initialLastClose: priceNum,
        purposeFields,
        emSecid: instrumentPick?.quoteId ?? editingAsset?.emSecid,
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
        currency: assetCurrency,
        purposeFields,
      });
    }

    /** 编辑场内资产时保留已同步的 markPrice，避免保存表单把现价清空 */
    if (
      isEditMode &&
      editingAsset &&
      isListedAssetCategory(assetToSave.category) &&
      typeof editingAsset.markPrice === 'number' &&
      editingAsset.markPrice > 0
    ) {
      assetToSave = {
        ...assetToSave,
        markPrice: editingAsset.markPrice,
        markPriceDate: editingAsset.markPriceDate,
      };
    }

    setSaving(true);
    try {
      if (isEditMode && assetToSave.id) {
        await updateAsset(assetToSave);
      } else {
        await addAsset(assetToSave);
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
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        <Text style={styles.title}>{isEditMode ? 'Edit Asset' : 'Add Asset'}</Text>

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

        {showListedFields && (
          <>
            {!isEditMode ? (
              <>
                <Text style={styles.label}>搜索证券（代码或简称）</Text>
                <TextInput
                  placeholder="输入如 茅台、600519、ETF…"
                  placeholderTextColor="#6B7280"
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
                    <ActivityIndicator size="small" color="#34C759" />
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
              </>
            ) : (
              <View style={styles.selectedCard}>
                <Text style={styles.selectedLabel}>证券代码（不可改）</Text>
                <Text style={styles.selectedMain}>
                  {formatExchangeSymbol(exchange, symbol)}
                </Text>
                <Text style={styles.hint}>修改代码请删除该资产后重新添加。</Text>
              </View>
            )}

            <Text style={styles.label}>标的名称</Text>
            <TextInput
              placeholder="可从上方搜索结果带入，也可修改"
              placeholderTextColor="#6B7280"
              style={styles.input}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>份额</Text>
            <TextInput
              placeholder="持有数量"
              placeholderTextColor="#6B7280"
              style={styles.input}
              value={shares}
              onChangeText={setShares}
              keyboardType="decimal-pad"
            />
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
                placeholderTextColor="#6B7280"
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
              placeholderTextColor="#6B7280"
              style={styles.input}
              value={name}
              onChangeText={setName}
            />
            <Text style={styles.label}>
              {isEditMode ? '当前金额' : '当前金额'}
            </Text>
            {isEditMode && editingAsset != null && (
              <Text style={styles.previousValue}>
                当前市值：{' '}
                {formatMoney(
                  getAssetDisplayValue(editingAsset),
                  getAssetCurrency(editingAsset)
                )}
              </Text>
            )}
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
                placeholderTextColor="#6B7280"
                style={[
                  styles.input,
                  styles.amountInputFlex,
                  isEditMode && styles.valueInputHighlight,
                ]}
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                autoFocus={isEditMode}
              />
            </View>
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
              placeholderTextColor="#6B7280"
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
              placeholderTextColor="#6B7280"
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
            {saving ? 'Saving…' : 'Save'}
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

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
    backgroundColor: '#0B0B0F',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B0B0F',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E5E7EB',
    marginBottom: 24,
  },
  sectionDividerLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D1D5DB',
    marginTop: 28,
    marginBottom: 4,
  },
  purposeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  purposeSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D1D5DB',
  },
  purposeCaret: {
    fontSize: 14,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  purposeSectionBody: {
    marginBottom: 4,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 56,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#15161A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  currencyChipStatic: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#15161A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  currencyChipText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  currencyChevron: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  amountInputFlex: {
    flex: 1,
    marginTop: 0,
  },
  currencyModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  currencyModalDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  currencyModalCard: {
    backgroundColor: '#1C1D24',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  currencyModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  currencyModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  currencyModalRowSelected: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  currencyModalRowSymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34C759',
    width: 40,
  },
  currencyModalRowLabel: {
    fontSize: 16,
    color: '#E5E7EB',
  },
  currencyModalCancel: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  currencyModalCancelText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  label: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
    marginTop: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#15161A',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    backgroundColor: '#1E3A2F',
    borderColor: '#34C759',
  },
  optionText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#34C759',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#15161A',
    color: '#E5E7EB',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  valueInputHighlight: {
    borderColor: '#34C759',
    borderWidth: 2,
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
  },
  previousValue: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  },
  hintMuted: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 18,
  },
  suggestLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  suggestLoadingText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  suggestBox: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#12131A',
    overflow: 'hidden',
    maxHeight: 220,
  },
  suggestRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  suggestRowPressed: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  suggestCode: {
    fontSize: 15,
    fontWeight: '700',
    color: '#34C759',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  suggestName: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  suggestEmpty: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
  },
  selectedCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.35)',
  },
  selectedLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  selectedMain: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E7EB',
    lineHeight: 22,
  },
  changeLink: {
    marginTop: 10,
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 32,
    backgroundColor: '#34C759',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
