/**
 * 资产详情：
 * - 场内证券：加减仓 + 编辑信息（流水改份额、单价）
 * - 贵金属：按克 + CNY/克，无证券代码；加减仓与编辑信息同流水模型
 * - 类现金：加减余额 + 编辑信息（流水仅金额）
 */

import { FormRow } from '@/components/add-asset/form-row';
import { FundingSourcePicker } from '@/components/add-asset/funding-source-picker';
import { GlassSurface } from '@/components/glass-surface';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { TradingDateCalendarModal } from '@/components/trading-date-calendar-modal';
import {
  formatYmdForLocale,
  YmdDateFields,
} from '@/components/ymd-date-fields';
import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import { buildPurposeFields } from '@/lib/add-asset-form';
import {
  fetchAddAssetReferencePrice,
  listedAssetToReferencePricePick,
} from '@/lib/add-asset-reference-price';
import {
  ASSET_CURRENCY_OPTIONS,
  assetCurrencySymbol,
  normalizeAssetCurrency,
} from '@/lib/asset-currency';
import { archiveAssetRecord } from '@/lib/asset-recycle';
import { getAssets, saveAssets, updateAsset } from '@/lib/asset-storage';
import {
  formatMoney,
  getAssetCurrency,
  getAssetDisplayValue,
  isAssetHiddenFromDashboard,
  isHeldChineseAsset,
  isInternationalListedAsset,
  isListedChineseAsset,
} from '@/lib/asset-value';
import {
  appendCashMovement,
  ensureCashBaselineLedger,
  usesCashAmountLedger,
} from '@/lib/cash-ledger';
import { rgbaFromHex } from '@/lib/color-utils';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import {
  formatExchangeSymbol,
  searchSgeSecuritiesMerged,
} from '@/lib/eastmoney-suggest';
import { FINANCE_DOWN, FINANCE_UP } from '@/lib/finance-colors';
import { convertListingCostToCnyCashDebit } from '@/lib/fx-rates';
import type { UnifiedSuggestItem } from '@/lib/instrument-search';
import type { TranslationKey } from '@/lib/language';
import { tryApplyListedAdjustTrade } from '@/lib/listed-adjust-trade';
import { createAddModalStyles } from '@/lib/modal-styles';
import { syncNetWorthFromMarket } from '@/lib/net-worth-sync';
import { preciousMetalSpotFromSgeContractCode } from '@/lib/sge-eastmoney-quote';
import {
  computeSellRealizedPnlByTradeId,
  ensureBaselineLedger,
} from '@/lib/trade-ledger';
import {
  ASSET_CATEGORY_ORDER,
  isListedAssetCategory,
  PRECIOUS_METAL_SPOT_ORDER,
  type AssetCategory,
  type CashLedgerEntry,
  type PreciousMetalSpot,
  type SimpleAsset,
  type TradeLedgerEntry,
} from '@/types/asset';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useGlobalSearchParams, useRouter } from 'expo-router';
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

type ListedPanel = 'adjust' | 'edit';
type CashPanel = 'balance' | 'edit';

const LISTED_TABS: { id: ListedPanel }[] = [{ id: 'adjust' }, { id: 'edit' }];

/** 编辑信息头：单价与资产币种一致，固定 2 位小数 */
function formatListedUnitForDisplay(amount: number, currency: string): string {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : 'CNY';
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

const CASH_TABS: { id: CashPanel }[] = [{ id: 'balance' }, { id: 'edit' }];

/**
 * 写入「首笔买入」流水上的资金来源（baseline 行或日期最早的一笔买入），
 * 供编辑信息里补选与新增页一致的资金账户。
 */
function patchBaselineBuyFunding(
  asset: SimpleAsset,
  linkId: string,
  resolveName: (id: string) => string | undefined
): SimpleAsset {
  const th = asset.tradeHistory ? [...asset.tradeHistory] : [];
  if (th.length === 0) return asset;
  let idx = th.findIndex((t) => t.id === `baseline-${asset.id}`);
  if (idx < 0) {
    const buys = th
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.side === 'buy');
    if (buys.length === 0) return asset;
    buys.sort((a, b) => a.t.tradeDate.localeCompare(b.t.tradeDate));
    idx = buys[0]!.i;
  }
  const row = th[idx];
  if (!row || row.side !== 'buy') return asset;
  const nextRow: TradeLedgerEntry = { ...row };
  const id = linkId.trim();
  if (id) {
    nextRow.fundingSourceAssetId = id;
    const nm = resolveName(id);
    if (nm) nextRow.fundingSourceAssetName = nm;
  } else {
    delete nextRow.fundingSourceAssetId;
    delete nextRow.fundingSourceAssetName;
  }
  th[idx] = nextRow;
  return { ...asset, tradeHistory: th };
}

/** 场内「编辑信息」里可切换的类别，仅三类 */
const LISTED_EDIT_CATEGORIES: AssetCategory[] = ['Stock', 'Fund', 'ETF'];

/** 加减余额：解析变动金额（可带 +/-；无符号视为增加） */
function parseSignedCashDelta(s: string): number | null {
  const t = s.trim().replace(/,/g, '');
  if (t === '' || t === '+' || t === '-') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatBalanceInputValue(n: number): string {
  if (!Number.isFinite(n)) return '';
  return String(roundMoney2(n));
}

function formatSignedDeltaInput(delta: number): string {
  if (!Number.isFinite(delta)) return '';
  const r = roundMoney2(delta);
  if (r === 0) return '0';
  if (r > 0) return `+${r}`;
  return String(r);
}

/** 优先使用「变动金额」；为空则用「更新后余额」反推 */
function resolveCashBalanceDelta(
  current: number,
  amountStr: string,
  newBalStr: string
): { delta: number; error?: string } {
  const a = amountStr.trim();
  const nb = newBalStr.trim().replace(/,/g, '');
  if (a !== '') {
    const d = parseSignedCashDelta(a);
    if (d === null) return { delta: 0, error: '变动金额格式无效' };
    return { delta: roundMoney2(d) };
  }
  if (nb !== '') {
    const v = Number(nb);
    if (!Number.isFinite(v)) return { delta: 0, error: '更新后余额格式无效' };
    return { delta: roundMoney2(v - current) };
  }
  return { delta: 0, error: '请填写变动金额或更新后余额' };
}

export default function AssetActionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useGlobalSearchParams<{ id?: string }>();
  const { theme, appearance } = useAppPalette();
  const { t, locale } = useLanguage();
  const styles = useMemo(() => createAddModalStyles(theme), [theme]);
  const placeholderColor = useMemo(
    () => rgbaFromHex(theme.primary, 0.42),
    [theme.primary]
  );
  const muted = useMemo(() => rgbaFromHex(theme.primary, 0.55), [theme.primary]);
  const iconMuted = useMemo(
    () => rgbaFromHex(theme.primary, 0.5),
    [theme.primary]
  );
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const [asset, setAsset] = useState<SimpleAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [listedPanel, setListedPanel] = useState<ListedPanel>('adjust');

  const [tradeShares, setTradeShares] = useState('');
  const [tradePrice, setTradePrice] = useState('');
  const [tradeAmount, setTradeAmount] = useState('');
  const [adjustTradeDate, setAdjustTradeDate] = useState(() =>
    getShanghaiDateString()
  );
  const [adjustTradeDateCalendarOpen, setAdjustTradeDateCalendarOpen] =
    useState(false);
  const [adjustQuoteLoading, setAdjustQuoteLoading] = useState(false);
  const [adjustQuoteHint, setAdjustQuoteHint] = useState<string | null>(null);
  const [adjustSaving, setAdjustSaving] = useState(false);
  /** 加仓=扣款来源，减仓=入账去向，合并为一项 */
  const [tradeLinkedCashId, setTradeLinkedCashId] = useState('');
  const [tradeFundingOptions, setTradeFundingOptions] = useState<SimpleAsset[]>([]);

  const [listedMetaCategory, setListedMetaCategory] =
    useState<AssetCategory>('Stock');
  const [listedMetaAccount, setListedMetaAccount] = useState('');
  const [listedMetaPurpose, setListedMetaPurpose] = useState('');
  const [listedMetaPurposeTarget, setListedMetaPurposeTarget] = useState('');
  const [listedMetaPurposeExpanded, setListedMetaPurposeExpanded] =
    useState(false);
  /** 建仓/首笔买入的资金账户（与 tradeHistory 首笔买入上的 funding 一致） */
  const [listedMetaFundingCashId, setListedMetaFundingCashId] = useState('');
  const [listedMetaSaving, setListedMetaSaving] = useState(false);
  const [listedPreciousMetal, setListedPreciousMetal] =
    useState<PreciousMetalSpot>('XAU');
  const [goldSearchText, setGoldSearchText] = useState('');
  const [goldSuggestions, setGoldSuggestions] = useState<UnifiedSuggestItem[]>(
    []
  );
  const [goldSuggestLoading, setGoldSuggestLoading] = useState(false);
  const [goldInstrumentPick, setGoldInstrumentPick] =
    useState<UnifiedSuggestItem | null>(null);

  const [cashName, setCashName] = useState('');
  const [cashCategory, setCashCategory] = useState<AssetCategory>('Cash');
  const [cashAccount, setCashAccount] = useState('');
  const [cashPurpose, setCashPurpose] = useState('');
  const [cashPurposeTarget, setCashPurposeTarget] = useState('');
  const [cashPurposeExpanded, setCashPurposeExpanded] = useState(false);
  const [cashCurrency, setCashCurrency] = useState('CNY');
  const [cashCurrencyModalVisible, setCashCurrencyModalVisible] = useState(false);
  const [cashSaving, setCashSaving] = useState(false);
  const [cashPanel, setCashPanel] = useState<CashPanel>('balance');
  const [cashAdjustAmount, setCashAdjustAmount] = useState('');
  const [cashAdjustNewBalance, setCashAdjustNewBalance] = useState('');
  const [cashAdjustSaving, setCashAdjustSaving] = useState(false);

  const [fbName, setFbName] = useState('');
  const [fbValue, setFbValue] = useState('');
  const [fbCategory, setFbCategory] = useState<AssetCategory>('Cash');
  const [fbAccount, setFbAccount] = useState('');
  const [fbPurpose, setFbPurpose] = useState('');
  const [fbPurposeTarget, setFbPurposeTarget] = useState('');
  const [fbPurposeExpanded, setFbPurposeExpanded] = useState(false);
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
    setTradeFundingOptions(
      list.filter(
        (a) =>
          a.id !== id &&
          usesCashAmountLedger(a) &&
          normalizeAssetCurrency(a.currency) === 'CNY' &&
          typeof a.value === 'number' &&
          a.value > 0
      )
    );
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  useEffect(() => {
    setAdjustTradeDate(getShanghaiDateString());
  }, [id]);

  const listedAdjustRefPick = useMemo(
    () => (asset ? listedAssetToReferencePricePick(asset) : null),
    [
      asset?.id,
      asset?.emSecid,
      asset?.intlQuoteSymbol,
      asset?.exchange,
      asset?.symbol,
      asset?.name,
    ]
  );

  useEffect(() => {
    if (!asset || !isHeldChineseAsset(asset)) {
      setAdjustQuoteLoading(false);
      setAdjustQuoteHint(null);
      return;
    }
    if (!listedAdjustRefPick) {
      setAdjustQuoteLoading(false);
      setAdjustQuoteHint('暂无行情代码，请手填成交单价');
      return;
    }
    const ac = new AbortController();
    setAdjustQuoteLoading(true);
    setAdjustQuoteHint(null);
    fetchAddAssetReferencePrice(listedAdjustRefPick, adjustTradeDate, ac.signal)
      .then((r) => {
        if (ac.signal.aborted) return;
        if (r) {
          setTradePrice(formatBalanceInputValue(r.price));
          setAdjustQuoteHint(r.hint);
        } else {
          setAdjustQuoteHint('参考价暂不可用，请手填单价');
        }
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setAdjustQuoteHint('参考价获取失败，请手填单价');
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setAdjustQuoteLoading(false);
      });
    return () => ac.abort();
  }, [asset, listedAdjustRefPick, adjustTradeDate]);

  useEffect(() => {
    if (!asset) return;
    if (isHeldChineseAsset(asset)) {
      if (asset.category === 'Gold') {
        setListedMetaCategory('Gold');
        setListedPreciousMetal(asset.preciousMetalSpot ?? 'XAU');
        const sid =
          typeof asset.emSecid === 'string' ? asset.emSecid.trim() : '';
        const sym =
          typeof asset.symbol === 'string' ? asset.symbol.trim() : '';
        if (sid && /^\d+\.\d+$/.test(sid) && sym) {
          setGoldInstrumentPick({
            code: sym,
            name: asset.name,
            exchange: 'SGE',
            quoteId: sid,
          });
          setGoldSearchText(formatExchangeSymbol('SGE', sym));
        } else {
          setGoldInstrumentPick(null);
          setGoldSearchText('');
        }
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
      const th = asset.tradeHistory ?? [];
      const baselineBuy =
        th.find((t) => t.id === `baseline-${asset.id}`) ??
        [...th]
          .filter((t) => t.side === 'buy')
          .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))[0];
      setListedMetaFundingCashId(
        baselineBuy && typeof baselineBuy.fundingSourceAssetId === 'string'
          ? baselineBuy.fundingSourceAssetId
          : ''
      );
    } else if (usesCashAmountLedger(asset)) {
      setCashName(asset.name);
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
      setFbCurrency(normalizeAssetCurrency(asset.currency));
    }
  }, [asset]);

  useEffect(() => {
    if (!asset || asset.category !== 'Gold') {
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
  }, [goldSearchText, asset]);

  const onPickGoldInstrument = useCallback((item: UnifiedSuggestItem) => {
    if (item.exchange !== 'SGE' || !item.quoteId) return;
    setGoldInstrumentPick(item);
    setGoldSearchText(formatExchangeSymbol('SGE', item.code));
    setGoldSuggestions([]);
    const spot = preciousMetalSpotFromSgeContractCode(item.code);
    if (spot) setListedPreciousMetal(spot);
  }, []);

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

  const sellRealizedById = useMemo(
    () => computeSellRealizedPnlByTradeId(trades),
    [trades]
  );

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

  const cashCurrentBalance = useMemo(() => {
    if (!asset || !usesCashAmountLedger(asset)) return 0;
    return getAssetDisplayValue(asset);
  }, [asset]);

  const onCashDeltaChange = useCallback(
    (text: string) => {
      setCashAdjustAmount(text);
      const t = text.trim();
      if (t === '') {
        setCashAdjustNewBalance('');
        return;
      }
      if (t === '+' || t === '-') {
        return;
      }
      const d = parseSignedCashDelta(text);
      if (d !== null) {
        const next = roundMoney2(cashCurrentBalance + d);
        setCashAdjustNewBalance(formatBalanceInputValue(next));
      }
    },
    [cashCurrentBalance]
  );

  const onCashNewBalanceChange = useCallback(
    (text: string) => {
      setCashAdjustNewBalance(text);
      const raw = text.trim().replace(/,/g, '');
      if (raw === '') {
        setCashAdjustAmount('');
        return;
      }
      const v = Number(raw);
      if (!Number.isFinite(v)) return;
      const delta = roundMoney2(v - cashCurrentBalance);
      setCashAdjustAmount(formatSignedDeltaInput(delta));
    },
    [cashCurrentBalance]
  );

  /** 加减仓：份额/克数、单价、成交金额联动 */
  const onTradeSharesChange = useCallback(
    (text: string) => {
      setTradeShares(text);
      const t = text.trim();
      if (t === '') {
        setTradeAmount('');
        return;
      }
      if (t === '+' || t === '-') return;
      const signed = parseSignedCashDelta(text);
      if (signed === null || signed === 0) return;
      const absS = Math.abs(signed);
      const p = parseFloat(tradePrice.trim().replace(/,/g, ''));
      if (Number.isFinite(p) && p >= 0 && absS > 0) {
        setTradeAmount(formatBalanceInputValue(roundMoney2(absS * p)));
      }
    },
    [tradePrice]
  );

  const onTradePriceChange = useCallback(
    (text: string) => {
      setTradePrice(text);
      if (text.trim() === '') {
        setTradeAmount('');
        return;
      }
      const p = parseFloat(text.trim().replace(/,/g, ''));
      if (!Number.isFinite(p) || p < 0) return;
      const signed = parseSignedCashDelta(tradeShares);
      if (signed === null || signed === 0) return;
      const absS = Math.abs(signed);
      setTradeAmount(formatBalanceInputValue(roundMoney2(absS * p)));
    },
    [tradeShares]
  );

  const onTradeAmountChange = useCallback(
    (text: string) => {
      setTradeAmount(text);
      const raw = text.trim().replace(/,/g, '');
      if (raw === '') return;
      const amt = parseFloat(raw);
      if (!Number.isFinite(amt) || amt < 0) return;
      const signed = parseSignedCashDelta(tradeShares);
      const absS =
        signed !== null && signed !== 0 ? Math.abs(signed) : null;
      const p = parseFloat(tradePrice.trim().replace(/,/g, ''));
      if (absS !== null && absS > 0) {
        setTradePrice(formatBalanceInputValue(roundMoney2(amt / absS)));
        return;
      }
      if (Number.isFinite(p) && p > 0) {
        setTradeShares(formatSignedDeltaInput(roundMoney2(amt / p)));
      }
    },
    [tradeShares, tradePrice]
  );

  const openAdjustTradeDatePicker = useCallback(() => {
    if (Platform.OS === 'web') return;
    setAdjustTradeDateCalendarOpen(true);
  }, []);

  const headerTitle = useMemo(() => {
    if (!asset) return '';
    if (isListedChineseAsset(asset) || isInternationalListedAsset(asset)) {
      return `${formatExchangeSymbol(
        asset.exchange!,
        asset.symbol!,
        asset.intlQuoteSymbol
      )} · ${asset.name}`;
    }
    return asset.name;
  }, [asset]);

  /** 清仓/零余额后自动归档并进入已归档，不再经总览「已清仓」区与二次确认 */
  const archiveIfHiddenAndGo = useCallback(
    async (persisted: SimpleAsset): Promise<boolean> => {
      if (!isAssetHiddenFromDashboard(persisted)) return false;
      try {
        await archiveAssetRecord(persisted);
        router.replace('/settings-archived');
        return true;
      } catch (e) {
        Alert.alert(
          t('common.failed'),
          e instanceof Error ? e.message : t('common.failed')
        );
        return false;
      }
    },
    [router, t]
  );

  const onSaveListedAdjust = async () => {
    if (!asset || !isHeldChineseAsset(asset)) return;
    const td = adjustTradeDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(td)) {
      Alert.alert(t('asset.form.cannotSave'), t('asset.form.invalidTradeDate'));
      return;
    }
    const signed = parseSignedCashDelta(tradeShares);
    const wantBuy = signed !== null && signed > 0;
    const absShares =
      signed !== null && signed !== 0 ? Math.abs(signed) : null;
    setAdjustSaving(true);
    try {
      const linkId = tradeLinkedCashId.trim();
      const transferId =
        linkId.length > 0
          ? `xf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          : undefined;
      const linkedName = tradeFundingOptions.find((x) => x.id === linkId)?.name;
      const r = tryApplyListedAdjustTrade(asset, {
        tradeDateStr: td,
        sharesStr: tradeShares,
        unitPriceStr: tradePrice,
        fundingSourceAssetId: wantBuy && linkId ? linkId : undefined,
        fundingSourceAssetName:
          wantBuy && linkId ? linkedName : undefined,
        cashDestinationAssetId: !wantBuy && linkId ? linkId : undefined,
        cashDestinationAssetName:
          !wantBuy && linkId ? linkedName : undefined,
        transferId,
      });
      if (!r.ok) {
        Alert.alert(t('asset.form.cannotSave'), r.message);
        return;
      }
      const rawAmount =
        absShares !== null && Number.isFinite(parseFloat(tradePrice))
          ? absShares * parseFloat(tradePrice)
          : NaN;
      if (wantBuy && linkId.length > 0) {
        const all = await getAssets();
        const srcIdx = all.findIndex((a) => a.id === linkId);
        const curIdx = all.findIndex((a) => a.id === asset.id);
        if (srcIdx < 0 || curIdx < 0) {
          Alert.alert(t('asset.form.cannotSave'), t('trade.edit.assetChanged'));
          return;
        }
        const src = all[srcIdx]!;
        const listingCur = getAssetCurrency(asset);
        const conv = await convertListingCostToCnyCashDebit(
          rawAmount,
          listingCur
        );
        if (!conv.ok) {
          Alert.alert(t('asset.form.cannotSave'), conv.message);
          return;
        }
        const amount = conv.cny;
        const note =
          listingCur === 'CNY'
            ? '加仓资金划转'
            : `加仓资金划转（${listingCur} ${rawAmount.toFixed(2)} 折人民币扣款）`;
        let debited: SimpleAsset;
        try {
          debited = appendCashMovement(
            src,
            'out',
            amount,
            td,
            {
              relatedAssetId: asset.id,
              relatedAssetName: asset.name,
              note,
              transferId,
            }
          );
        } catch (e) {
          Alert.alert(
            t('asset.form.cannotSave'),
            e instanceof Error ? e.message : t('asset.form.fundingInsufficient')
          );
          return;
        }
        all[srcIdx] = debited;
        all[curIdx] = r.asset;
        await saveAssets(all);
      } else if (!wantBuy && linkId.length > 0) {
        const all = await getAssets();
        const dstIdx = all.findIndex((a) => a.id === linkId);
        const curIdx = all.findIndex((a) => a.id === asset.id);
        if (dstIdx < 0 || curIdx < 0) {
          Alert.alert(t('asset.form.cannotSave'), t('trade.edit.assetChanged'));
          return;
        }
        const dst = all[dstIdx]!;
        const listingCur = getAssetCurrency(asset);
        const conv = await convertListingCostToCnyCashDebit(
          rawAmount,
          listingCur
        );
        if (!conv.ok) {
          Alert.alert(t('asset.form.cannotSave'), conv.message);
          return;
        }
        const amount = conv.cny;
        const note =
          listingCur === 'CNY'
            ? '减仓资金划转'
            : `减仓资金划转（${listingCur} ${rawAmount.toFixed(2)} 折人民币入账）`;
        const credited = appendCashMovement(
          dst,
          'in',
          amount,
          td,
          {
            relatedAssetId: asset.id,
            relatedAssetName: asset.name,
            note,
            transferId,
          }
        );
        all[dstIdx] = credited;
        all[curIdx] = r.asset;
        await saveAssets(all);
      } else {
        await updateAsset(r.asset);
      }
      if (await archiveIfHiddenAndGo(r.asset)) return;
      setTradeShares('');
      setTradePrice('');
      setTradeAmount('');
      setTradeLinkedCashId('');
      setAdjustTradeDate(getShanghaiDateString());
      await load();
    } finally {
      setAdjustSaving(false);
    }
  };

  const onSaveListedMeta = async () => {
    if (!asset || !isHeldChineseAsset(asset)) return;
    if (asset.category === 'Gold') {
      if (listedMetaCategory !== 'Gold') {
        Alert.alert(t('asset.form.cannotSave'), t('asset.form.pickSge'));
        return;
      }
    } else if (!isListedAssetCategory(listedMetaCategory)) {
      Alert.alert(t('asset.form.cannotSave'), t('asset.form.category'));
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
      if (asset.category === 'Gold' || listedMetaCategory === 'Gold') {
        next.preciousMetalSpot = listedPreciousMetal;
        if (
          goldInstrumentPick?.exchange === 'SGE' &&
          goldInstrumentPick.quoteId
        ) {
          next.emSecid = goldInstrumentPick.quoteId.trim();
          next.symbol = goldInstrumentPick.code.trim();
          next.exchange = 'SGE';
        } else {
          delete next.emSecid;
          delete next.symbol;
          delete next.exchange;
        }
      }
      if (accountTrim.length > 0) next.account = accountTrim;
      else delete next.account;
      if (!('purpose' in pf)) delete next.purpose;
      if (!('purposeTarget' in pf)) delete next.purposeTarget;
      const nextWithFunding = patchBaselineBuyFunding(
        next,
        listedMetaFundingCashId,
        (fid) => tradeFundingOptions.find((a) => a.id === fid)?.name
      );
      await updateAsset(nextWithFunding);
      if (await archiveIfHiddenAndGo(nextWithFunding)) return;
      await load();
      try {
        await syncNetWorthFromMarket();
      } catch {
        /* 忽略 */
      }
      Alert.alert(t('common.success'));
    } finally {
      setListedMetaSaving(false);
    }
  };

  const onSaveCashBalance = async () => {
    if (!asset || !usesCashAmountLedger(asset)) return;
    const cur = getAssetDisplayValue(asset);
    const { delta, error } = resolveCashBalanceDelta(
      cur,
      cashAdjustAmount,
      cashAdjustNewBalance
    );
    if (error) {
      Alert.alert(t('asset.form.cannotSave'), error);
      return;
    }
    if (delta === 0) {
      Alert.alert(t('asset.form.cannotSave'), t('asset.detail.deltaPlaceholder'));
      return;
    }
    setCashAdjustSaving(true);
    try {
      const side = delta > 0 ? 'in' : 'out';
      const amt = Math.abs(delta);
      const next = appendCashMovement(
        asset,
        side,
        amt,
        getShanghaiDateString()
      );
      await updateAsset(next);
      if (await archiveIfHiddenAndGo(next)) return;
      setCashAdjustAmount('');
      setCashAdjustNewBalance('');
      await load();
    } catch (e) {
      Alert.alert(
        t('asset.form.cannotSave'),
        e instanceof Error ? e.message : t('trade.edit.positionMismatch')
      );
    } finally {
      setCashAdjustSaving(false);
    }
  };

  const onSaveCashMeta = async () => {
    if (!asset || !usesCashAmountLedger(asset)) return;
    if (!cashName.trim()) {
      Alert.alert(t('asset.form.cannotSave'), t('asset.form.name'));
      return;
    }
    setCashSaving(true);
    try {
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
      await updateAsset(next);
      if (await archiveIfHiddenAndGo(next)) return;
      await load();
      Alert.alert(t('common.success'));
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
      Alert.alert(t('asset.form.cannotSave'), t('asset.form.currentAmount'));
      return;
    }
    if (!fbName.trim()) {
      Alert.alert(t('asset.form.cannotSave'), t('asset.form.name'));
      return;
    }
    setFbSaving(true);
    try {
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
      await updateAsset(next);
      if (await archiveIfHiddenAndGo(next)) return;
      await load();
      Alert.alert(t('common.success'));
    } finally {
      setFbSaving(false);
    }
  };

  const keyboardOffset = Platform.OS === 'ios' ? insets.top : 0;

  if (!id) {
    return (
      <View style={styles.keyboardRoot}>
        <SettingsHubBackTopBar />
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          <Text style={styles.headerName}>{t('asset.detail.missingId')}</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.keyboardRoot}>
        <SettingsHubBackTopBar />
        <View
          style={{
            flex: 1,
            paddingTop: 24,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={theme.primary} />
        </View>
      </View>
    );
  }

  if (!asset) {
    return (
      <View style={styles.keyboardRoot}>
        <SettingsHubBackTopBar />
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          <Text style={styles.headerName}>{t('asset.detail.notFound')}</Text>
        </View>
      </View>
    );
  }

  const held = isHeldChineseAsset(asset);
  const cashLike = usesCashAmountLedger(asset);
  const useGram = asset.category === 'Gold';
  const quoteCurrency = getAssetCurrency(asset);
  const avgDisp =
    typeof asset.avgCost === 'number' && asset.avgCost > 0
      ? formatListedUnitForDisplay(asset.avgCost, quoteCurrency)
      : '—';
  const closeDisp =
    typeof asset.lastClose === 'number' && asset.lastClose > 0
      ? formatListedUnitForDisplay(asset.lastClose, quoteCurrency)
      : '—';

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardOffset}
    >
      <View style={styles.modalAmbient} pointerEvents="none" />
      <SettingsHubBackTopBar />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 14,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <Text style={[styles.headerName, { marginBottom: 6 }]} numberOfLines={3}>
          {headerTitle}
        </Text>
        <Text style={[styles.headerMeta, { marginBottom: 16 }]}>
          {t('asset.detail.marketValue')}{' '}
          {formatMoney(getAssetDisplayValue(asset), getAssetCurrency(asset))}
        </Text>

        {held ? (
          <>
            <View style={styles.tabRow}>
              {LISTED_TABS.map((tab) => (
                <Pressable
                  key={tab.id}
                  accessibilityRole="button"
                  onPress={() => setListedPanel(tab.id)}
                  style={({ pressed }) => [
                    styles.tabChip,
                    listedPanel === tab.id && styles.tabChipActive,
                    pressed && styles.tabChipPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabChipText,
                      listedPanel === tab.id && styles.tabChipTextActive,
                    ]}
                  >
                    {tab.id === 'adjust'
                      ? t('asset.detail.adjustPosition')
                      : t('asset.detail.editInfo')}
                  </Text>
                </Pressable>
              ))}
            </View>

            {listedPanel === 'adjust' ? (
              <GlassSurface
                borderRadius={36}
                intensity={54}
                variant="editorial"
                contentStyle={styles.glassFormInner}
              >
                  <FormRow
                    first
                    styles={styles}
                    iconMuted={iconMuted}
                    icon="calendar-outline"
                    label={t('asset.form.tradeDate')}
                    right={
                      Platform.OS !== 'web' ? (
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={iconMuted}
                        />
                      ) : undefined
                    }
                  >
                    {Platform.OS === 'web' ? (
                      <YmdDateFields
                        value={adjustTradeDate}
                        onChangeText={setAdjustTradeDate}
                        placeholderColor={placeholderColor}
                        inputStyle={styles.input}
                        labelColor={rgbaFromHex(theme.primary, 0.62)}
                      />
                    ) : (
                      <Pressable
                        onPress={openAdjustTradeDatePicker}
                        style={styles.formRowValuePressable}
                        accessibilityRole="button"
                        accessibilityLabel={t('asset.form.pickTradeDate')}
                      >
                        <Text style={styles.formRowValue}>
                          {formatYmdForLocale(adjustTradeDate, locale)}
                        </Text>
                      </Pressable>
                    )}
                  </FormRow>
                  <FormRow
                    styles={styles}
                    iconMuted={iconMuted}
                    icon={useGram ? 'fitness-outline' : 'pie-chart-outline'}
                    label={
                      useGram
                        ? t('asset.detail.weightChange')
                        : t('asset.detail.sharesChange')
                    }
                  >
                    <TextInput
                      placeholder={
                        useGram
                          ? t('asset.detail.weightChangePlaceholder')
                          : t('asset.detail.sharesChangePlaceholder')
                      }
                      placeholderTextColor={placeholderColor}
                      style={styles.input}
                      value={tradeShares}
                      onChangeText={onTradeSharesChange}
                      keyboardType={
                        Platform.OS === 'ios'
                          ? 'numbers-and-punctuation'
                          : 'default'
                      }
                    />
                  </FormRow>
                  <FormRow
                    styles={styles}
                    iconMuted={iconMuted}
                    icon="pricetag-outline"
                    label={t('asset.detail.tradeUnitPrice', {
                      currency: getAssetCurrency(asset),
                      unit: useGram ? t('dashboard.gramUnit') : t('dashboard.shareUnit'),
                    })}
                  >
                    <TextInput
                      placeholder={
                        t('asset.detail.tradeUnitPricePlaceholder', {
                          unit: useGram
                            ? t('dashboard.gramUnit')
                            : t('dashboard.shareUnit'),
                        })
                      }
                      placeholderTextColor={placeholderColor}
                      style={styles.input}
                      value={tradePrice}
                      onChangeText={onTradePriceChange}
                      keyboardType="decimal-pad"
                    />
                  </FormRow>
                  {adjustQuoteLoading ? (
                    <View style={styles.suggestLoadingRow}>
                      <ActivityIndicator
                        size="small"
                        color={theme.primary}
                      />
                      <Text style={styles.suggestLoadingText}>
                        {t('asset.form.syncReference')}
                      </Text>
                    </View>
                  ) : adjustQuoteHint ? (
                    <Text style={styles.hint}>
                      {t('asset.form.reference', { hint: adjustQuoteHint })}
                    </Text>
                  ) : null}
                  <FormRow
                    styles={styles}
                    iconMuted={iconMuted}
                    icon="calculator-outline"
                    label={t('asset.detail.tradeAmount')}
                  >
                    <TextInput
                      placeholder={t('asset.detail.tradeAmountPlaceholder')}
                      placeholderTextColor={placeholderColor}
                      style={styles.input}
                      value={tradeAmount}
                      onChangeText={onTradeAmountChange}
                      keyboardType="decimal-pad"
                    />
                  </FormRow>
                  <View style={[styles.formRow, { zIndex: 25 }]}>
                    <View style={styles.formRowIconColumn}>
                      <View style={styles.formRowIconLabelSpacer} />
                      <View style={styles.formRowIconWrap}>
                        <Ionicons
                          name="wallet-outline"
                          size={18}
                          color={iconMuted}
                        />
                      </View>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.formRowLabel}>
                        {t('asset.detail.fundingAccount')}
                      </Text>
                      <FundingSourcePicker
                        label={t('asset.detail.fundingAccount')}
                        emptyOptionLabel={t('asset.detail.noCashLink')}
                        valueId={tradeLinkedCashId}
                        onSelectId={setTradeLinkedCashId}
                        fundingOptions={tradeFundingOptions}
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
                  <Pressable
                    style={[
                      styles.saveButton,
                      adjustSaving && styles.saveButtonDisabled,
                    ]}
                    onPress={() => void onSaveListedAdjust()}
                    disabled={adjustSaving}
                  >
                    <Text style={styles.saveButtonText}>
                      {adjustSaving ? t('asset.form.saving') : t('asset.detail.saveAdjust')}
                    </Text>
                  </Pressable>

                  <View
                    style={[styles.tradeDetailSection, { marginTop: 22 }]}
                  >
                    <View style={styles.tradeDetailTitleRow}>
                      <Text style={styles.tradeDetailTitle}>
                        {t('asset.detail.tradeDetails')}
                      </Text>
                      <View style={styles.tradeDetailTitleActions}>
                        <Ionicons
                          name="reorder-three-outline"
                          size={22}
                          color={theme.primary}
                        />
                        <Ionicons
                          name="options-outline"
                          size={20}
                          color={iconMuted}
                        />
                      </View>
                    </View>
                    {trades.length === 0 ? (
                      <Text style={[styles.hintMuted, { marginTop: 10 }]}>
                        {t('asset.detail.noRecords')}
                      </Text>
                    ) : (
                      <>
                        <ScrollView
                          horizontal
                          nestedScrollEnabled
                          showsHorizontalScrollIndicator={false}
                          style={styles.tradeTableScroll}
                        >
                          <View style={styles.tradeTableInner}>
                            <View style={styles.tradeTableHeader}>
                              <View style={styles.tradeTypeCol}>
                                <Text style={styles.tradeTh}>{t('asset.detail.type')}</Text>
                              </View>
                              <View style={styles.tradeQtyCol}>
                                <Text style={styles.tradeTh}>{t('asset.detail.quantity')}</Text>
                              </View>
                              <View style={styles.tradePriceCol}>
                                <Text style={styles.tradeTh}>{t('asset.detail.price')}</Text>
                              </View>
                              <View
                                style={[
                                  styles.tradeFundCol,
                                  { alignItems: 'flex-end' },
                                ]}
                              >
                                <Text style={styles.tradeTh}>{t('asset.detail.fundingSource')}</Text>
                              </View>
                              <View style={styles.tradePnlCol}>
                                <Text style={styles.tradeTh}>{t('asset.detail.realizedPnl')}</Text>
                              </View>
                            </View>
                            {trades.map((tradeRow, rowIdx) => {
                              const isBuy = tradeRow.side === 'buy';
                              const fundLabel = isBuy
                                ? tradeRow.fundingSourceAssetName?.trim() || '—'
                                : tradeRow.cashDestinationAssetName?.trim() || '—';
                              const pl =
                                tradeRow.side === 'sell'
                                  ? sellRealizedById.get(tradeRow.id)
                                  : undefined;
                              const showPnl =
                                tradeRow.side === 'sell' &&
                                pl !== undefined &&
                                Number.isFinite(pl);
                              const plColor = showPnl
                                ? pl >= 0
                                  ? FINANCE_DOWN
                                  : FINANCE_UP
                                : muted;
                              const plText = showPnl
                                ? pl > 0
                                  ? `+${formatMoney(pl, quoteCurrency)}`
                                  : formatMoney(pl, quoteCurrency)
                                : '—';
                              return (
                                <Pressable
                                  key={tradeRow.id}
                                  style={({ pressed }) => [
                                    styles.tradeTableRow,
                                    rowIdx % 2 === 1 && styles.tradeTableRowAlt,
                                    pressed &&
                                      !tradesAreSynthetic && {
                                        opacity: 0.88,
                                      },
                                  ]}
                                  disabled={tradesAreSynthetic}
                                  onPress={() => {
                                    if (tradesAreSynthetic) return;
                                    router.push({
                                      pathname: '/trade-edit',
                                      params: {
                                        assetId: asset.id,
                                        tradeId: tradeRow.id,
                                      },
                                    });
                                  }}
                                >
                                  <View style={styles.tradeTypeCol}>
                                    <View style={styles.tradeIconCircle}>
                                      <Ionicons
                                        name={
                                          isBuy ? 'arrow-down' : 'arrow-up'
                                        }
                                        size={16}
                                        color="#FFFFFF"
                                      />
                                    </View>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                      <Text
                                        style={[
                                          styles.tradeTypeLabel,
                                          {
                                            color: isBuy
                                              ? FINANCE_DOWN
                                              : FINANCE_UP,
                                          },
                                        ]}
                                        numberOfLines={1}
                                      >
                                        {isBuy ? t('asset.detail.buy') : t('asset.detail.sell')}
                                      </Text>
                                      <Text
                                        style={styles.tradeTypeDate}
                                        numberOfLines={1}
                                      >
                                        {tradeRow.tradeDate}
                                      </Text>
                                    </View>
                                  </View>
                                  <View style={styles.tradeQtyCol}>
                                    <Text
                                      style={styles.tradeTdNum}
                                      numberOfLines={1}
                                      adjustsFontSizeToFit
                                      minimumFontScale={0.55}
                                    >
                                      {String(tradeRow.shares)}
                                    </Text>
                                  </View>
                                  <View style={styles.tradePriceCol}>
                                    <Text
                                      style={styles.tradeTdPrice}
                                      numberOfLines={1}
                                      adjustsFontSizeToFit
                                      minimumFontScale={0.55}
                                    >
                                      {formatMoney(
                                        tradeRow.unitPriceCny,
                                        quoteCurrency
                                      )}
                                    </Text>
                                  </View>
                                  <View
                                    style={[
                                      styles.tradeFundCol,
                                      { alignItems: 'flex-end' },
                                    ]}
                                  >
                                    <Text
                                      style={styles.tradeTdFund}
                                      numberOfLines={1}
                                    >
                                      {fundLabel}
                                    </Text>
                                  </View>
                                  <View style={styles.tradePnlCol}>
                                    <Text
                                      style={[
                                        styles.tradeTdPnl,
                                        { color: plColor },
                                      ]}
                                    >
                                      {plText}
                                    </Text>
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>
                        </ScrollView>
                        {!tradesAreSynthetic ? (
                          <Text style={styles.tradeEditHint}>
                            {t('asset.detail.tapRowEdit')}
                          </Text>
                        ) : null}
                      </>
                    )}
                  </View>
              </GlassSurface>
            ) : (
              <GlassSurface
                borderRadius={36}
                intensity={54}
                variant="editorial"
                style={{ overflow: 'visible' }}
                contentStyle={styles.glassFormInner}
              >
                  <View style={[styles.headerCard, { marginBottom: 16 }]}>
                    <Text style={styles.headerName}>{asset.name}</Text>
                    <Text style={[styles.headerMeta, { marginTop: 6 }]}>
                      {t('asset.detail.currentHolding', {
                        qty: asset.shares ?? 0,
                        unit: useGram ? t('dashboard.gramUnit') : t('dashboard.shareUnit'),
                        avgCost: avgDisp,
                        close: closeDisp,
                      })}
                    </Text>
                  </View>

                  <View style={styles.categoryRowWrap}>
                    <View style={styles.formRowIconColumn}>
                      <View style={styles.formRowIconLabelSpacer} />
                      <View style={styles.formRowIconWrap}>
                        <Ionicons
                          name="grid-outline"
                          size={20}
                          color={iconMuted}
                        />
                      </View>
                    </View>
                    <View style={styles.categoryChipsWrap}>
                      <Text style={styles.formRowLabel}>{t('asset.form.category')}</Text>
                      <View style={styles.categoryRowOneLine}>
                        {(useGram ? (['Gold'] as const) : LISTED_EDIT_CATEGORIES).map(
                          (opt) => (
                            <Pressable
                              key={opt}
                              style={[
                                styles.optionMini,
                                listedMetaCategory === opt &&
                                  styles.optionSelected,
                              ]}
                              onPress={() => setListedMetaCategory(opt)}
                            >
                              <Text
                                style={[
                                  styles.optionTextMini,
                                  listedMetaCategory === opt &&
                                    styles.optionTextSelected,
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.88}
                              >
                                {t(`asset.category.${opt}` as TranslationKey)}
                              </Text>
                            </Pressable>
                          )
                        )}
                      </View>
                    </View>
                  </View>

                  {useGram ? (
                    <View style={styles.categoryRowWrap}>
                      <View style={styles.formRowIconColumn}>
                        <View style={styles.formRowIconLabelSpacer} />
                        <View style={styles.formRowIconWrap}>
                          <Ionicons
                            name="diamond-outline"
                            size={20}
                            color={iconMuted}
                          />
                        </View>
                      </View>
                      <View style={styles.categoryChipsWrap}>
                        <Text style={styles.formRowLabel}>{t('asset.form.preciousMetalKind')}</Text>
                        <View style={[styles.categoryRowOneLine, { flexWrap: 'wrap' }]}>
                          {PRECIOUS_METAL_SPOT_ORDER.map((spot) => (
                            <Pressable
                              key={spot}
                              style={[
                                styles.optionMini,
                                listedPreciousMetal === spot &&
                                  styles.optionSelected,
                              ]}
                              onPress={() => setListedPreciousMetal(spot)}
                            >
                              <Text
                                style={[
                                  styles.optionTextMini,
                                  listedPreciousMetal === spot &&
                                    styles.optionTextSelected,
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
                              >
                                {t(`asset.precious.${spot}` as TranslationKey)}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    </View>
                  ) : null}

                  {useGram ? (
                    <>
                      <View style={styles.categoryBlock}>
                        <View style={styles.formRowIconColumn}>
                          <View style={styles.formRowIconLabelSpacer} />
                          <View style={styles.formRowIconWrap}>
                            <Ionicons
                              name="search-outline"
                              size={18}
                              color={iconMuted}
                            />
                          </View>
                        </View>
                        <View style={styles.categoryChipsWrap}>
                          <Text style={styles.formRowLabel}>
                            {t('asset.form.sgeCode')}
                          </Text>
                          <TextInput
                            placeholder={t('asset.form.sgePlaceholder')}
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
                          <ActivityIndicator
                            size="small"
                            color={theme.primary}
                          />
                          <Text style={styles.suggestLoadingText}>
                            {t('asset.form.searching')}
                          </Text>
                        </View>
                      )}
                      {!goldSuggestLoading && goldSuggestions.length > 0 && (
                        <View style={styles.suggestBox}>
                          <ScrollView
                            nestedScrollEnabled
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator
                            style={styles.suggestScroll}
                          >
                            {goldSuggestions.map((item) => (
                              <Pressable
                                key={`${item.exchange}-${item.code}-${
                                  item.quoteId ?? ''
                                }`}
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
                          </ScrollView>
                        </View>
                      )}
                      {!goldSuggestLoading &&
                        goldSearchText.trim().length > 0 &&
                        goldSuggestions.length === 0 && (
                          <Text style={styles.suggestEmpty}>
                            {t('asset.form.noMatches')}
                          </Text>
                        )}
                      {goldInstrumentPick?.exchange === 'SGE' && (
                        <View style={styles.selectedCard}>
                          <Text style={styles.selectedLabel}>
                            {t('asset.form.selectedInstrument')}
                          </Text>
                          <Text style={styles.selectedMain}>
                            {formatExchangeSymbol(
                              'SGE',
                              goldInstrumentPick.code
                            )}{' '}
                            · {goldInstrumentPick.name}
                          </Text>
                          <Pressable
                            onPress={() => {
                              setGoldInstrumentPick(null);
                              setGoldSearchText('');
                            }}
                          >
                            <Text style={styles.changeLink}>{t('asset.form.clear')}</Text>
                          </Pressable>
                        </View>
                      )}
                    </>
                  ) : null}

                  <FormRow
                    styles={styles}
                    iconMuted={iconMuted}
                    icon="folder-outline"
                    label={t('asset.form.accountOptional')}
                  >
                    <TextInput
                      placeholder={t('asset.form.accountPlaceholder')}
                      placeholderTextColor={placeholderColor}
                      style={styles.input}
                      value={listedMetaAccount}
                      onChangeText={setListedMetaAccount}
                    />
                  </FormRow>

                  <View style={[styles.formRow, { zIndex: 24 }]}>
                    <View style={styles.formRowIconColumn}>
                      <View style={styles.formRowIconLabelSpacer} />
                      <View style={styles.formRowIconWrap}>
                        <Ionicons
                          name="wallet-outline"
                          size={18}
                          color={iconMuted}
                        />
                      </View>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.formRowLabel}>
                        {t('asset.detail.fundingAccount')}
                      </Text>
                      <FundingSourcePicker
                        label={t('asset.detail.fundingAccount')}
                        emptyOptionLabel={t('asset.detail.noCashLink')}
                        valueId={listedMetaFundingCashId}
                        onSelectId={setListedMetaFundingCashId}
                        fundingOptions={tradeFundingOptions}
                        styles={styles}
                        omitLabel
                        mode="inline"
                        menuKey="fundMeta"
                        openKey={menuOpen}
                        setOpenKey={setMenuOpen}
                        primaryColor={theme.primary}
                        mutedColor={iconMuted}
                      />
                    </View>
                  </View>

                  <Pressable
                    style={styles.purposeSectionHeader}
                    onPress={() =>
                      setListedMetaPurposeExpanded((e) => !e)
                    }
                  >
                    <Text style={styles.purposeSectionTitle}>
                      {t('asset.form.moreOptions')}
                    </Text>
                    <Text style={styles.purposeCaret}>
                      {listedMetaPurposeExpanded ? '▲' : '▼'}
                    </Text>
                  </Pressable>
                  {listedMetaPurposeExpanded ? (
                    <View style={styles.purposeSectionBody}>
                      <FormRow
                        styles={styles}
                        iconMuted={iconMuted}
                        icon="document-text-outline"
                        label={t('asset.form.purpose')}
                      >
                        <TextInput
                          placeholder={t('asset.form.purposePlaceholder')}
                          placeholderTextColor={placeholderColor}
                          style={styles.input}
                          value={listedMetaPurpose}
                          onChangeText={setListedMetaPurpose}
                        />
                      </FormRow>
                      <FormRow
                        styles={styles}
                        iconMuted={iconMuted}
                        icon="flag-outline"
                        label={t('asset.form.targetPlaceholder')}
                      >
                        <TextInput
                          placeholder={t('asset.form.targetPlaceholder')}
                          placeholderTextColor={placeholderColor}
                          style={styles.input}
                          value={listedMetaPurposeTarget}
                          onChangeText={setListedMetaPurposeTarget}
                          keyboardType="decimal-pad"
                        />
                      </FormRow>
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
                      {listedMetaSaving ? t('asset.form.saving') : t('asset.detail.saveEdit')}
                    </Text>
                  </Pressable>
            </GlassSurface>
            )}
          </>
        ) : cashLike ? (
          <>
            <View style={styles.tabRow}>
              {CASH_TABS.map((tab) => (
                <Pressable
                  key={tab.id}
                  accessibilityRole="button"
                  onPress={() => setCashPanel(tab.id)}
                  style={({ pressed }) => [
                    styles.tabChip,
                    cashPanel === tab.id && styles.tabChipActive,
                    pressed && styles.tabChipPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabChipText,
                      cashPanel === tab.id && styles.tabChipTextActive,
                    ]}
                  >
                    {tab.id === 'balance'
                      ? t('asset.detail.adjustBalance')
                      : t('asset.detail.editInfo')}
                  </Text>
                </Pressable>
              ))}
            </View>

            {cashPanel === 'balance' ? (
              <GlassSurface
                borderRadius={36}
                intensity={54}
                variant="editorial"
                contentStyle={styles.glassFormInner}
              >
                  <FormRow
                    first
                    styles={styles}
                    iconMuted={iconMuted}
                    icon="wallet-outline"
                    label={t('asset.detail.currentBalance')}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: theme.primary,
                      }}
                    >
                      {formatMoney(cashCurrentBalance, getAssetCurrency(asset))}
                    </Text>
                  </FormRow>
                  <FormRow
                    styles={styles}
                    iconMuted={iconMuted}
                    icon="trending-up-outline"
                    label={t('asset.detail.deltaAmount', {
                      symbol: assetCurrencySymbol(cashCurrency),
                    })}
                  >
                    <TextInput
                      style={styles.input}
                      value={cashAdjustAmount}
                      onChangeText={onCashDeltaChange}
                      keyboardType={
                        Platform.OS === 'ios'
                          ? 'numbers-and-punctuation'
                          : 'default'
                      }
                      placeholderTextColor={placeholderColor}
                      placeholder={t('asset.detail.deltaPlaceholder')}
                    />
                  </FormRow>
                  <FormRow
                    styles={styles}
                    iconMuted={iconMuted}
                    icon="calculator-outline"
                    label={t('asset.detail.updatedBalance', {
                      symbol: assetCurrencySymbol(cashCurrency),
                    })}
                  >
                    <TextInput
                      style={styles.input}
                      value={cashAdjustNewBalance}
                      onChangeText={onCashNewBalanceChange}
                      keyboardType="decimal-pad"
                      placeholderTextColor={placeholderColor}
                      placeholder={t('asset.detail.updatedBalancePlaceholder')}
                    />
                  </FormRow>
                  <Pressable
                    style={[
                      styles.saveButton,
                      cashAdjustSaving && styles.saveButtonDisabled,
                    ]}
                    onPress={() => void onSaveCashBalance()}
                    disabled={cashAdjustSaving}
                  >
                    <Text style={styles.saveButtonText}>
                      {cashAdjustSaving ? t('asset.form.saving') : t('asset.detail.saveBalance')}
                    </Text>
                  </Pressable>

                  <View style={[styles.tradeDetailSection, { marginTop: 18 }]}>
                    <View style={styles.tradeDetailTitleRow}>
                      <Text style={styles.tradeDetailTitle}>
                        {t('asset.detail.balanceLedger')}
                      </Text>
                      <View style={styles.tradeDetailTitleActions}>
                        <Ionicons
                          name="reorder-three-outline"
                          size={22}
                          color={theme.primary}
                        />
                        <Ionicons
                          name="options-outline"
                          size={20}
                          color={iconMuted}
                        />
                      </View>
                    </View>
                    {cashRows.length === 0 ? (
                      <Text style={[styles.hintMuted, { marginTop: 10 }]}>
                        {t('asset.detail.noRecords')}
                      </Text>
                    ) : (
                      <>
                        <View style={styles.cashLedgerTableOuter}>
                          <View style={styles.cashLedgerTableInner}>
                            <View style={styles.tradeTableHeader}>
                              <View style={styles.cashLedgerTypeCol}>
                                <Text
                                  style={[styles.tradeTh, styles.cashLedgerThCenter]}
                                >
                                  {t('asset.detail.type')}
                                </Text>
                              </View>
                              <View style={styles.cashLedgerAmountCol}>
                                <Text
                                  style={[styles.tradeTh, styles.cashLedgerThCenter]}
                                >
                                  {t('asset.detail.deltaAmount', { symbol: assetCurrencySymbol(cashCurrency) })}
                                </Text>
                              </View>
                              <View style={styles.cashLedgerRelatedCol}>
                                <Text
                                  style={[styles.tradeTh, styles.cashLedgerThCenter]}
                                  numberOfLines={1}
                                >
                                  {t('asset.detail.fundingSource')}
                                </Text>
                              </View>
                            </View>
                            {cashRows.map((row, rowIdx) => {
                              const isIn = row.side === 'in';
                              const cur = getAssetCurrency(asset);
                              const amtColor = isIn ? FINANCE_UP : FINANCE_DOWN;
                              const amtText = isIn
                                ? `+${formatMoney(row.amount, cur)}`
                                : `-${formatMoney(row.amount, cur)}`;
                              const rel =
                                row.relatedAssetName?.trim() || '—';
                              return (
                                <Pressable
                                  key={row.id}
                                  style={({ pressed }) => [
                                    styles.tradeTableRow,
                                    rowIdx % 2 === 1 && styles.tradeTableRowAlt,
                                    pressed &&
                                      !cashRowsSynthetic && {
                                        opacity: 0.88,
                                      },
                                  ]}
                                  disabled={cashRowsSynthetic}
                                  onPress={() => {
                                    if (cashRowsSynthetic) return;
                                    router.push({
                                      pathname: '/cash-ledger-edit',
                                      params: {
                                        assetId: asset.id,
                                        entryId: row.id,
                                      },
                                    });
                                  }}
                                >
                                  <View style={styles.cashLedgerTypeCol}>
                                    <View
                                      style={
                                        isIn
                                          ? styles.cashLedgerIconCircleIn
                                          : styles.cashLedgerIconCircleOut
                                      }
                                    >
                                      <Ionicons
                                        name={isIn ? 'arrow-down' : 'arrow-up'}
                                        size={16}
                                        color="#FFFFFF"
                                      />
                                    </View>
                                    <View style={{ alignItems: 'center' }}>
                                      <Text
                                        style={[
                                          styles.tradeTypeLabel,
                                          { color: amtColor, textAlign: 'center' },
                                        ]}
                                        numberOfLines={1}
                                      >
                                        {isIn ? t('asset.detail.increase') : t('asset.detail.decrease')}
                                      </Text>
                                      <Text
                                        style={[
                                          styles.tradeTypeDate,
                                          { textAlign: 'center' },
                                        ]}
                                        numberOfLines={1}
                                      >
                                        {row.entryDate}
                                      </Text>
                                    </View>
                                  </View>
                                  <View style={styles.cashLedgerAmountCol}>
                                    <Text
                                      style={[
                                        styles.cashLedgerTdAmount,
                                        { color: amtColor },
                                      ]}
                                      numberOfLines={1}
                                      adjustsFontSizeToFit
                                      minimumFontScale={0.65}
                                    >
                                      {amtText}
                                    </Text>
                                  </View>
                                  <View style={styles.cashLedgerRelatedCol}>
                                    <Text
                                      style={styles.cashLedgerTdRelated}
                                      numberOfLines={2}
                                    >
                                      {rel}
                                    </Text>
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                        {!cashRowsSynthetic ? (
                          <Text style={styles.tradeEditHint}>
                            {t('asset.detail.tapRowEdit')}
                          </Text>
                        ) : null}
                      </>
                    )}
                  </View>
            </GlassSurface>
            ) : (
              <GlassSurface
                borderRadius={36}
                intensity={54}
                variant="editorial"
                contentStyle={styles.glassFormInner}
              >
                  <FormRow
                    first
                    styles={styles}
                    iconMuted={iconMuted}
                    icon="albums-outline"
                    label={t('asset.form.name')}
                  >
                    <TextInput
                      style={styles.input}
                      value={cashName}
                      onChangeText={setCashName}
                      placeholder={
                        cashCategory === 'Custom'
                          ? t('asset.form.namePlaceholderListed')
                          : t('asset.form.namePlaceholderCash')
                      }
                      placeholderTextColor={placeholderColor}
                    />
                  </FormRow>
                  <FormRow
                    styles={styles}
                    iconMuted={iconMuted}
                    icon="cash-outline"
                    label={t('asset.form.currency')}
                  >
                    <Pressable
                      style={[styles.currencyChip, { alignSelf: 'flex-start' }]}
                      onPress={() => setCashCurrencyModalVisible(true)}
                    >
                      <Text style={styles.currencyChipText}>
                        {assetCurrencySymbol(cashCurrency)}
                      </Text>
                      <Text style={styles.currencyChevron}>▼</Text>
                    </Pressable>
                  </FormRow>
                  <View style={styles.categoryRowWrap}>
                    <View style={styles.formRowIconColumn}>
                      <View style={styles.formRowIconLabelSpacer} />
                      <View style={styles.formRowIconWrap}>
                        <Ionicons
                          name="grid-outline"
                          size={20}
                          color={iconMuted}
                        />
                      </View>
                    </View>
                    <View style={styles.categoryChipsWrap}>
                      <Text style={styles.formRowLabel}>{t('asset.form.category')}</Text>
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
                                  cashCategory === opt && styles.optionSelected,
                                ]}
                                onPress={() => setCashCategory(opt)}
                              >
                                <Text
                                  style={[
                                    styles.optionTextMini,
                                    cashCategory === opt &&
                                      styles.optionTextSelected,
                                  ]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.88}
                                >
                                  {t(`asset.category.${opt}` as TranslationKey)}
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
                    icon="folder-outline"
                    label={t('asset.form.accountOptional')}
                  >
                    <TextInput
                      style={styles.input}
                      value={cashAccount}
                      onChangeText={setCashAccount}
                      placeholderTextColor={placeholderColor}
                    />
                  </FormRow>
                  <Pressable
                    style={styles.purposeSectionHeader}
                    onPress={() => setCashPurposeExpanded((e) => !e)}
                  >
                    <Text style={styles.purposeSectionTitle}>
                      {t('asset.form.moreOptions')}
                    </Text>
                    <Text style={styles.purposeCaret}>
                      {cashPurposeExpanded ? '▲' : '▼'}
                    </Text>
                  </Pressable>
                  {cashPurposeExpanded ? (
                    <View style={styles.purposeSectionBody}>
                      <FormRow
                        styles={styles}
                        iconMuted={iconMuted}
                        icon="document-text-outline"
                        label={t('asset.form.purpose')}
                      >
                        <TextInput
                          style={styles.input}
                          value={cashPurpose}
                          onChangeText={setCashPurpose}
                          placeholderTextColor={placeholderColor}
                        />
                      </FormRow>
                      <FormRow
                        styles={styles}
                        iconMuted={iconMuted}
                        icon="flag-outline"
                        label={t('asset.form.targetAmount', {
                          symbol: assetCurrencySymbol(cashCurrency),
                        })}
                      >
                        <TextInput
                          style={styles.input}
                          value={cashPurposeTarget}
                          onChangeText={setCashPurposeTarget}
                          keyboardType="decimal-pad"
                          placeholderTextColor={placeholderColor}
                        />
                      </FormRow>
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
                      {cashSaving ? t('asset.form.saving') : t('asset.detail.saveEdit')}
                    </Text>
                  </Pressable>
            </GlassSurface>
            )}
          </>
        ) : (
          <GlassSurface
            borderRadius={36}
            intensity={54}
            variant="editorial"
            contentStyle={styles.glassFormInner}
          >
              <FormRow
                first
                styles={styles}
                iconMuted={iconMuted}
                icon="albums-outline"
                label={t('asset.form.name')}
              >
                <TextInput
                  style={styles.input}
                  value={fbName}
                  onChangeText={setFbName}
                  placeholder={
                    fbCategory === 'Custom'
                      ? t('asset.form.namePlaceholderListed')
                      : t('asset.form.namePlaceholderCash')
                  }
                  placeholderTextColor={placeholderColor}
                />
              </FormRow>
              <FormRow
                styles={styles}
                iconMuted={iconMuted}
                icon="cash-outline"
                label={t('asset.form.currentAmount')}
              >
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
              </FormRow>
              <View style={styles.categoryRowWrap}>
                <View style={styles.formRowIconColumn}>
                  <View style={styles.formRowIconLabelSpacer} />
                  <View style={styles.formRowIconWrap}>
                    <Ionicons name="grid-outline" size={20} color={iconMuted} />
                  </View>
                </View>
                <View style={styles.categoryChipsWrap}>
                  <Text style={styles.formRowLabel}>{t('asset.form.category')}</Text>
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
                              fbCategory === opt && styles.optionSelected,
                            ]}
                            onPress={() => setFbCategory(opt)}
                          >
                            <Text
                              style={[
                                styles.optionTextMini,
                                fbCategory === opt && styles.optionTextSelected,
                              ]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.88}
                            >
                              {t(`asset.category.${opt}` as TranslationKey)}
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
                icon="folder-outline"
                label={t('asset.form.accountOptional')}
              >
                <TextInput
                  style={styles.input}
                  value={fbAccount}
                  onChangeText={setFbAccount}
                  placeholderTextColor={placeholderColor}
                />
              </FormRow>
              <Pressable
                style={styles.purposeSectionHeader}
                onPress={() => setFbPurposeExpanded((e) => !e)}
              >
                <Text style={styles.purposeSectionTitle}>{t('asset.form.moreOptions')}</Text>
                <Text style={styles.purposeCaret}>
                  {fbPurposeExpanded ? '▲' : '▼'}
                </Text>
              </Pressable>
              {fbPurposeExpanded ? (
                <View style={styles.purposeSectionBody}>
                  <FormRow
                    styles={styles}
                    iconMuted={iconMuted}
                    icon="document-text-outline"
                    label={t('asset.form.purpose')}
                  >
                    <TextInput
                      style={styles.input}
                      value={fbPurpose}
                      onChangeText={setFbPurpose}
                      placeholderTextColor={placeholderColor}
                    />
                  </FormRow>
                  <FormRow
                    styles={styles}
                    iconMuted={iconMuted}
                    icon="flag-outline"
                    label={t('asset.form.targetPlaceholder')}
                  >
                    <TextInput
                      style={styles.input}
                      value={fbPurposeTarget}
                      onChangeText={setFbPurposeTarget}
                      keyboardType="decimal-pad"
                      placeholderTextColor={placeholderColor}
                    />
                  </FormRow>
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
                  {fbSaving ? t('asset.form.saving') : t('common.save')}
                </Text>
              </Pressable>
          </GlassSurface>
        )}

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
            <Text style={styles.currencyModalTitle}>{t('asset.form.currency')}</Text>
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
              <Text style={styles.currencyModalCancelText}>{t('common.cancel')}</Text>
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
            <Text style={styles.currencyModalTitle}>{t('asset.form.currency')}</Text>
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
              <Text style={styles.currencyModalCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {Platform.OS !== 'web' ? (
        <TradingDateCalendarModal
          visible={adjustTradeDateCalendarOpen}
          onClose={() => setAdjustTradeDateCalendarOpen(false)}
          value={adjustTradeDate}
          onSelect={setAdjustTradeDate}
          themePrimary={theme.primary}
          maxDate={getShanghaiDateString()}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
