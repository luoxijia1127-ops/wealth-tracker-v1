/**
 * 资产详情：
 * - 场内 / 黄金（与股票基金同一套）：加减仓 + 编辑信息（流水改份额或克、单价）
 * - 现金类：加减余额 + 编辑信息（流水仅金额）
 */

import { buildPurposeFields } from '@/lib/add-asset-form';
import {
  appendCashMovement,
  ensureCashBaselineLedger,
  usesCashAmountLedger,
} from '@/lib/cash-ledger';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { createAddModalStyles } from '@/lib/modal-styles';
import { createInsightsStyles } from '@/lib/insights-styles';
import { getAssets, updateAsset } from '@/lib/asset-storage';
import { tryApplyListedAdjustTrade } from '@/lib/listed-adjust-trade';
import { formatExchangeSymbol } from '@/lib/eastmoney-suggest';
import { ensureBaselineLedger } from '@/lib/trade-ledger';
import {
  ASSET_CURRENCY_OPTIONS,
  assetCurrencySymbol,
  normalizeAssetCurrency,
} from '@/lib/asset-currency';
import { useFocusEffect, useRouter, useGlobalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  formatMoney,
  getAssetCurrency,
  getAssetDisplayValue,
  isHeldChineseAsset,
} from '@/lib/asset-value';
import {
  type AssetCategory,
  ASSET_CATEGORY_ORDER,
  CATEGORY_LABEL_ZH,
  type CashLedgerEntry,
  getListedUnitPrice,
  isListedAssetCategory,
  type SimpleAsset,
  type TradeLedgerEntry,
} from '@/types/asset';

type ListedPanel = 'adjust' | 'edit';
type CashPanel = 'balance' | 'edit';

const LISTED_TABS: { id: ListedPanel; label: string }[] = [
  { id: 'adjust', label: '加减仓' },
  { id: 'edit', label: '编辑信息' },
];

const CASH_TABS: { id: CashPanel; label: string }[] = [
  { id: 'balance', label: '加减余额' },
  { id: 'edit', label: '编辑信息' },
];

/** 场内「编辑信息」里可切换的类别，仅三类 */
const LISTED_EDIT_CATEGORIES: AssetCategory[] = ['Stock', 'Fund', 'ETF'];

function formatTradeLine(t: TradeLedgerEntry, useGram: boolean): string {
  const side = t.side === 'buy' ? '买入' : '卖出';
  const q = useGram ? '克' : '份';
  const u = useGram ? 'CNY/克' : 'CNY/份';
  return `${t.tradeDate} · ${side} ${t.shares} ${q} @ ¥${t.unitPriceCny.toFixed(4)}（${u}）`;
}

function formatCashLine(e: CashLedgerEntry, currency: string): string {
  const lab = e.side === 'in' ? '入金' : '出金';
  return `${e.entryDate} · ${lab} ${formatMoney(e.amount, currency)}`;
}

export default function AssetActionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useGlobalSearchParams<{ id?: string }>();
  const { theme } = useAppPalette();
  const styles = useMemo(() => createAddModalStyles(theme), [theme]);
  const tabStyles = useMemo(() => createInsightsStyles(theme), [theme]);
  const placeholderColor = useMemo(
    () => rgbaFromHex(theme.primary, 0.42),
    [theme.primary]
  );
  const muted = useMemo(() => rgbaFromHex(theme.primary, 0.55), [theme.primary]);

  const [asset, setAsset] = useState<SimpleAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [listedPanel, setListedPanel] = useState<ListedPanel>('adjust');

  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [tradeShares, setTradeShares] = useState('');
  const [tradePrice, setTradePrice] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  const [listedMetaCategory, setListedMetaCategory] =
    useState<AssetCategory>('Stock');
  const [listedMetaAccount, setListedMetaAccount] = useState('');
  const [listedMetaPurpose, setListedMetaPurpose] = useState('');
  const [listedMetaPurposeTarget, setListedMetaPurposeTarget] = useState('');
  const [listedMetaPurposeExpanded, setListedMetaPurposeExpanded] =
    useState(false);
  const [listedMetaSaving, setListedMetaSaving] = useState(false);

  const [cashName, setCashName] = useState('');
  const [cashCostBasis, setCashCostBasis] = useState('');
  const [cashCategory, setCashCategory] = useState<AssetCategory>('Cash');
  const [cashAccount, setCashAccount] = useState('');
  const [cashPurpose, setCashPurpose] = useState('');
  const [cashPurposeTarget, setCashPurposeTarget] = useState('');
  const [cashPurposeExpanded, setCashPurposeExpanded] = useState(false);
  const [cashCurrency, setCashCurrency] = useState('CNY');
  const [cashCurrencyModalVisible, setCashCurrencyModalVisible] = useState(false);
  const [cashSaving, setCashSaving] = useState(false);
  const [cashPanel, setCashPanel] = useState<CashPanel>('balance');
  const [cashAdjustSide, setCashAdjustSide] = useState<'in' | 'out'>('in');
  const [cashAdjustAmount, setCashAdjustAmount] = useState('');
  const [cashAdjustSaving, setCashAdjustSaving] = useState(false);

  const [fbName, setFbName] = useState('');
  const [fbValue, setFbValue] = useState('');
  const [fbCategory, setFbCategory] = useState<AssetCategory>('Cash');
  const [fbAccount, setFbAccount] = useState('');
  const [fbPurpose, setFbPurpose] = useState('');
  const [fbPurposeTarget, setFbPurposeTarget] = useState('');
  const [fbPurposeExpanded, setFbPurposeExpanded] = useState(false);
  const [fbCostBasis, setFbCostBasis] = useState('');
  const [fbCurrency, setFbCurrency] = useState('CNY');
  const [fbCurrencyModal, setFbCurrencyModal] = useState(false);
  const [fbSaving, setFbSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setAsset(null);
      setLoading(false);
      return;
    }
    const list = await getAssets();
    setAsset(list.find((a) => a.id === id) ?? null);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!asset) return;
    if (isHeldChineseAsset(asset)) {
      if (asset.category === 'Gold') {
        setListedMetaCategory('Gold');
      } else {
        const cat = asset.category as AssetCategory;
        setListedMetaCategory(
          LISTED_EDIT_CATEGORIES.includes(cat) ? cat : 'Stock'
        );
      }
      setListedMetaAccount(
        typeof asset.account === 'string' ? asset.account : ''
      );
      setListedMetaPurpose(asset.purpose ?? '');
      setListedMetaPurposeTarget(
        typeof asset.purposeTarget === 'number' && asset.purposeTarget > 0
          ? String(asset.purposeTarget)
          : ''
      );
      setListedMetaPurposeExpanded(
        !!(
          (asset.purpose && asset.purpose.trim().length > 0) ||
          (typeof asset.purposeTarget === 'number' && asset.purposeTarget > 0)
        )
      );
    } else if (usesCashAmountLedger(asset)) {
      setCashName(asset.name);
      setCashCostBasis(
        typeof asset.costBasis === 'number' && !Number.isNaN(asset.costBasis)
          ? String(asset.costBasis)
          : ''
      );
      setCashCategory(asset.category as AssetCategory);
      setCashAccount(typeof asset.account === 'string' ? asset.account : '');
      setCashPurpose(asset.purpose ?? '');
      setCashPurposeTarget(
        typeof asset.purposeTarget === 'number' && asset.purposeTarget > 0
          ? String(asset.purposeTarget)
          : ''
      );
      setCashPurposeExpanded(
        !!(
          (asset.purpose && asset.purpose.trim().length > 0) ||
          (typeof asset.purposeTarget === 'number' && asset.purposeTarget > 0)
        )
      );
      setCashCurrency(normalizeAssetCurrency(asset.currency));
    } else {
      setFbName(asset.name);
      setFbValue(String(asset.value));
      setFbCategory(asset.category as AssetCategory);
      setFbAccount(typeof asset.account === 'string' ? asset.account : '');
      setFbPurpose(asset.purpose ?? '');
      setFbPurposeTarget(
        typeof asset.purposeTarget === 'number' && asset.purposeTarget > 0
          ? String(asset.purposeTarget)
          : ''
      );
      setFbPurposeExpanded(
        !!(
          (asset.purpose && asset.purpose.trim().length > 0) ||
          (typeof asset.purposeTarget === 'number' && asset.purposeTarget > 0)
        )
      );
      setFbCostBasis(
        typeof asset.costBasis === 'number' && !Number.isNaN(asset.costBasis)
          ? String(asset.costBasis)
          : ''
      );
      setFbCurrency(normalizeAssetCurrency(asset.currency));
    }
  }, [asset]);

  const { trades, tradesAreSynthetic } = useMemo(() => {
    if (!asset) {
      return { trades: [] as TradeLedgerEntry[], tradesAreSynthetic: false };
    }
    const stored = asset.tradeHistory ?? [];
    if (stored.length > 0) {
      const sorted = [...stored].sort((a, b) =>
        b.tradeDate.localeCompare(a.tradeDate) !== 0
          ? b.tradeDate.localeCompare(a.tradeDate)
          : b.id.localeCompare(a.id)
      );
      return { trades: sorted, tradesAreSynthetic: false };
    }
    if (isHeldChineseAsset(asset)) {
      const inferred = ensureBaselineLedger(asset);
      if (inferred.length > 0) {
        return { trades: inferred, tradesAreSynthetic: true };
      }
    }
    return { trades: [], tradesAreSynthetic: false };
  }, [asset]);

  const { cashRows, cashRowsSynthetic } = useMemo(() => {
    if (!asset || !usesCashAmountLedger(asset)) {
      return { cashRows: [] as CashLedgerEntry[], cashRowsSynthetic: false };
    }
    const stored = asset.cashLedger ?? [];
    if (stored.length > 0) {
      const sorted = [...stored].sort((a, b) =>
        b.entryDate.localeCompare(a.entryDate) !== 0
          ? b.entryDate.localeCompare(a.entryDate)
          : b.id.localeCompare(a.id)
      );
      return { cashRows: sorted, cashRowsSynthetic: false };
    }
    const inferred = ensureCashBaselineLedger(asset);
    if (inferred.length > 0) {
      return { cashRows: inferred, cashRowsSynthetic: true };
    }
    return { cashRows: [], cashRowsSynthetic: false };
  }, [asset]);

  const headerTitle = useMemo(() => {
    if (!asset) return '';
    if (isHeldChineseAsset(asset)) {
      return `${formatExchangeSymbol(asset.exchange!, asset.symbol!)} · ${asset.name}`;
    }
    return asset.name;
  }, [asset]);

  const onSaveListedAdjust = async () => {
    if (!asset || !isHeldChineseAsset(asset)) return;
    setAdjustSaving(true);
    try {
      const r = tryApplyListedAdjustTrade(asset, {
        side: tradeMode,
        sharesStr: tradeShares,
        unitPriceStr: tradePrice,
      });
      if (!r.ok) {
        Alert.alert('无法保存', r.message);
        return;
      }
      await updateAsset(r.asset);
      setTradeShares('');
      setTradePrice('');
      setTradeMode('buy');
      await load();
    } finally {
      setAdjustSaving(false);
    }
  };

  const onSaveListedMeta = async () => {
    if (!asset || !isHeldChineseAsset(asset)) return;
    if (asset.category === 'Gold') {
      if (listedMetaCategory !== 'Gold') {
        Alert.alert('无法保存', '行情型黄金类别须为「黄金」。');
        return;
      }
    } else if (!isListedAssetCategory(listedMetaCategory)) {
      Alert.alert('无法保存', '场内资产类别须为股票、基金或 ETF。');
      return;
    }
    setListedMetaSaving(true);
    try {
      const accountTrim = listedMetaAccount.trim();
      const pf = buildPurposeFields(listedMetaPurpose, listedMetaPurposeTarget);
      const next: SimpleAsset = {
        ...asset,
        category: listedMetaCategory,
        ...pf,
      };
      if (accountTrim.length > 0) next.account = accountTrim;
      else delete next.account;
      if (!('purpose' in pf)) delete next.purpose;
      if (!('purposeTarget' in pf)) delete next.purposeTarget;
      await updateAsset(next);
      await load();
      Alert.alert('已保存');
    } finally {
      setListedMetaSaving(false);
    }
  };

  const onSaveCashBalance = async () => {
    if (!asset || !usesCashAmountLedger(asset)) return;
    const amt = parseFloat(cashAdjustAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      Alert.alert('无法保存', '请输入有效的正数金额。');
      return;
    }
    setCashAdjustSaving(true);
    try {
      const next = appendCashMovement(
        asset,
        cashAdjustSide,
        amt,
        getShanghaiDateString()
      );
      await updateAsset(next);
      setCashAdjustAmount('');
      setCashAdjustSide('in');
      await load();
    } catch (e) {
      Alert.alert(
        '无法保存',
        e instanceof Error ? e.message : '余额与流水不一致。'
      );
    } finally {
      setCashAdjustSaving(false);
    }
  };

  const onSaveCashMeta = async () => {
    if (!asset || !usesCashAmountLedger(asset)) return;
    if (!cashName.trim()) {
      Alert.alert('无法保存', '请填写资产名称。');
      return;
    }
    setCashSaving(true);
    try {
      const cbTrim = cashCostBasis.trim();
      const costBasisNum =
        cbTrim !== '' ? parseFloat(cashCostBasis) : undefined;
      const accountTrim = cashAccount.trim();
      const pf = buildPurposeFields(cashPurpose, cashPurposeTarget);
      const next: SimpleAsset = {
        ...asset,
        name: cashName.trim(),
        category: cashCategory,
        currency: normalizeAssetCurrency(cashCurrency),
        ...pf,
      };
      if (accountTrim.length > 0) next.account = accountTrim;
      else delete next.account;
      if (!('purpose' in pf)) delete next.purpose;
      if (!('purposeTarget' in pf)) delete next.purposeTarget;
      if (
        costBasisNum !== undefined &&
        !Number.isNaN(costBasisNum) &&
        costBasisNum >= 0
      ) {
        next.costBasis = costBasisNum;
      } else {
        delete next.costBasis;
      }
      await updateAsset(next);
      await load();
      Alert.alert('已保存');
    } finally {
      setCashSaving(false);
    }
  };

  const onSaveFallback = async () => {
    if (!asset || isHeldChineseAsset(asset) || usesCashAmountLedger(asset)) {
      return;
    }
    const v = parseFloat(fbValue);
    if (Number.isNaN(v) || v < 0) {
      Alert.alert('无法保存', '请输入有效的当前金额。');
      return;
    }
    if (!fbName.trim()) {
      Alert.alert('无法保存', '请填写资产名称。');
      return;
    }
    setFbSaving(true);
    try {
      const cbTrim = fbCostBasis.trim();
      const costBasisNum = cbTrim !== '' ? parseFloat(fbCostBasis) : undefined;
      const accountTrim = fbAccount.trim();
      const pf = buildPurposeFields(fbPurpose, fbPurposeTarget);
      const next: SimpleAsset = {
        ...asset,
        name: fbName.trim(),
        value: v,
        category: fbCategory,
        currency: normalizeAssetCurrency(fbCurrency),
        ...pf,
      };
      if (accountTrim.length > 0) next.account = accountTrim;
      else delete next.account;
      if (!('purpose' in pf)) delete next.purpose;
      if (!('purposeTarget' in pf)) delete next.purposeTarget;
      if (
        costBasisNum !== undefined &&
        !Number.isNaN(costBasisNum) &&
        costBasisNum >= 0
      ) {
        next.costBasis = costBasisNum;
      } else {
        delete next.costBasis;
      }
      await updateAsset(next);
      await load();
      Alert.alert('已保存');
    } finally {
      setFbSaving(false);
    }
  };

  const contentPadTop = 10;
  const keyboardOffset = Platform.OS === 'ios' ? insets.top + 56 : 0;

  if (!id) {
    return (
      <View style={[styles.keyboardRoot, { paddingTop: contentPadTop, paddingHorizontal: 24 }]}>
        <Text style={styles.headerName}>缺少资产 ID</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View
        style={[
          styles.keyboardRoot,
          { paddingTop: contentPadTop + 24, alignItems: 'center' },
        ]}
      >
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!asset) {
    return (
      <View style={[styles.keyboardRoot, { paddingTop: contentPadTop, paddingHorizontal: 24 }]}>
        <Text style={styles.headerName}>未找到该资产</Text>
        <Pressable
          style={[styles.saveButton, { marginTop: 20 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.saveButtonText}>返回</Text>
        </Pressable>
      </View>
    );
  }

  const held = isHeldChineseAsset(asset);
  const cashLike = usesCashAmountLedger(asset);
  const useGram = asset.category === 'Gold';
  const refPrice = getListedUnitPrice(asset);
  const avgDisp =
    typeof asset.avgCost === 'number' && asset.avgCost > 0
      ? asset.avgCost.toFixed(4)
      : '—';
  const closeDisp =
    typeof asset.lastClose === 'number' && asset.lastClose > 0
      ? String(asset.lastClose)
      : '—';

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardOffset}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: contentPadTop,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.headerName, { marginBottom: 6 }]} numberOfLines={3}>
          {headerTitle}
        </Text>
        <Text style={[styles.headerMeta, { marginBottom: 16 }]}>
          市值{' '}
          {formatMoney(getAssetDisplayValue(asset), getAssetCurrency(asset))}
        </Text>

        {held ? (
          <>
            <View style={tabStyles.tabRow}>
              {LISTED_TABS.map((tab) => (
                <Pressable
                  key={tab.id}
                  accessibilityRole="button"
                  onPress={() => setListedPanel(tab.id)}
                  style={({ pressed }) => [
                    tabStyles.tabChip,
                    listedPanel === tab.id && tabStyles.tabChipActive,
                    pressed && tabStyles.tabChipPressed,
                  ]}
                >
                  <Text
                    style={[
                      tabStyles.tabChipText,
                      listedPanel === tab.id && tabStyles.tabChipTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {listedPanel === 'adjust' ? (
              <View style={tabStyles.chartSurface}>
                <View style={{ padding: 16 }}>
                  <Text style={[styles.hintMuted, { marginBottom: 12 }]}>
                    填写本次成交；保存后写入流水并重算持仓。修改历史成交请在下方点选流水。
                  </Text>
                  <Text style={styles.label}>调整方式</Text>
                  <View style={styles.optionsRow}>
                    <Pressable
                      style={[
                        styles.option,
                        tradeMode === 'buy' && styles.optionSelected,
                      ]}
                      onPress={() => setTradeMode('buy')}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          tradeMode === 'buy' && styles.optionTextSelected,
                        ]}
                      >
                        加仓
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.option,
                        tradeMode === 'sell' && styles.optionSelected,
                      ]}
                      onPress={() => setTradeMode('sell')}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          tradeMode === 'sell' && styles.optionTextSelected,
                        ]}
                      >
                        减仓
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={styles.label}>
                    {useGram
                      ? tradeMode === 'buy'
                        ? '买入克数'
                        : '卖出克数'
                      : tradeMode === 'buy'
                        ? '买入份额'
                        : '卖出份额'}
                  </Text>
                  <TextInput
                    placeholder={
                      useGram
                        ? tradeMode === 'buy'
                          ? '本次买入克数'
                          : '本次卖出克数'
                        : tradeMode === 'buy'
                          ? '本次买入数量'
                          : '本次卖出数量'
                    }
                    placeholderTextColor={placeholderColor}
                    style={styles.input}
                    value={tradeShares}
                    onChangeText={setTradeShares}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.label}>
                    {useGram ? '成交单价（CNY/克）' : '成交单价（CNY/份）'}
                  </Text>
                  <Text style={styles.hintMuted}>
                    卖出价为实际成交价；账面成本仍按摊薄成本计算。
                  </Text>
                  <TextInput
                    placeholder={
                      useGram
                        ? tradeMode === 'buy'
                          ? '本笔买入单价/克'
                          : '本笔卖出单价/克'
                        : tradeMode === 'buy'
                          ? '本笔买入价格'
                          : '本笔卖出价格'
                    }
                    placeholderTextColor={placeholderColor}
                    style={styles.input}
                    value={tradePrice}
                    onChangeText={setTradePrice}
                    keyboardType="decimal-pad"
                  />
                  <Pressable
                    style={[
                      styles.saveButton,
                      adjustSaving && styles.saveButtonDisabled,
                    ]}
                    onPress={() => void onSaveListedAdjust()}
                    disabled={adjustSaving}
                  >
                    <Text style={styles.saveButtonText}>
                      {adjustSaving ? '保存中…' : '保存本笔加减仓'}
                    </Text>
                  </Pressable>

                  <Text style={[styles.label, { marginTop: 22 }]}>
                    历史交易记录
                  </Text>
                  <Text style={[styles.hintMuted, { marginTop: 4 }]}>
                    {tradesAreSynthetic
                      ? '以下为根据当前持仓推算的期初记录。点流水可改为多笔真实成交。'
                      : `点按一条可改日期、方向、${useGram ? '克数' : '份额'}与单价，或删除。`}
                  </Text>
                  {trades.length === 0 ? (
                    <Text style={[styles.hintMuted, { marginTop: 10 }]}>
                      尚无记录；保存加减仓后会出现在此。
                    </Text>
                  ) : (
                    <View style={{ marginTop: 12, gap: 10 }}>
                      {trades.map((t) => (
                        <Pressable
                          key={t.id}
                          style={styles.headerCard}
                          disabled={tradesAreSynthetic}
                          onPress={() => {
                            if (tradesAreSynthetic) return;
                            router.push({
                              pathname: '/trade-edit',
                              params: { assetId: asset.id, tradeId: t.id },
                            });
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 14,
                              color: theme.primary,
                              fontWeight: '600',
                            }}
                          >
                            {formatTradeLine(t, useGram)}
                          </Text>
                          <Text
                            style={{ fontSize: 12, color: muted, marginTop: 6 }}
                          >
                            {tradesAreSynthetic
                              ? '推算记录，请先用加减仓产生流水后再编辑'
                              : '点按编辑'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={tabStyles.chartSurface}>
                <View style={{ padding: 16 }}>
                  <Text style={[styles.hintMuted, { marginBottom: 12 }]}>
                    {useGram ? '克数、成本' : '份额、成本价'}
                    、参考价请通过「加减仓」或下方流水修改；此处仅改分类与账户用途。
                  </Text>
                  <View style={[styles.headerCard, { marginBottom: 16 }]}>
                    <Text style={styles.headerName}>{asset.name}</Text>
                    <Text style={[styles.headerMeta, { marginTop: 6 }]}>
                      持仓 {asset.shares ?? 0} {useGram ? '克' : '份'} · 摊薄成本
                      ¥{avgDisp}
                      {useGram ? '/克' : '/份'} · 日 K 收盘 ¥{closeDisp}
                      {refPrice !== null
                        ? ` · 估值 ¥${refPrice.toFixed(4)}${useGram ? '/克' : '/份'}`
                        : ''}
                    </Text>
                  </View>

                  <Text style={styles.label}>资产类别</Text>
                  <View style={styles.optionsRow}>
                    {(useGram ? (['Gold'] as const) : LISTED_EDIT_CATEGORIES).map((opt) => (
                      <Pressable
                        key={opt}
                        style={[
                          styles.option,
                          listedMetaCategory === opt && styles.optionSelected,
                        ]}
                        onPress={() => setListedMetaCategory(opt)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            listedMetaCategory === opt &&
                              styles.optionTextSelected,
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
                    placeholder="如：同花顺、东方财富…"
                    placeholderTextColor={placeholderColor}
                    style={styles.input}
                    value={listedMetaAccount}
                    onChangeText={setListedMetaAccount}
                  />

                  <Pressable
                    style={styles.purposeSectionHeader}
                    onPress={() =>
                      setListedMetaPurposeExpanded((e) => !e)
                    }
                  >
                    <Text style={styles.purposeSectionTitle}>
                      用途与目标（选填）
                    </Text>
                    <Text style={styles.purposeCaret}>
                      {listedMetaPurposeExpanded ? '▲' : '▼'}
                    </Text>
                  </Pressable>
                  {listedMetaPurposeExpanded ? (
                    <View style={styles.purposeSectionBody}>
                      <Text style={styles.label}>用途说明</Text>
                      <TextInput
                        placeholder="如：旅游基金"
                        placeholderTextColor={placeholderColor}
                        style={styles.input}
                        value={listedMetaPurpose}
                        onChangeText={setListedMetaPurpose}
                      />
                      <Text style={styles.label}>目标金额（¥）</Text>
                      <TextInput
                        placeholder="不填则不显示进度"
                        placeholderTextColor={placeholderColor}
                        style={styles.input}
                        value={listedMetaPurposeTarget}
                        onChangeText={setListedMetaPurposeTarget}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  ) : null}

                  <Pressable
                    style={[
                      styles.saveButton,
                      listedMetaSaving && styles.saveButtonDisabled,
                    ]}
                    onPress={() => void onSaveListedMeta()}
                    disabled={listedMetaSaving}
                  >
                    <Text style={styles.saveButtonText}>
                      {listedMetaSaving ? '保存中…' : '保存编辑信息'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        ) : cashLike ? (
          <>
            <View style={tabStyles.tabRow}>
              {CASH_TABS.map((tab) => (
                <Pressable
                  key={tab.id}
                  accessibilityRole="button"
                  onPress={() => setCashPanel(tab.id)}
                  style={({ pressed }) => [
                    tabStyles.tabChip,
                    cashPanel === tab.id && tabStyles.tabChipActive,
                    pressed && tabStyles.tabChipPressed,
                  ]}
                >
                  <Text
                    style={[
                      tabStyles.tabChipText,
                      cashPanel === tab.id && tabStyles.tabChipTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {cashPanel === 'balance' ? (
              <View style={tabStyles.chartSurface}>
                <View style={{ padding: 16 }}>
                  <Text style={[styles.hintMuted, { marginBottom: 12 }]}>
                    入金增加余额，出金减少余额；当前币种与下方编辑信息里一致。
                  </Text>
                  <Text style={styles.label}>变动类型</Text>
                  <View style={styles.optionsRow}>
                    <Pressable
                      style={[
                        styles.option,
                        cashAdjustSide === 'in' && styles.optionSelected,
                      ]}
                      onPress={() => setCashAdjustSide('in')}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          cashAdjustSide === 'in' && styles.optionTextSelected,
                        ]}
                      >
                        入金
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.option,
                        cashAdjustSide === 'out' && styles.optionSelected,
                      ]}
                      onPress={() => setCashAdjustSide('out')}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          cashAdjustSide === 'out' && styles.optionTextSelected,
                        ]}
                      >
                        出金
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={styles.label}>
                    金额（{assetCurrencySymbol(cashCurrency)}）
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={cashAdjustAmount}
                    onChangeText={setCashAdjustAmount}
                    keyboardType="decimal-pad"
                    placeholderTextColor={placeholderColor}
                    placeholder="正数金额"
                  />
                  <Pressable
                    style={[
                      styles.saveButton,
                      cashAdjustSaving && styles.saveButtonDisabled,
                    ]}
                    onPress={() => void onSaveCashBalance()}
                    disabled={cashAdjustSaving}
                  >
                    <Text style={styles.saveButtonText}>
                      {cashAdjustSaving ? '保存中…' : '保存本笔变动'}
                    </Text>
                  </Pressable>

                  <Text style={[styles.label, { marginTop: 22 }]}>余额流水</Text>
                  <Text style={[styles.hintMuted, { marginTop: 4 }]}>
                    {cashRowsSynthetic
                      ? '以下为根据当前余额推算的记录；保存新流水后可逐笔编辑。'
                      : '点按一条可改日期、类型与金额，或删除。'}
                  </Text>
                  {cashRows.length === 0 ? (
                    <Text style={[styles.hintMuted, { marginTop: 10 }]}>
                      尚无记录；保存入金/出金后会出现在此。
                    </Text>
                  ) : (
                    <View style={{ marginTop: 12, gap: 10 }}>
                      {cashRows.map((row) => (
                        <Pressable
                          key={row.id}
                          style={styles.headerCard}
                          disabled={cashRowsSynthetic}
                          onPress={() => {
                            if (cashRowsSynthetic) return;
                            router.push({
                              pathname: '/cash-ledger-edit',
                              params: { assetId: asset.id, entryId: row.id },
                            });
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 14,
                              color: theme.primary,
                              fontWeight: '600',
                            }}
                          >
                            {formatCashLine(row, getAssetCurrency(asset))}
                          </Text>
                          <Text
                            style={{ fontSize: 12, color: muted, marginTop: 6 }}
                          >
                            {cashRowsSynthetic
                              ? '推算记录，保存流水后可编辑'
                              : '点按编辑'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={tabStyles.chartSurface}>
                <View style={{ padding: 16 }}>
                  <Text style={[styles.hintMuted, { marginBottom: 14 }]}>
                    余额请在「加减余额」中调整；此处改名称、币种、类别、账户与用途。
                  </Text>
                  <Text style={styles.label}>资产名称</Text>
                  <TextInput
                    style={styles.input}
                    value={cashName}
                    onChangeText={setCashName}
                    placeholderTextColor={placeholderColor}
                  />
                  <Text style={styles.label}>币种</Text>
                  <Pressable
                    style={[styles.currencyChip, { alignSelf: 'flex-start' }]}
                    onPress={() => setCashCurrencyModalVisible(true)}
                  >
                    <Text style={styles.currencyChipText}>
                      {assetCurrencySymbol(cashCurrency)}
                    </Text>
                    <Text style={styles.currencyChevron}>▼</Text>
                  </Pressable>
                  <Text style={styles.label}>本金（选填）</Text>
                  <TextInput
                    style={styles.input}
                    value={cashCostBasis}
                    onChangeText={setCashCostBasis}
                    keyboardType="decimal-pad"
                    placeholderTextColor={placeholderColor}
                  />
                  <Text style={styles.label}>资产类别</Text>
                  <View style={styles.optionsRow}>
                    {ASSET_CATEGORY_ORDER.map((opt) => (
                      <Pressable
                        key={opt}
                        style={[
                          styles.option,
                          cashCategory === opt && styles.optionSelected,
                        ]}
                        onPress={() => setCashCategory(opt)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            cashCategory === opt && styles.optionTextSelected,
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
                    style={styles.input}
                    value={cashAccount}
                    onChangeText={setCashAccount}
                    placeholderTextColor={placeholderColor}
                  />
                  <Pressable
                    style={styles.purposeSectionHeader}
                    onPress={() => setCashPurposeExpanded((e) => !e)}
                  >
                    <Text style={styles.purposeSectionTitle}>
                      用途与目标（选填）
                    </Text>
                    <Text style={styles.purposeCaret}>
                      {cashPurposeExpanded ? '▲' : '▼'}
                    </Text>
                  </Pressable>
                  {cashPurposeExpanded ? (
                    <View style={styles.purposeSectionBody}>
                      <Text style={styles.label}>用途说明</Text>
                      <TextInput
                        style={styles.input}
                        value={cashPurpose}
                        onChangeText={setCashPurpose}
                        placeholderTextColor={placeholderColor}
                      />
                      <Text style={styles.label}>
                        目标金额（{assetCurrencySymbol(cashCurrency)}）
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={cashPurposeTarget}
                        onChangeText={setCashPurposeTarget}
                        keyboardType="decimal-pad"
                        placeholderTextColor={placeholderColor}
                      />
                    </View>
                  ) : null}
                  <Pressable
                    style={[
                      styles.saveButton,
                      cashSaving && styles.saveButtonDisabled,
                    ]}
                    onPress={() => void onSaveCashMeta()}
                    disabled={cashSaving}
                  >
                    <Text style={styles.saveButtonText}>
                      {cashSaving ? '保存中…' : '保存编辑信息'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={tabStyles.chartSurface}>
            <View style={{ padding: 16 }}>
              <Text style={[styles.hintMuted, { marginBottom: 14 }]}>
                该条缺少完整证券信息。黄金与股票/基金相同，需在「+」中添加时选择标的并填写克数与单价。也可在此临时改名称与金额。
              </Text>
              <Text style={styles.label}>资产名称</Text>
              <TextInput
                style={styles.input}
                value={fbName}
                onChangeText={setFbName}
                placeholderTextColor={placeholderColor}
              />
              <Text style={styles.label}>当前金额</Text>
              <View style={styles.amountRow}>
                <Pressable
                  style={styles.currencyChip}
                  onPress={() => setFbCurrencyModal(true)}
                >
                  <Text style={styles.currencyChipText}>
                    {assetCurrencySymbol(fbCurrency)}
                  </Text>
                  <Text style={styles.currencyChevron}>▼</Text>
                </Pressable>
                <TextInput
                  style={[styles.input, styles.amountInputFlex]}
                  value={fbValue}
                  onChangeText={setFbValue}
                  keyboardType="decimal-pad"
                  placeholderTextColor={placeholderColor}
                />
              </View>
              <Text style={styles.label}>本金（选填）</Text>
              <TextInput
                style={styles.input}
                value={fbCostBasis}
                onChangeText={setFbCostBasis}
                keyboardType="decimal-pad"
                placeholderTextColor={placeholderColor}
              />
              <Text style={styles.label}>资产类别</Text>
              <View style={styles.optionsRow}>
                {ASSET_CATEGORY_ORDER.map((opt) => (
                  <Pressable
                    key={opt}
                    style={[
                      styles.option,
                      fbCategory === opt && styles.optionSelected,
                    ]}
                    onPress={() => setFbCategory(opt)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        fbCategory === opt && styles.optionTextSelected,
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
                style={styles.input}
                value={fbAccount}
                onChangeText={setFbAccount}
                placeholderTextColor={placeholderColor}
              />
              <Pressable
                style={styles.purposeSectionHeader}
                onPress={() => setFbPurposeExpanded((e) => !e)}
              >
                <Text style={styles.purposeSectionTitle}>用途与目标（选填）</Text>
                <Text style={styles.purposeCaret}>
                  {fbPurposeExpanded ? '▲' : '▼'}
                </Text>
              </Pressable>
              {fbPurposeExpanded ? (
                <View style={styles.purposeSectionBody}>
                  <Text style={styles.label}>用途说明</Text>
                  <TextInput
                    style={styles.input}
                    value={fbPurpose}
                    onChangeText={setFbPurpose}
                    placeholderTextColor={placeholderColor}
                  />
                  <Text style={styles.label}>目标金额</Text>
                  <TextInput
                    style={styles.input}
                    value={fbPurposeTarget}
                    onChangeText={setFbPurposeTarget}
                    keyboardType="decimal-pad"
                    placeholderTextColor={placeholderColor}
                  />
                </View>
              ) : null}
              <Pressable
                style={[
                  styles.saveButton,
                  fbSaving && styles.saveButtonDisabled,
                ]}
                onPress={() => void onSaveFallback()}
                disabled={fbSaving}
              >
                <Text style={styles.saveButtonText}>
                  {fbSaving ? '保存中…' : '保存'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable
          style={[styles.saveButton, { marginTop: 22, backgroundColor: muted }]}
          onPress={() => router.back()}
        >
          <Text style={styles.saveButtonText}>关闭</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={cashCurrencyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCashCurrencyModalVisible(false)}
      >
        <View style={styles.currencyModalBackdrop}>
          <Pressable
            style={styles.currencyModalDismiss}
            onPress={() => setCashCurrencyModalVisible(false)}
          />
          <View style={styles.currencyModalCard}>
            <Text style={styles.currencyModalTitle}>选择币种</Text>
            {ASSET_CURRENCY_OPTIONS.map((o) => (
              <Pressable
                key={o.code}
                style={[
                  styles.currencyModalRow,
                  cashCurrency === o.code && styles.currencyModalRowSelected,
                ]}
                onPress={() => {
                  setCashCurrency(o.code);
                  setCashCurrencyModalVisible(false);
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
              onPress={() => setCashCurrencyModalVisible(false)}
            >
              <Text style={styles.currencyModalCancelText}>取消</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={fbCurrencyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setFbCurrencyModal(false)}
      >
        <View style={styles.currencyModalBackdrop}>
          <Pressable
            style={styles.currencyModalDismiss}
            onPress={() => setFbCurrencyModal(false)}
          />
          <View style={styles.currencyModalCard}>
            <Text style={styles.currencyModalTitle}>选择币种</Text>
            {ASSET_CURRENCY_OPTIONS.map((o) => (
              <Pressable
                key={o.code}
                style={[
                  styles.currencyModalRow,
                  fbCurrency === o.code && styles.currencyModalRowSelected,
                ]}
                onPress={() => {
                  setFbCurrency(o.code);
                  setFbCurrencyModal(false);
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
              onPress={() => setFbCurrencyModal(false)}
            >
              <Text style={styles.currencyModalCancelText}>取消</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
