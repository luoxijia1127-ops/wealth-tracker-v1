/**
 * 净值变动归因：收益日历 + 按日明细（从设置网格进入）。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { getAssetDailySnapshots } from '@/lib/asset-daily-snapshots';
import { getAssets } from '@/lib/asset-storage';
import { rgbaFromHex } from '@/lib/color-utils';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import {
  FINANCE_DOWN,
  FINANCE_UP,
  financeDeltaColor,
} from '@/lib/finance-colors';
import {
  createFxRatesResolver,
  getCachedFxUsdRates,
  getFxUsdRatesHistory,
} from '@/lib/fx-rates';
import { getSnapshots } from '@/lib/snapshots';
import {
  buildDailyTradeSummaries,
  filterInternalTradeLines,
  filterTradeLinesForDisplay,
  isSignificantTradeSummaryDay,
  type DailyTradeLine,
  type DailyTradeSummary,
} from '@/lib/trade-summary';
import { CATEGORY_LABEL_ZH } from '@/types/asset';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function fmtMoney(n: number): string {
  const r = Math.round(n);
  const sign = r > 0 ? '+' : '';
  return `${sign}¥${Math.abs(r).toLocaleString()}`;
}

/** 日历格内紧凑展示（无货币符号；四舍五入到整数） */
function formatCellCny(diff: number): string {
  const r = Math.round(diff);
  if (r === 0) return '0';
  const abs = Math.abs(r);
  const s = abs.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return r > 0 ? `+${s}` : `-${s}`;
}

function fmtPct(p: number): string {
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(2)}%`;
}

function deltaColor(v: number, themeMuted: string): string {
  return financeDeltaColor(v, themeMuted);
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 当月日历格：null 为占位，数字为日 */
function monthCells(year: number, month: number): (number | null)[] {
  const first = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const startPad = first.getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** 拆成每周一行，保证每行恰 7 格（与星期标题对齐） */
function chunkCalendarWeeks(cells: (number | null)[]): (number | null)[][] {
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

/** 七列等宽：flexBasis 为 0 时按 flex 均分，避免内容撑开列宽导致行间错列 */
const CAL_COL_BASE: ViewStyle = {
  flex: 1,
  flexBasis: 0,
  minWidth: 0,
};

function renderTradeLine(
  x: DailyTradeLine,
  idx: number,
  themePrimary: string
): ReactNode {
  if (x.kind === 'trade') {
    const side = x.side === 'buy' ? '买' : '卖';
    const sColor = x.side === 'buy' ? FINANCE_UP : FINANCE_DOWN;
    return (
      <Text
        key={`t-${idx}-${x.assetId}`}
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: rgbaFromHex(themePrimary, 0.72),
          lineHeight: 18,
        }}
      >
        <Text style={{ color: sColor, fontWeight: '800' }}>{side}</Text> {x.assetName} ·{' '}
        {fmtMoney(x.side === 'buy' ? -x.amountCny : x.amountCny)}
      </Text>
    );
  }
  const side = x.side === 'in' ? '增' : '减';
  const sColor = x.side === 'in' ? FINANCE_UP : FINANCE_DOWN;
  return (
    <Text
      key={`c-${idx}-${x.assetId}`}
      style={{
        fontSize: 12,
        fontWeight: '600',
        color: rgbaFromHex(themePrimary, 0.72),
        lineHeight: 18,
      }}
    >
      <Text style={{ color: sColor, fontWeight: '800' }}>{side}</Text> {x.assetName} ·{' '}
      {fmtMoney(x.side === 'in' ? x.amount : -x.amount)}
    </Text>
  );
}

function AttributionDayDetail({
  d,
  themePrimary,
  muted,
  internalOpen,
  setInternalOpen,
}: {
  d: DailyTradeSummary;
  themePrimary: string;
  muted: string;
  internalOpen: boolean;
  setInternalOpen: (v: boolean) => void;
}) {
  const market =
    d.residualMarketExplained !== null ? d.residualMarketExplained : null;
  const heldAtt = d.attributionHeld;
  const openCloseAtt = d.attributionOpenClose;
  const ext = d.externalNetFlow;
  const unexplained = d.residualUnexplained;
  const showUnexplained = unexplained !== null && Math.abs(unexplained) >= 1;

  const displayLines = filterTradeLinesForDisplay(d.lines);
  const internalLines = filterInternalTradeLines(d.lines);
  const movers = d.marketMovers ?? d.topMarketMovers ?? [];

  return (
    <View style={{ gap: 12 }}>
      {typeof d.snapshotDiff === 'number' ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {market !== null ? (
              <Text style={{ fontSize: 13, fontWeight: '700', color: themePrimary }}>
                逐资产合计{' '}
                <Text style={{ color: deltaColor(market, muted) }}>{fmtMoney(market)}</Text>
              </Text>
            ) : null}
            <Text style={{ fontSize: 13, fontWeight: '700', color: themePrimary }}>
              外部净流{' '}
              <Text style={{ color: deltaColor(ext, muted) }}>{fmtMoney(ext)}</Text>
            </Text>
          </View>
          {typeof heldAtt === 'number' || typeof openCloseAtt === 'number' ? (
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: rgbaFromHex(themePrimary, 0.55),
                lineHeight: 16,
              }}
            >
              {typeof heldAtt === 'number' ? <>持仓涨跌 {fmtMoney(heldAtt)}</> : null}
              {typeof heldAtt === 'number' && typeof openCloseAtt === 'number' ? ' · ' : null}
              {typeof openCloseAtt === 'number' ? <>新进/清仓 {fmtMoney(openCloseAtt)}</> : null}
            </Text>
          ) : null}
          {showUnexplained ? (
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: muted,
                lineHeight: 16,
              }}
            >
              口径差 {fmtMoney(unexplained!)}（历史汇率缺失日回退当前缓存、现金外币流水、舍入等）
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={{ fontSize: 12, fontWeight: '600', color: muted }}>无连续快照，仅展示流水</Text>
      )}

      {movers.length > 0 && market !== null ? (
        <View style={{ gap: 10 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '800',
              color: rgbaFromHex(themePrimary, 0.55),
              letterSpacing: 0.3,
            }}
          >
            资产影响（市值变动）
          </Text>
          {movers.map((m, idx) => (
            <View
              key={`${m.assetName}-${idx}`}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: themePrimary,
                  }}
                  numberOfLines={2}
                >
                  {m.assetName}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: muted,
                    marginTop: 2,
                  }}
                >
                  {CATEGORY_LABEL_ZH[m.category]}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '800',
                    color: deltaColor(m.delta, muted),
                  }}
                >
                  {fmtMoney(m.delta)}
                </Text>
                {m.liquidated ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: muted,
                      marginTop: 2,
                    }}
                  >
                    清仓
                  </Text>
                ) : m.dailyReturnPct !== null ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: financeDeltaColor(m.dailyReturnPct, muted),
                      marginTop: 2,
                    }}
                  >
                    {m.dailyReturnPct >= 0 ? '+' : ''}
                    {m.dailyReturnPct.toFixed(2)}%
                  </Text>
                ) : m.opened ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: muted,
                      marginTop: 2,
                    }}
                  >
                    新进
                  </Text>
                ) : (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: muted,
                      marginTop: 2,
                    }}
                  >
                    —
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {displayLines.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '800',
              color: rgbaFromHex(themePrimary, 0.55),
              letterSpacing: 0.3,
            }}
          >
            外部与独立成交
          </Text>
          {displayLines.slice(0, 60).map((x, idx) => renderTradeLine(x, idx, themePrimary))}
        </View>
      ) : (
        <Text style={{ fontSize: 12, fontWeight: '600', color: muted }}>当日无非内部流水</Text>
      )}

      {internalLines.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Pressable
            onPress={() => setInternalOpen(!internalOpen)}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: muted }}>
              内部划转 {internalLines.length} 笔 · {internalOpen ? '收起' : '展开'}
            </Text>
          </Pressable>
          {internalOpen ? (
            <View style={{ gap: 4, paddingLeft: 4 }}>
              {internalLines.slice(0, 60).map((x, idx) =>
                renderTradeLine(x, idx, themePrimary)
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function SettingsAttributionScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const params = useLocalSearchParams<{ focusDate?: string }>();
  const [tradeSummaries, setTradeSummaries] = useState<DailyTradeSummary[]>([]);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [unitMode, setUnitMode] = useState<'cny' | 'pct'>('cny');
  const shanghaiToday = useMemo(() => getShanghaiDateString(), []);
  const [calendarY, setCalendarY] = useState(() => {
    const t = getShanghaiDateString().split('-').map((x) => parseInt(x, 10));
    return { y: t[0]!, m: t[1]! };
  });
  /** 日历：选中格 + 底部弹层 */
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [modalInternalOpen, setModalInternalOpen] = useState(false);
  /** 列表：展开哪张卡片 */
  const [expandedListDate, setExpandedListDate] = useState<string | null>(null);
  const [listInternalOpenDate, setListInternalOpenDate] = useState<string | null>(
    null
  );

  const summaryByDate = useMemo(() => {
    const m = new Map<string, DailyTradeSummary>();
    for (const r of tradeSummaries) m.set(r.date, r);
    return m;
  }, [tradeSummaries]);

  const detailSummary = detailDate ? summaryByDate.get(detailDate) : undefined;

  const listRows = useMemo(
    () => tradeSummaries.filter(isSignificantTradeSummaryDay).slice(0, 90),
    [tradeSummaries]
  );

  useEffect(() => {
    const raw = params.focusDate;
    const fd =
      typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    if (!fd || tradeLoading || tradeSummaries.length === 0) return;
    if (summaryByDate.has(fd)) {
      const parts = fd.split('-').map((x) => parseInt(x, 10));
      const y = parts[0]!;
      const mo = parts[1]!;
      setCalendarY({ y, m: mo });
      setDetailDate(fd);
    }
  }, [params.focusDate, tradeSummaries, tradeLoading, summaryByDate]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setTradeLoading(true);
      (async () => {
        try {
          const [assets, snaps, assetSnaps, fx, fxHistory] = await Promise.all([
            getAssets(),
            getSnapshots(),
            getAssetDailySnapshots(),
            getCachedFxUsdRates(),
            getFxUsdRatesHistory(),
          ]);
          const resolveFxRates = createFxRatesResolver(
            fxHistory,
            fx?.rates ?? null
          );
          const rows = buildDailyTradeSummaries(
            {
              assets,
              snapshots: snaps,
              assetDailySnapshots: assetSnaps,
              usdRates: fx?.rates ?? null,
              resolveFxRates,
            },
            { filterInsignificant: false }
          );
          if (!cancelled) setTradeSummaries(rows);
        } catch {
          if (!cancelled) setTradeSummaries([]);
        } finally {
          if (!cancelled) setTradeLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const cardShadow = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  };

  const muted = rgbaFromHex(theme.primary, 0.62);
  const cellGap = 4;

  const goPrevMonth = () => {
    setCalendarY((c) =>
      c.m <= 1 ? { y: c.y - 1, m: 12 } : { y: c.y, m: c.m - 1 }
    );
  };
  const goNextMonth = () => {
    setCalendarY((c) =>
      c.m >= 12 ? { y: c.y + 1, m: 1 } : { y: c.y, m: c.m + 1 }
    );
  };

  const calendarWeeks = useMemo(() => {
    const cells = monthCells(calendarY.y, calendarY.m);
    return chunkCalendarWeeks(cells);
  }, [calendarY.y, calendarY.m]);

  const chip = (active: boolean) => ({
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: active ? rgbaFromHex(theme.primary, 0.14) : 'transparent',
  });
  const chipText = (active: boolean) => ({
    fontSize: 12,
    fontWeight: '700' as const,
    color: active ? theme.primary : muted,
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: 12,
        paddingBottom: insets.bottom + 28,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: '800',
          color: theme.primary,
          marginBottom: 10,
        }}
      >
        收益日历
      </Text>

      <Text
        style={{
          fontSize: 12,
          fontWeight: '500',
          color: muted,
          marginBottom: 14,
          lineHeight: 18,
        }}
      >
        按日对照「总净值快照」变化（折人民币时与 Dashboard 一致）。点击某日可查看各资产市值贡献与外部流水；红涨绿跌为 A
        股习惯展示。
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setViewMode('calendar');
              setExpandedListDate(null);
            }}
            style={chip(viewMode === 'calendar')}
          >
            <Text style={chipText(viewMode === 'calendar')}>日历</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setViewMode('list');
              setDetailDate(null);
            }}
            style={chip(viewMode === 'list')}
          >
            <Text style={chipText(viewMode === 'list')}>列表</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setUnitMode('cny')}
            style={chip(unitMode === 'cny')}
          >
            <Text style={chipText(unitMode === 'cny')}>¥</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setUnitMode('pct')}
            style={chip(unitMode === 'pct')}
          >
            <Text style={chipText(unitMode === 'pct')}>%</Text>
          </Pressable>
        </View>
      </View>

      {tradeLoading ? (
        <View
          style={{
            borderRadius: 18,
            padding: 14,
            backgroundColor: '#FFFFFF',
            ...cardShadow,
          }}
        >
          <Text style={{ color: rgbaFromHex(theme.primary, 0.7), fontWeight: '600' }}>
            加载中…
          </Text>
        </View>
      ) : tradeSummaries.length === 0 ? (
        <View
          style={{
            borderRadius: 18,
            padding: 14,
            backgroundColor: '#FFFFFF',
            ...cardShadow,
          }}
        >
          <Text style={{ color: rgbaFromHex(theme.primary, 0.7), fontWeight: '600' }}>
            暂无数据。请先同步行情生成净值快照；有外部现金或独立证券成交后会出现归因。
          </Text>
        </View>
      ) : viewMode === 'calendar' ? (
        <View
          style={{
            borderRadius: 18,
            padding: 12,
            backgroundColor: '#FFFFFF',
            alignSelf: 'stretch',
            width: '100%',
            ...cardShadow,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <Pressable
              onPress={goPrevMonth}
              hitSlop={12}
              accessibilityLabel="上一月"
            >
              <Text style={{ fontSize: 20, color: theme.primary, fontWeight: '800' }}>
                ‹
              </Text>
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.primary }}>
              {calendarY.y} 年 {calendarY.m} 月
            </Text>
            <Pressable
              onPress={goNextMonth}
              hitSlop={12}
              accessibilityLabel="下一月"
            >
              <Text style={{ fontSize: 20, color: theme.primary, fontWeight: '800' }}>
                ›
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: 'row',
              gap: cellGap,
              marginBottom: 6,
              width: '100%',
            }}
          >
            {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
              <View
                key={w}
                style={[CAL_COL_BASE, { alignItems: 'center' }]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: muted }}>{w}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: cellGap, width: '100%' }}>
            {calendarWeeks.map((week, wi) => (
              <View
                key={`w-${wi}`}
                style={{
                  flexDirection: 'row',
                  gap: cellGap,
                  width: '100%',
                }}
              >
                {week.map((day, di) => {
                  const idx = wi * 7 + di;
                  if (day === null) {
                    return (
                      <View
                        key={`pad-${idx}`}
                        style={[CAL_COL_BASE, { minHeight: 56 }]}
                      />
                    );
                  }
                  const dateStr = ymd(calendarY.y, calendarY.m, day);
                  const row = summaryByDate.get(dateStr);
                  const diff = row?.snapshotDiff;
                  const pct = row?.snapshotPct;
                  const isToday = dateStr === shanghaiToday;
                  const isSel = detailDate === dateStr;

                  let sub = '—';
                  let subColor = muted;
                  let bg = rgbaFromHex(theme.primary, 0.04);

                  if (unitMode === 'cny') {
                    if (typeof diff === 'number') {
                      sub = formatCellCny(diff);
                      subColor = deltaColor(diff, muted);
                      bg =
                        diff > 0
                          ? 'rgba(229, 57, 53, 0.1)'
                          : diff < 0
                            ? 'rgba(46, 125, 50, 0.1)'
                            : rgbaFromHex(theme.primary, 0.06);
                    }
                  } else if (typeof pct === 'number') {
                    sub = fmtPct(pct);
                    subColor = deltaColor(pct, muted);
                    bg =
                      pct > 0
                        ? 'rgba(229, 57, 53, 0.1)'
                        : pct < 0
                          ? 'rgba(46, 125, 50, 0.1)'
                          : rgbaFromHex(theme.primary, 0.06);
                  }

                  if (isSel) {
                    bg = theme.primary;
                    subColor = '#FFFFFF';
                  } else if (isToday && !isSel) {
                    bg = rgbaFromHex(theme.primary, 0.18);
                  }

                  return (
                    <Pressable
                      key={dateStr}
                      onPress={() => {
                        setDetailDate(dateStr);
                        setModalInternalOpen(false);
                      }}
                      style={({ pressed }) => [
                        CAL_COL_BASE,
                        {
                          minHeight: 56,
                          borderRadius: 10,
                          paddingVertical: 6,
                          paddingHorizontal: 2,
                          backgroundColor: bg,
                          opacity: pressed ? 0.88 : 1,
                          borderWidth: isToday && !isSel ? 1 : 0,
                          borderColor: rgbaFromHex(theme.primary, 0.35),
                          overflow: 'hidden',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color: isSel ? '#FFF' : theme.primary,
                        }}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        {day}
                      </Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.65}
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: subColor,
                          marginTop: 4,
                        }}
                      >
                        {sub}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {listRows.map((d) => {
            const open = expandedListDate === d.date;
            const diff = d.snapshotDiff;
            const diffColor =
              typeof diff === 'number' ? deltaColor(diff, muted) : muted;

            const market =
              d.residualMarketExplained !== null ? d.residualMarketExplained : null;
            const heldAtt = d.attributionHeld;
            const openCloseAtt = d.attributionOpenClose;
            const ext = d.externalNetFlow;
            const unexplained = d.residualUnexplained;
            const showUnexplained = unexplained !== null && Math.abs(unexplained) >= 1;

            return (
              <View
                key={d.date}
                style={{
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: '#FFFFFF',
                  ...cardShadow,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpandedListDate(open ? null : d.date)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '800', color: theme.primary }}>
                      {d.date}
                    </Text>
                    {typeof diff === 'number' ? (
                      <Text style={{ fontSize: 14, fontWeight: '800', color: diffColor }}>
                        净值 {fmtMoney(diff)}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 12, fontWeight: '600', color: muted }}>
                        无连续快照
                      </Text>
                    )}
                    <View style={{ flex: 1, minWidth: 8 }} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>
                      {open ? '收起' : '明细'}
                    </Text>
                  </View>

                  {typeof diff === 'number' ? (
                    <View style={{ marginTop: 10, gap: 4 }}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                        {market !== null ? (
                          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary }}>
                            逐资产合计{' '}
                            <Text style={{ color: deltaColor(market, muted) }}>
                              {fmtMoney(market)}
                            </Text>
                          </Text>
                        ) : null}
                        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary }}>
                          外部净流{' '}
                          <Text style={{ color: deltaColor(ext, muted) }}>{fmtMoney(ext)}</Text>
                        </Text>
                      </View>
                      {typeof heldAtt === 'number' || typeof openCloseAtt === 'number' ? (
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: rgbaFromHex(theme.primary, 0.55),
                            lineHeight: 16,
                          }}
                        >
                          {typeof heldAtt === 'number' ? (
                            <>持仓涨跌 {fmtMoney(heldAtt)}</>
                          ) : null}
                          {typeof heldAtt === 'number' && typeof openCloseAtt === 'number'
                            ? ' · '
                            : null}
                          {typeof openCloseAtt === 'number' ? (
                            <>新进/清仓 {fmtMoney(openCloseAtt)}</>
                          ) : null}
                        </Text>
                      ) : null}
                      {showUnexplained ? (
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: muted,
                            lineHeight: 16,
                          }}
                        >
                          口径差 {fmtMoney(unexplained!)}（历史汇率缺失日回退当前缓存、现金外币流水、舍入等）
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>

                {open ? (
                  <View style={{ marginTop: 12 }}>
                    <AttributionDayDetail
                      d={d}
                      themePrimary={theme.primary}
                      muted={muted}
                      internalOpen={listInternalOpenDate === d.date}
                      setInternalOpen={(v) =>
                        setListInternalOpenDate(v ? d.date : null)
                      }
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <Modal
        visible={detailDate !== null && viewMode === 'calendar'}
        animationType="slide"
        {...(Platform.OS === 'ios'
          ? { presentationStyle: 'pageSheet' as const }
          : {})}
        onRequestClose={() => setDetailDate(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.pageBg,
            paddingTop: insets.top + 8,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingBottom: 12,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.primary }}>
              {detailDate ?? ''} 归因明细
            </Text>
            <Pressable onPress={() => setDetailDate(null)} hitSlop={16}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.primary }}>
                关闭
              </Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 24,
            }}
            showsVerticalScrollIndicator={false}
          >
            {detailSummary ? (
              <AttributionDayDetail
                d={detailSummary}
                themePrimary={theme.primary}
                muted={muted}
                internalOpen={modalInternalOpen}
                setInternalOpen={setModalInternalOpen}
              />
            ) : (
              <Text style={{ color: muted }}>该日暂无汇总数据</Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}
